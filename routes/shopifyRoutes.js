// routes/shopifyRoutes.js
const express = require('express');
const router = express.Router();
const { shopify } = require('../shopify');

/**
 * Sanity check da sessão.
 * OBS: Este arquivo só é usado DEPOIS do validateAuthenticatedSession(),
 * então res.locals.shopify.session SEMPRE deve existir aqui.
 */
router.get('/me', async (req, res) => {
  const s = res.locals.shopify.session;
  res.json({
    ok: true,
    shop: s?.shop,
    isOnline: s?.isOnline,
    scope: s?.scope,
  });
});

/**
 * Importar produtos (GraphQL Admin API)
 * Exemplo simples que lê até "first" produtos e retorna dados básicos.
 * SDK v11 => shopify.api.clients.Graphql({ session })
 */
router.get('/import-products', async (req, res, next) => {
  try {
    const session = res.locals.shopify.session;
    if (!session) {
      return res.status(401).json({ ok: false, message: 'Sem sessão Shopify' });
    }

    const first = Math.min(parseInt(req.query.first ?? '20', 10) || 20, 250);

    const gql = new shopify.api.clients.Graphql({ session });

    const query = /* GraphQL */ `
      query Products($first: Int!) {
        products(first: $first, sortKey: UPDATED_AT) {
          edges {
            node {
              id
              title
              handle
              status
              createdAt
              updatedAt
              totalInventory
              images(first: 1) { edges { node { url } } }
              variants(first: 1) { edges { node { id sku price } } }
            }
          }
        }
      }
    `;

    const result = await gql.query({
      data: { query, variables: { first } },
    });

    const edges = result?.body?.data?.products?.edges ?? [];
    res.json({
      ok: true,
      count: edges.length,
      products: edges.map(e => e.node),
    });
  } catch (err) {
    console.error('Erro em /import-products:', err);
    next(err);
  }
});

/**
 * Exemplo REST (se precisar)
 * SDK v11 => shopify.api.clients.Rest({ session })
 */
router.get('/products-rest', async (req, res, next) => {
  try {
    const session = res.locals.shopify.session;
    if (!session) {
      return res.status(401).json({ ok: false, message: 'Sem sessão Shopify' });
    }

    const limit = Math.min(parseInt(req.query.limit ?? '20', 10) || 20, 250);
    const rest = new shopify.api.clients.Rest({ session });

    const out = await rest.get({
      path: 'products',
      query: { limit },
    });

    res.json({ ok: true, products: out?.body?.products ?? [] });
  } catch (err) {
    console.error('Erro em /products-rest:', err);
    next(err);
  }
});

module.exports = router;
