// services/clipService.js
const Replicate = require('replicate');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function getImageEmbedding(base64OrUrl) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN não configurado');
  }
  const model = 'krthr/clip-embeddings:latest'; // ajuste se usar outra versão
  const input = { image: base64OrUrl };
  const output = await replicate.run(model, { input });
  return Array.isArray(output) ? output.map(Number) : [];
}

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? (dot / denom) : 0;
}

module.exports = { getImageEmbedding, cosineSimilarity };
