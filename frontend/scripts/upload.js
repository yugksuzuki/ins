
// upload.js
import { API_BASE } from './config.js';

export async function uploadImage(label, base64Image, resultDiv, resetForm) {
  try {
    const response = await fetch(`${API_BASE}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, image: base64Image })
    });

    const data = await response.json();
    resultDiv.innerHTML = data.success
      ? `<p>✅ Imagem enviada com sucesso!</p>`
      : `<p>❌ Erro: ${data.message}</p>`;
    if (data.success && resetForm) resetForm();
  } catch (error) {
    console.error(error);
    resultDiv.innerHTML = `<p>❌ Erro ao enviar.</p>`;
  }
}
