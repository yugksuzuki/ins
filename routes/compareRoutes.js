// routes/shopifyRoutes.js
const express = require('express');
const router = express.Router();
const { shopify } = require('../shopify'); // 👈 usar o app-express export
const Image = require('../models/Image');

// ⚠️ clipService é ESM no seu projeto, então usamos import() dinâmico dentro dos handlers
async function getClipService() {
  return await import('../services/clipService.js'); // { getImageEmbedding }
}

// Pinecone (SDK v>=2)
const { Pinecone } = require('@pinecone-database/pinecone');
let pineconeClient;
/** Lazy init do Pinecone */
function getPinecone() {
  if (!pineconeClient) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY ausente no .env');
    }
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
}

/** Upsert em lote no Pinecone */
async function upsertToPinecone(vectors) {
  if (!process.env.PINECONE_INDEX) {
    throw new Error('PINECONE_INDEX ausente no .env');
  }
  const pc = getPinecone();
  const index = pc.Index(process.env.PINECONE_INDEX);
  // SDK moderno aceita array direto [{id,values,metadata}]
  await index.upsert(vectors);
}

/** Util: limita concorrência (ex.: 3 promessas ao mesmo tempo) */
async function pMapLimited(items, limit, mapper) {
  const ret = [];
  let i = 0;
  const exec = async () => {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await mapper(items[idx], idx);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, exec);
  await Promise.all(workers);
  return ret;
}

/** GraphQL: pega produtos + imagens (página única) */
const PRODUCTS_QUERY = `
  query FirstProducts($first: Int!) {
    products(first: $first) {
      edges {
        cursor
        node {
          id
          title
          handle
          images(first: 5) {
            edges {
              node { id url altText }
            }
          }
        }
      }
    }
  }
`;

/** Handler principal (GraphQL Admin) */
const importProductsHandler = async (req, res) => {
  try {
    // session fornecida pelo middleware validateAuthenticatedSession()
    const session = res.locals.shopify.session;
    const shopDomain = session.shop;
    const first = Math.max(1, Math.min(parseInt(req.query.first || '50', 10), 250));

    // ✅ SDK novo: usar shopify.api.clients.Graphql
    const client = new shopify.api.clients.Graphql({ session });

    const resp = await client.query({
      data: { query: PRODUCTS_QUERY, variables: { first } },
    });

    const products = resp?.body?.data?.products?.edges || [];
    if (!products.length) {
      return res.json({ success: true, imported: 0, vectorsUpserted: 0, details: [] });
    }

    // Achatar lista de imagens com metadados do produto
    const images = [];
    for (const edge of products) {
      const p = edge.node;
      const imgEdges = p?.images?.edges || [];
      for (const ie of imgEdges) {
        const img = ie.node;
        images.push({
          productId: p.id,
          title: p.title,
          handle: p.handle,
          imageId: img.id,
          imageUrl: img.url,
          altText: img.altText || null,
          shop: shopDomain,
        });
      }
    }

    // Evitar duplicados: filtra imagens já existentes por image_url
    const existing = await Image.find(
      { image_url: { $in: images.map(i => i.imageUrl) } },
      { image_url: 1 }
    ).lean();
    const existingSet = new Set(existing.map(e => e.image_url));
    const toProcess = images.filter(i => !existingSet.has(i.imageUrl));

    if (!toProcess.length) {
      return res.json({
        success: true,
        imported: 0,
        vectorsUpserted: 0,
        skipped: images.length,
        message: 'Nenhuma imagem nova para processar.',
      });
    }

    // Gerar embeddings com concorrência limitada (3 simultâneos)
    const { getImageEmbedding } = await getClipService();

    const results = await pMapLimited(toProcess, 3, async (item) => {
      try {
        const embedding = await getImageEmbedding(item.imageUrl);

        // Salvar no Mongo (coleção Image)
        const doc = await Image.create({
          label: item.title,
          image_url: item.imageUrl,
          embedding,
        });

        return {
          ok: true,
          mongoId: doc._id.toString(),
          embedding,
          meta: item,
        };
      } catch (err) {
        return { ok: false, error: err.message, meta: item };
      }
    });

    const okResults = results.filter(r => r.ok);
    const vectors = okResults.map(r => ({
      id: r.mongoId,
      values: r.embedding,
      metadata: {
        shop: r.meta.shop,
        productId: r.meta.productId,
        title: r.meta.title,
        imageUrl: r.meta.imageUrl,
        productUrl: r.meta.handle ? `https://${shopDomain}/products/${r.meta.handle}` : null,
      },
    }));

    // Upsert no Pinecone
    let upserted = 0;
    if (vectors.length) {
      await upsertToPinecone(vectors);
      upserted = vectors.length;
    }

    // Resumo
    const failed = results
      .filter(r => !r.ok)
      .map(r => ({ error: r.error, imageUrl: r.meta?.imageUrl }));

    return res.json({
      success: true,
      imported: okResults.length,
      vectorsUpserted: upserted,
      failedCount: failed.length,
      failed,
    });
  } catch (err) {
    console.error('Erro em /import-products:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** POST /embed-image
 *  body: { imageUrl: "https://..." }
 *  - Utilidade para testar uma imagem isolada.
 */
const embedImageHandler = async (req, res) => {
  try {
    const { imageUrl } = req.body || {};
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Parâmetro imageUrl é obrigatório.' });
    }
    const { getImageEmbedding } = await getClipService();
    const embedding = await getImageEmbedding(imageUrl);
    return res.json({ success: true, embeddingLength: embedding.length });
  } catch (err) {
    console.error('Erro em /embed-image:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /status
 *  - Mostra quantas imagens estão embeddadas no Mongo (rápido para sanity check)
 */
const statusHandler = async (_req, res) => {
  try {
    const count = await Image.countDocuments();
    return res.json({ success: true, imagesEmbeddings: count });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== Rotas ====================
// Usamos um array de paths para funcionar quer o router seja montado em "/" ou em "/api/shopify"
const withAuth = shopify.validateAuthenticatedSession();

router.get(['/import-products', '/api/shopify/import-products'], withAuth, importProductsHandler);
router.post(['/embed-image', '/api/shopify/embed-image'], withAuth, embedImageHandler);
router.get(['/status', '/api/shopify/status'], withAuth, statusHandler);

module.exports = router;
