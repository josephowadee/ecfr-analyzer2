// backend/index.js
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const mongoose   = require('mongoose');
const axios      = require('axios');
const Regulation = require('./models/Regulation');

const app = express();
app.use(cors());
app.use(express.json());

// Health check for Render (and any uptime monitoring)
app.get('/healthz', (_req, res) => res.send('OK'));

// Sanity‐check endpoints
app.get('/',    (_req, res) => res.send('🚀 eCFR Analyzer Backend is working'));
app.get('/ping', (_req, res) => res.send('pong'));

// 1) Connect to MongoDB (forcing 'ecfr' database)
mongoose
  .connect(process.env.MONGO_URI, { dbName: 'ecfr' })
  .then(() => console.log('✅ MongoDB connected to ecfr'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// 2) Only start Express once MongoDB is open
mongoose.connection.once('open', () => {
  console.log('✅ Mongoose connection is open; starting API…');

  // 3a) List all agencies (Titles), sorted numerically
  app.get('/api/agencies', async (_req, res) => {
    try {
      const agencies = await Regulation.distinct('agency');
      agencies.sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0], 10);
        const numB = parseInt(b.match(/\d+/)[0], 10);
        return numA - numB;
      });
      res.json(agencies);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3b) Latest metrics for one agency
  app.get('/api/agencies/:agency/metrics', async (req, res) => {
    try {
      const [doc] = await Regulation
        .find({ agency: req.params.agency })
        .sort({ versionDate: -1 })
        .limit(1);
      if (!doc) return res.status(404).json({ error: 'Agency not found' });
      const { wordCount, checksum, refDensity, defFreq } = doc;
      res.json({ wordCount, checksum, refDensity, defFreq });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3c) Historical word counts for an agency
  app.get('/api/agencies/:agency/history', async (req, res) => {
    try {
      const history = await Regulation
        .find({ agency: req.params.agency })
        .sort({ versionDate: 1 })
        .select('versionDate wordCount -_id');
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3d) Pull Title metadata from the eCFR API
  app.get('/api/titles', async (_req, res) => {
    try {
      const { data } = await axios.get(
        'https://www.ecfr.gov/api/versioner/v1/titles.json'
      );
      const titles = data.titles.map(t => ({
        number: t.number,
        name:   t.name
      }));
      titles.sort((a, b) => a.number - b.number);
      res.json(titles);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4) Start the server on the right port
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 API listening on port ${PORT}`));
});