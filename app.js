// scr/inspmatch_backend_melhorado/app.js
require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

console.log('API KEY carregada?', !!process.env.SHOPIFY_API_KEY);

const { shopify } = require('./shopify');

const imageRoutes = require('./routes/imageRoutes');
const compareRoutes = require('./routes/compareRoutes');
const userRoutes = require('./routes/userRoutes');
const shopifyRoutes = require('./routes/shopifyRoutes');

const app = express();

/* -------- Infra básica -------- */
app.set('trust proxy', 1);
app.use(morgan('dev'));
app.use(
  cors({
    origin: [/\.myshopify\.com$/, 'https://admin.shopify.com'],
    credentials: true,
  })
);

// ✅ CSP oficial da Shopify para apps embedded
app.use(shopify.cspHeaders());

// Helmet sem CSP para não conflitar com o header acima
app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(compression());
app.use(cookieParser());
app.use(express.json());

/* -------- (Opcional) Conexão Mongo -------- */
if (process.env.MONGO_URI) {
  const opts = {
    dbName: process.env.MONGO_DB || 'insmatch',
    serverSelectionTimeoutMS: 5000, // evita travar na Vercel
  };
  mongoose
    .connect(process.env.MONGO_URI, opts)
    .then(() => console.log('✅ Mongo conectado'))
    .catch((err) => console.error('⚠️ Mongo falhou (seguindo sem DB):', err.message));
}



/* -------- Auth da Shopify -------- */
const beginAuth = shopify.auth.begin();

// Início do OAuth (normaliza o shop e garante ?shop=... na URL)
app.get('/api/auth', (req, res, next) => {
  const raw = String(req.query.shop ?? process.env.DEV_SHOP ?? '').trim();
  const shop = raw && raw !== 'undefined' && raw !== 'null' ? raw : '';

  console.log(
    'AUTH route -> incoming shop:', req.query.shop,
    'DEV_SHOP:', process.env.DEV_SHOP,
    'resolved:', shop
  );

  if (!shop) {
    return res
      .status(400)
      .send('Faltou ?shop=SUALOJA.myshopify.com (ou defina DEV_SHOP no .env)');
  }

  if (!req.query.shop || req.query.shop === 'undefined' || req.query.shop === 'null') {
    return res.redirect(`/api/auth?shop=${encodeURIComponent(shop)}`);
  }

  return beginAuth(req, res, next);
});

// Callback do OAuth -> redireciona para /app com host+shop
app.get('/api/auth/callback', shopify.auth.callback(), (req, res) => {
  const host = req.query.host || '';
  const shop = req.query.shop || '';
  return res.redirect(
    `/app${shop ? `?shop=${encodeURIComponent(shop)}` : ''}${
      host ? `${shop ? '&' : '?'}host=${encodeURIComponent(host)}` : ''
    }`
  );
});

/* -------- Página embutida do app (para testar authenticatedFetch) -------- */
app.get('/app', (req, res) => {
  const apiKey = process.env.SHOPIFY_API_KEY || '';
  const shop = req.query.shop || '';
  const host = req.query.host || '';

  res.send(`<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>InspMatch Admin</title>

  <!-- App Bridge v3 via unpkg -->
  <script src="https://unpkg.com/@shopify/app-bridge@3"></script>
  <style>
    body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:20px}
    button{padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer}
    button:hover{background:#f7f7f7}
    pre{background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap}
  </style>
</head>
<body>
  <h1>InspMatch – Teste de API</h1>
  <p>Loja: <strong id="shop">${shop || '(desconhecida)'}</strong></p>
  <div style="display:flex; gap:12px; margin:16px 0;">
    <button id="btnPing">Testar /api/ping</button>
    <button id="btnImport">Importar produtos (first=10)</button>
  </div>
  <pre id="out"></pre>

  <script>
    (async function () {
      const out = document.getElementById('out');
      const params = new URLSearchParams(location.search);
      const hostFromUrl = params.get('host') || '${host}';
      const apiKey = '${apiKey}';

      function log(obj) {
        try { out.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2); }
        catch { out.textContent = String(obj); }
      }

      if (!apiKey) { log('Faltou SHOPIFY_API_KEY no .env'); return; }
      if (!hostFromUrl) { log('Faltou "host" na URL do iframe'); return; }

      const AB = window['app-bridge'] || (window.Shopify && window.Shopify.AppBridge);
      if (!AB || typeof AB.createApp !== 'function') {
        log('App Bridge não carregou. Verifique a aba Network para @shopify/app-bridge@3.');
        return;
      }

      const app = AB.createApp({ apiKey, host: hostFromUrl });

      const hasAuthFetch = !!(AB.utilities && typeof AB.utilities.authenticatedFetch === 'function');
      const hasGetToken  = !!(AB.utilities && typeof AB.utilities.getSessionToken === 'function');

      async function call(path, init = {}) {
        log('Chamando ' + path + ' ...');
        try {
          let res;

          if (hasAuthFetch) {
            // ✅ Use SOMENTE authenticatedFetch (ele já injeta Authorization)
            const fetchFn = AB.utilities.authenticatedFetch(app);
            res = await fetchFn(path, init);
          } else if (hasGetToken) {
            // ✅ Fallback: aí sim geramos o header Authorization manualmente
            const token = await AB.utilities.getSessionToken(app);
            const headers = new Headers(init.headers || {});
            headers.set('Authorization', 'Bearer ' + token);
            res = await fetch(path, { ...init, headers });
          } else {
            log('App Bridge sem authenticatedFetch e sem getSessionToken.');
            return;
          }

          const text = await res.text();
          try { log(JSON.parse(text)); } catch { log(text); }
        } catch (e) {
          log('Erro: ' + (e && e.message ? e.message : e));
        }
      }

      document.getElementById('btnPing').addEventListener('click', () => call('/api/ping'));
      document.getElementById('btnImport').addEventListener('click', () => call('/api/shopify/import-products?first=10'));
    })();
  </script>
</body>
</html>`);
});

/* -------- Rotas públicas úteis -------- */
app.get('/', (req, res) => {
  const { shop, host } = req.query;
  if (host || shop) {
    return res.redirect(
      `/app${shop ? `?shop=${encodeURIComponent(shop)}` : ''}${
        host ? `${shop ? '&' : '?'}host=${encodeURIComponent(host)}` : ''
      }`
    );
  }
  return res.send('OK: backend rodando. Use /install?shop=SUA-LOJA.myshopify.com');
});

app.get('/install', (req, res) => {
  const shop = req.query.shop || process.env.DEV_SHOP;
  if (!shop) return res.status(400).send('Faltou ?shop=SUA-LOJA.myshopify.com');
  return res.redirect(`/api/auth?shop=${shop}`);
});

app.get('/health', (_req, res) => res.json({ ok: true }));


// --- coloque acima do validateAuthenticatedSession ---
app.use((req, _res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.includes(',')) {
    // Quando chegam 2+ Authorization headers, o Node os junta por vírgula.
    const parts = auth.split(',').map(s => s.trim());
    const bearer = parts.find(p => p.toLowerCase().startsWith('bearer '));
    req.headers.authorization = bearer || parts[0]; // prioriza "Bearer ..."
  }
  next();
});


/* -------- Proteção das APIs (sessão Shopify obrigatória) -------- */
app.use('/api', shopify.validateAuthenticatedSession());

/* -------- Suas rotas protegidas -------- */
app.use('/api/shopify', shopifyRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/users', userRoutes);

app.get('/api/ping', (req, res) => {
  res.json({
    ok: true,
    shop: res.locals.shopify.session.shop,
    scopes: res.locals.shopify.session.scope,
  });
});

/* -------- Error handler global -------- */
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Erro interno' });
});

// ... seu app.js inteiro acima

/* -------- Start (somente fora da Vercel) -------- */
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () =>
    console.log(`Server on http://${process.env.SHOPIFY_HOST_NAME || `localhost:${PORT}`}`)
  );
} else {
  module.exports = app; // Vercel importa o Express daqui
}
