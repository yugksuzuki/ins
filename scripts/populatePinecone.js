import mongoose from "mongoose";
import dotenv from "dotenv";
import { Pinecone } from "@pinecone-database/pinecone";
import Image from "../models/Image.js";

dotenv.config();
await mongoose.connect(process.env.MONGO_URI);

// Inicialização correta do Pinecone com .init()
const pinecone = new Pinecone();
await pinecone.init({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT
});

const index = pinecone.Index(process.env.PINECONE_INDEX);

const images = await Image.find();

if (!images.length) {
  console.log("Nenhuma imagem encontrada no banco.");
  process.exit();
}

const vectors = images.map((img) => ({
  id: img._id.toString(),
  values: img.embedding,
  metadata: {
    title: img.title || "Produto",
    imageUrl: img.imageUrl,
    idMongo: img._id
  }
}));

await index.upsert({ upsertRequest: { vectors } });

console.log("Pinecone index populated com", vectors.length, "vetores!");
process.exit();