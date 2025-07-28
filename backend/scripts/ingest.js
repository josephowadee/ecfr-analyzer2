// ────────────────────────────────────────────────────────────────────────────────
// eCFR Ingestion Script
// Notes:
// - Automatically fetches every Title’s up-to-date XML from the official eCFR API.
// - Extracts key metrics (word count, cross-reference density, defined-term frequency).
// - Stores only the metrics in MongoDB for fast analysis and low cost.
// ────────────────────────────────────────────────────────────────────────────────

require('dotenv').config();             // Load MONGO_URI & other secrets
const axios    = require('axios');       // To make HTTP requests
const xml2js   = require('xml2js');      // To parse XML into JS objects
const mongoose = require('mongoose');    // MongoDB ORM
const crypto   = require('crypto');      // For SHA-256 checksums
const Regulation = require('../models/Regulation');

// Prepare the XML parser
const parser = new xml2js.Parser();

/** 
 * computeChecksum
 * Hiring Manager Notes:
 * - Generates a SHA-256 fingerprint of the regulation text.
 * - Ensures we can detect any accidental or malicious changes over time.
 */
function computeChecksum(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** 
 * getLatestVersionDate(titleNumber)
 * Hiring Manager Notes:
 * - Calls eCFR’s titles endpoint to find the “up_to_date_as_of” date.
 * - Honors import-in-progress warnings so we know if data may be incomplete.
 */
async function getLatestVersionDate(titleNumber) {
  const { data } = await axios.get(
    'https://www.ecfr.gov/api/versioner/v1/titles.json'
  );
  const meta = data.titles.find(t => t.number === titleNumber);
  if (!meta) throw new Error(`Title ${titleNumber} not found`);
  if (data.meta.import_in_progress) {
    console.warn('⚠️ Import in progress; data may be stale');
  }
  return meta.up_to_date_as_of;
}

/** 
 * fetchTitle
 * Hiring Manager Notes:
 * - Downloads the full XML for a Title at the specified date.
 * - Extracts only the regulation “sections” (skips appendices / metadata).
 * - Returns plain text ready for metric computation.
 */
async function fetchTitle(titleNumber) {
  try {
    const versionDate = await getLatestVersionDate(titleNumber);
    const url = `https://www.ecfr.gov/api/versioner/v1/full/${versionDate}/title-${titleNumber}.xml`;
    const { data: xml } = await axios.get(url, { responseType: 'text' });
    const result = await parser.parseStringPromise(xml);

    // Pull out each section’s label + paragraphs
    const sections = (result?.regulation?.section || []).map(sec => {
      const label = sec.$?.label || '';
      const para  = Array.isArray(sec.paragraph)
        ? sec.paragraph.map(p => p._ || '').join('\n')
        : '';
      return (label + ' ' + para).trim();
    });

    const content = sections.length
      ? sections.join('\n\n')
      : xml;  // fallback if parsing fails

    return {
      agency:      `Title ${titleNumber}`,                     // map number → agency
      title:       result?.regulation?.$?.title || `Title ${titleNumber}`,
      versionDate: new Date(versionDate),
      content
    };
  } catch (err) {
    console.error(`❌ Error fetching title ${titleNumber}:`, err.message);
    return null;
  }
}

/** 
 * computeRefDensity
 * Hiring Manager Notes:
 * - Calculates how “reference-heavy” the text is:  
 *   citations like “§ 123.45” per 1,000 words.
 * - High values suggest complex cross-dependencies across regulations.
 */
function computeRefDensity(content, wordCount) {
  const refs = (content.match(/§\s*\d+(\.\d+)*/g) || []).length;
  return (refs / wordCount) * 1000;
}

/** 
 * computeDefFreq
 * Hiring Manager Notes:
 * - Counts explicitly defined terms (in “quotes”) per word.
 * - High ratios point to specialized jargon and definitions burden.
 */
function computeDefFreq(content, wordCount) {
  const defs = (content.match(/“[^”]+”/g) || []).length;
  return defs / wordCount;
}

/** 
 * ingestAll
 * Hiring Manager Notes:
 * - Main entry point: fetches every CFR Title, computes all metrics,
 *   and writes a concise document per Title to MongoDB.
 */
async function ingestAll() {
  // 1) Fetch dynamic list of Titles (e.g., 1 through 50+)
  const titlesResp = await axios.get('https://www.ecfr.gov/api/versioner/v1/titles.json');
  const TITLES = titlesResp.data.titles.map(t => t.number);

  // 2) Connect to MongoDB
  await mongoose.connect(process.env.MONGO_URI);

  // 3) Loop through each Title, compute metrics, and store
  for (const t of TITLES) {
    const info = await fetchTitle(t);
    if (!info) continue;

    const { agency, title, versionDate, content } = info;
    const words = content.trim().split(/\s+/).filter(Boolean).length;

    // Compute metrics
    const refDensity = computeRefDensity(content, words);
    const defFreq    = computeDefFreq(content, words);
    const checksum   = computeChecksum(content);

    // Persist only the metrics + metadata, not raw text
    await Regulation.create({
      agency,
      title,
      versionDate,
      wordCount:  words,
      checksum,
      refDensity,
      defFreq
    });

    console.log(
      `✅ Ingested ${title} (${agency}) on ${versionDate.toISOString()} — ` +
      `Refs/1k: ${refDensity.toFixed(2)}, Defs/word: ${defFreq.toFixed(4)}`
    );
  }

  // 4) Clean up
  await mongoose.disconnect();
  console.log('✅ Done — Disconnected from MongoDB.');
}

// run this file directly, kick off the ingestion
if (require.main === module) {
  ingestAll().catch(err => {
    console.error('❌ Ingestion failed:', err);
    mongoose.disconnect();
  });
}

module.exports = { ingestAll };