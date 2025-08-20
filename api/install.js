// api/install.js
module.exports = (req, res) => {
  // Lê o ?shop=... da URL
  const url = new URL(req.url, `https://${req.headers.host}`);
  const shop =
    url.searchParams.get('shop') ||
    process.env.DEV_SHOP ||
    '';

  if (!shop) {
    res.statusCode = 400;
    return res.end('Faltou ?shop=SUALOJA.myshopify.com (ou defina DEV_SHOP no .env).');
  }

  // Redireciona para sua rota de OAuth do Express
  res.statusCode = 302;
  res.setHeader('Location', `/api/auth?shop=${encodeURIComponent(shop)}`);
  res.end();
};
