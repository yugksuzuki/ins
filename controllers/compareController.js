// controllers/compareController.js
const Product = require('../models/Product');
const { getImageEmbedding, cosineSimilarity } = require('../services/clipService');

exports.compare = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Imagem obrigatória' });

    const queryEmb = await getImageEmbedding(image);
    const products = await Product.find({}, { indice: 1, imagem: 1, link: 1, embedding: 1 }).limit(1000);

    const scored = products
      .filter(p => Array.isArray(p.embedding) && p.embedding.length === queryEmb.length)
      .map(p => ({
        indice: p.indice,
        imagem: p.imagem,
        link: p.link,
        score: cosineSimilarity(queryEmb, p.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.json({ matches: scored });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha na comparação' });
  }
};
