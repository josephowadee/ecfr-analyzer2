// Regulation model schema
//  Notes:
// - Each document represents a snapshot of one Title’s regulations on a given date.
// - We only store metrics (not the full text) to keep the database lean and focused.
// - These fields allow our UI to show trends, compare agencies, and surface risk.
// ────────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const regulationSchema = new mongoose.Schema({
  agency:       { type: String, required: true },  // e.g. "Title 40" – identifies which agency set
  title:        { type: String, required: true },  // title
  versionDate:  { type: Date,   required: true },  // snapshot date from eCFR
  wordCount:    { type: Number, required: true },  // total words 
  checksum:     { type: String, required: true },  // SHA-256 (data integrity)
  refDensity:   { type: Number, required: true },  // my custom: cross-refs per 1k words
  defFreq:      { type: Number, required: true }   // my custom: defined-term frequency
});

module.exports = mongoose.model('Regulation', regulationSchema);