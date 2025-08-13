// scr/inspmatch_backend_melhorado/shopify.js
const { shopifyApp } = require('@shopify/shopify-app-express');
const { LATEST_API_VERSION } = require('@shopify/shopify-api');
// ⬇️ troque Memory por MongoDB
const { MongoDBSessionStorage } = require('@shopify/shopify-app-session-storage-mongodb');

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_SCOPES,
  SHOPIFY_HOST_SCHEME = 'https',
  SHOPIFY_HOST_NAME,
  SHOPIFY_API_VERSION,
  MONGO_URI,
  MONGO_DB = 'insmatch',
} = process.env;

const resolvedApiVersion = SHOPIFY_API_VERSION || LATEST_API_VERSION;
console.log('🔧 Shopify API version in use:', resolvedApiVersion);

// ✅ storage em Mongo Atlas
const sessionStorage = new MongoDBSessionStorage(MONGO_URI, {
  databaseName: MONGO_DB,
  collectionName: 'shopify_sessions',
});

const shopify = shopifyApp({
  api: {
    apiKey:       SHOPIFY_API_KEY,
    apiSecretKey: SHOPIFY_API_SECRET,
    apiVersion:   resolvedApiVersion,
    scopes: (SHOPIFY_SCOPES || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    hostScheme:   SHOPIFY_HOST_SCHEME,
    hostName:     (SHOPIFY_HOST_NAME || '').replace(/^https?:\/\//, ''),
  },
  auth: {
    path: '/api/auth',
    callbackPath: '/api/auth/callback',
  },
  webhooks: {
    path: '/api/webhooks',
  },
  sessionStorage, // ⬅️ agora é Mongo
});

module.exports = { shopify };
