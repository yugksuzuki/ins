
// compare.js
import { API_BASE } from './config.js';

export async function compareImage(base64Image, resultDiv) {
  try {
    const response = await fetch(`${API_BASE}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image })
    });

    const data = await response.json();

    if (data.success) {
      const match = data.match;
      resultDiv.innerHTML = `
        <p><strong>Imagem mais próxima:</strong> ${match.label}</p>
        <img src="${match.image_url}" alt="Imagem mais parecida" style="max-width: 300px; border-radius: 12px;">
        <p><strong>Similaridade:</strong> ${(match.similarity * 100).toFixed(2)}%</p>
      `;
    } else {
      resultDiv.innerHTML = `<p>❌ Erro: ${data.message}</p>`;
    }
  } catch (error) {
    console.error(error);
    resultDiv.innerHTML = `<p>❌ Erro ao comparar.</p>`;
  }
}
