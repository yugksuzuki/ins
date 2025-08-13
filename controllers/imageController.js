const Image = require("../models/Image");
const clipService = require("../services/clipService");

exports.uploadImage = async (req, res) => {
  try {
    const { name, image } = req.body;

    if (!name || !image) {
      return res.status(400).json({ success: false, message: "Imagem e nome são obrigatórios." });
    }

    // Gera embedding com a imagem base64 diretamente
    const embedding = await clipService.getImageEmbedding(image);

    const newImage = new Image({
      label: name,
      image_url: image,
      embedding
    });

    await newImage.save();

    res.json({ success: true, message: "Imagem salva com sucesso." });
  } catch (error) {
    console.error("Erro ao salvar imagem:", error);
    res.status(500).json({ success: false, message: "Erro interno ao salvar imagem." });
  }
};