// scripts/populatePinecone.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Pinecone } = require('@pinecone-database/pinecone');
const Image = require('../models/Image');

async function main() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB || 'insmatch';
  if (!uri) throw new Error('MONGO_URI ausente');
  await mongoose.connect(uri, { dbName });
  console.log('[Mongo] ok');

  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX;
  if (!apiKey || !indexName) throw new Error('Pinecone API key/INDEX ausentes');

  const pinecone = new Pinecone({ apiKey });
  const index = pinecone.Index(indexName);

  const docs = await Image.find({}, { embedding: 1, label: 1 }).limit(5000);
  const vectors = docs
    .filter(d => Array.isArray(d.embedding) && d.embedding.length)
    .map(d => ({
      id: String(d._id),
      values: d.embedding,
      metadata: { label: d.label || '' },
    }));

  const batch = 100;
  for (let i = 0; i < vectors.length; i += batch) {
    const slice = vectors.slice(i, i + batch);
    await index.upsert(slice);
    console.log(`Upsert ${i + slice.length}/${vectors.length}`);
  }

  console.log('Pinecone upsert concluído.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Erro no populate:', err);
  process.exit(1);
});
// scripts/populatePinecone.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Pinecone } = require('@pinecone-database/pinecone');
const Image = require('../models/Image');

async function main() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB || 'insmatch';
  if (!uri) throw new Error('MONGO_URI ausente');
  await mongoose.connect(uri, { dbName });
  console.log('[Mongo] ok');

  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX;
  if (!apiKey || !indexName) throw new Error('Pinecone API key/INDEX ausentes');

  const pinecone = new Pinecone({ apiKey });
  const index = pinecone.Index(indexName);

  const docs = await Image.find({}, { embedding: 1, label: 1 }).limit(5000);
  const vectors = docs
    .filter(d => Array.isArray(d.embedding) && d.embedding.length)
    .map(d => ({
      id: String(d._id),
      values: d.embedding,
      metadata: { label: d.label || '' },
    }));

  const batch = 100;
  for (let i = 0; i < vectors.length; i += batch) {
    const slice = vectors.slice(i, i + batch);
    await index.upsert(slice);
    console.log(`Upsert ${i + slice.length}/${vectors.length}`);
  }

  console.log('Pinecone upsert concluído.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Erro no populate:', err);
  process.exit(1);
});
