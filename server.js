// server.js (apenas dev local)
require('dotenv').config();
const app = require('./app');
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Local dev at http://localhost:${PORT}`);
});
