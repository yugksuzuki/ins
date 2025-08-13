
import Replicate from "replicate";
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

export async function getImageEmbedding(imageUrlOrBase64) {
  const input = {
    image: imageUrlOrBase64
  };

  try {
    const output = await replicate.run(
      "krthr/clip-embeddings:f279eaca902eec7a5587c257d522a300b37ca1887c407d558ee20835ae91bce7",
      { input }
    );
    console.log("CLIP output:", output);

    if (!output || (!output.embedding && !Array.isArray(output))) {
      throw new Error("Resposta inválida da API Replicate: " + JSON.stringify(output));
    }

    return output.embedding || output;
  } catch (error) {
    console.error("Erro ao obter embedding da imagem:", error);
    throw new Error("Erro ao processar imagem com CLIP.");
  }
}

export function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (normA * normB);
}
