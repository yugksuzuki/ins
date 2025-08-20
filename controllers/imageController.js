// controllers/imageController.js
const Image = require('../models/Image');
const { getImageEmbedding } = require('../services/clipService');

exports.uploadImage = async (req, res) => {
  try {
    const { name, image } = req.body;
    if (!image) return res.status(400).json({ error: 'Imagem obrigatória' });
    const embedding = await getImageEmbedding(image);
    const doc = await Image.create({
      label: name || '',
      image_url: '',
      embedding,
    });
    res.json({ ok: true, id: doc._id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao processar imagem' });
  }
};
