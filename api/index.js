// api/index.js
const app = require('../app');
module.exports = (req, res) => app(req, res); // usa o Express como handler
