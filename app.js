// app.js
require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const { shopify } = require('./shopify');

const imageRoutes = require('./routes/imageRoutes');
const compareRoutes = require('./routes/compareRoutes');
const userRoutes = require('./routes/userRoutes');
const shopifyRoutes = require('./routes/shopifyRoutes');

const app = express();

/* ========= Infra básica ========= */
app.set('trust proxy', 1);
app.use(morgan('dev'));
app.use(
  cors({
    origin: [/\.myshopify\.com$/, 'https://admin.shopify.com'],
    credentials: true,
  })
);

// CSP oficial da Shopify para apps embedded
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
app.use(express.json({ limit: '10mb' }));

/* ========= Health & Debug ========= */
// Health público (top-level e sob /api)
app.get('/health', (_req, res) =>
  res.json({ ok: true, env: process.env.VERCEL ? 'vercel' : 'local', ts: Date.now() })
);
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, env: process.env.VERCEL ? 'vercel' : 'local', ts: Date.now() })
);

// Debug simples (remover depois de validar)
app.get('/debug', (_req, res) => {
  res
    .type('text/plain')
    .send(
      [
        'DEBUG',
        `VERCEL=${process.env.VERCEL ? 'yes' : 'no'}`,
        `SHOPIFY_HOST_NAME=${process.env.SHOPIFY_HOST_NAME || '(missing)'}`,
        `DEV_SHOP=${process.env.DEV_SHOP || '(missing)'}`,
        `MONGO_URI=${process.env.MONGO_URI ? 'set' : 'missing'}`,
      ].join('\n')
    );
});

/* ========= Conexão Mongo (opcional) ========= */
if (process.env.MONGO_URI) {
  const opts = {
    dbName: process.env.MONGO_DB || 'insmatch',
    serverSelectionTimeoutMS: 5000,
  };
  mongoose
    .connect(process.env.MONGO_URI, opts)
    .then(() => console.log('✅ Mongo conectado'))
    .catch((err) => console.error('⚠️ Mongo falhou (seguindo sem DB):', err.message));
}

/* ========= OAuth Shopify ========= */
const beginAuth = shopify.auth.begin();

// Início OAuth (normaliza shop e garante ?shop=...)
app.get('/api/auth', (req, res, next) => {
  const raw = String(req.query.shop ?? process.env.DEV_SHOP ?? '').trim();
  const shop = raw && raw !== 'undefined' && raw !== 'null' ? raw : '';

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

// Callback OAuth -> redireciona para /app com host+shop
app.get('/api/auth/callback', shopify.auth.callback(), (req, res) => {
  const host = req.query.host || '';
  const shop = req.query.shop || '';
  return res.redirect(
    `/app${shop ? `?shop=${encodeURIComponent(shop)}` : ''}${
      host ? `${shop ? '&' : '?'}host=${encodeURIComponent(host)}` : ''
    }`
  );
});

/* ========= Página /app (com fallback fora do Admin) ========= */
app.get('/app', (req, res) => {
  const apiKey = process.env.SHOPIFY_API_KEY || '';
  const shop = (req.query.shop || process.env.DEV_SHOP || '').trim();
  const host = (req.query.host || '').trim();

  // Fallback quando abrimos fora do Admin (sem host)
  if (!host) {
    const base = `https://${process.env.SHOPIFY_HOST_NAME || ''}`;
    return res.send(`<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>InspMatch – Setup</title>
<style>body{font-family:system-ui;padding:24px}button{padding:10px 14px;border-radius:8px;border:1px solid #ddd;cursor:pointer}code{background:#f6f6f6;padding:2px 6px;border-radius:6px}</style>
</head>
<body>
  <h1>InspMatch</h1>
  <p>Este app deve rodar dentro do Admin da Shopify. Para instalar/autenticar na sua loja dev, clique abaixo.</p>
  <p><b>Loja:</b> <code>${shop || '(defina DEV_SHOP no .env ou passe ?shop=)'}</code></p>
  <div style="display:flex;gap:12px;margin:16px 0;">
    <a href="/install?shop=${encodeURIComponent(shop || '')}"><button>Iniciar OAuth</button></a>
    <a href="/health"><button>Testar /health</button></a>
    <a href="/api/health"><button>Testar /api/health</button></a>
  </div>
  <p>Após instalar, abra o app pelo Admin que a Shopify passará o parâmetro <code>host</code> automaticamente.</p>
  <p><small>Base: ${base}</small></p>
</body>
</html>`);
  }

  // Modo embedded (com host)
  res.send(`<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>InspMatch Admin</title>
  <script src="https://unpkg.com/@shopify/app-bridge@3"></script>
  <style>body{font-family:system-ui;padding:20px}button{padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer}button:hover{background:#f7f7f7}pre{background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap}</style>
</head>
<body>
  <h1>InspMatch – Teste de API</h1>
  <p>Loja: <strong id="shop">${shop || '(?)'}</strong></p>
  <div style="display:flex; gap:12px; margin:16px 0%;">
    <button id="btnPing">Testar /api/ping</button>
    <button id="btnImport">Importar produtos (first=10)</button>
  </div>
  <pre id="out"></pre>
<script>
(function(){
  const out=document.getElementById('out');
  const params=new URLSearchParams(location.search);
  const host=params.get('host')||'${host}';
  const apiKey='${apiKey}';
  function log(x){try{out.textContent=typeof x==='string'?x:JSON.stringify(x,null,2);}catch{out.textContent=String(x);}}
  if(!apiKey){log('Faltou SHOPIFY_API_KEY');return;}
  if(!host){log('Faltou host');return;}
  const AB=window['app-bridge']||(window.Shopify&&window.Shopify.AppBridge);
  if(!AB||typeof AB.createApp!=='function'){log('App Bridge não carregou');return;}
  const app=AB.createApp({apiKey,host});
  const hasAuthFetch=!!(AB.utilities&&typeof AB.utilities.authenticatedFetch==='function');
  const hasGetToken=!!(AB.utilities&&typeof AB.utilities.getSessionToken==='function');
  async function call(path,init={}){
    log('Chamando '+path+' ...');
    try{
      let res;
      if(hasAuthFetch){ const f=AB.utilities.authenticatedFetch(app); res=await f(path,init); }
      else if(hasGetToken){ const t=await AB.utilities.getSessionToken(app); const h=new Headers(init.headers||{}); h.set('Authorization','Bearer '+t); res=await fetch(path,{...init,headers:h}); }
      else { log('Sem authenticatedFetch/getSessionToken'); return; }
      const text=await res.text(); try{ log(JSON.parse(text)); }catch{ log(text); }
    }catch(e){ log('Erro: '+(e&&e.message?e.message:e)); }
  }
  document.getElementById('btnPing').addEventListener('click',()=>call('/api/ping'));
  document.getElementById('btnImport').addEventListener('click',()=>call('/api/shopify/import-products?first=10'));
})();
</script>
</body>
</html>`);
});

/* ========= Rotas públicas úteis ========= */
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

/* ========= Normalizador de Authorization (antes da proteção) ========= */
app.use((req, _res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.includes(',')) {
    const parts = auth.split(',').map((s) => s.trim());
    const bearer = parts.find((p) => p.toLowerCase().startsWith('bearer '));
    req.headers.authorization = bearer || parts[0];
  }
  next();
});

/* ========= Proteção das APIs (sessão Shopify obrigatória) ========= */
app.use('/api', shopify.validateAuthenticatedSession());

/* ========= Rotas protegidas ========= */
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

/* ========= Error handler ========= */
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Erro interno' });
});

/* ========= Export para Vercel / Run local ========= */
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => console.log(`Local server on http://localhost:${PORT}`));
} else {
  module.exports = app;
}
