const Product = require('../models/Product');
const clipService = require('../services/clipService');

exports.compareImage = async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ success: false, message: "Imagem obrigatória." });

  try {
    const queryEmbedding = await clipService.getImageEmbedding(image);
    const produtos = await Product.find();

    const matches = produtos.map(prod => {
      const similarity = clipService.cosineSimilarity(queryEmbedding, prod.embedding);
      return {
        metadata: {
          indice: prod.indice,
          imagem: prod.imagem,
          link: prod.link
        },
        score: similarity
      };
    });

    const topMatches = matches.sort((a, b) => b.score - a.score).slice(0, 5);

    res.json({ success: true, matches: topMatches });
  } catch (error) {
    console.error("Erro ao comparar imagem:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
