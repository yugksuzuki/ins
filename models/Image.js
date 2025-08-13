const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  label: String,
  image_url: String,
  embedding: [Number]
}, { timestamps: true });

module.exports = mongoose.model('Image', imageSchema);
