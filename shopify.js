// shopify.js
const { shopifyApp } = require('@shopify/shopify-app-express');
const { LATEST_API_VERSION } = require('@shopify/shopify-api');
const { MongoClient } = require('mongodb');
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

let sessionStorage;
if (MONGO_URI) {
  // cria um cliente e reaproveita (evita confusões de versão)
  const mongoClient = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  // importante: a lib aceita MongoClient ou URI string; usando o client evita surpresas
  sessionStorage = new MongoDBSessionStorage(mongoClient, {
    databaseName: MONGO_DB,
    collectionName: 'shopify_sessions',
  });
} else {
  const { MemorySessionStorage } = require('@shopify/shopify-app-session-storage-memory');
  sessionStorage = new MemorySessionStorage();
}

const shopify = shopifyApp({
  api: {
    apiKey:       SHOPIFY_API_KEY,
    apiSecretKey: SHOPIFY_API_SECRET,
    apiVersion:   resolvedApiVersion,
    scopes: (SHOPIFY_SCOPES || '').split(',').map(s => s.trim()).filter(Boolean),
    hostScheme:   SHOPIFY_HOST_SCHEME,
    hostName:     (SHOPIFY_HOST_NAME || '').replace(/^https?:\/\//, ''),
  },
  auth: { path: '/api/auth', callbackPath: '/api/auth/callback' },
  webhooks: { path: '/api/webhooks' },
  sessionStorage,
});

module.exports = { shopify };
