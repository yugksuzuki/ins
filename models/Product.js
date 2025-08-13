const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  indice: Number,
  imagem: String,
  embedding: [Number],
  link: String
});

module.exports = mongoose.model('Product', productSchema);
