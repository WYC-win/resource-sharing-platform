module.exports = (req, res) => {
  res.json({ ip: req.ip, ips: req.ips, trust: req.app.get("trust proxy") });
};
