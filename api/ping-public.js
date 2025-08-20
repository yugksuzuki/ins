// Serverless Function independente do Express
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify({
    ok: true,
    message: 'pong (public)',
    ts: Date.now()
  }));
};
