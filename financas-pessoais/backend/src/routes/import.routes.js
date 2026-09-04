const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function decodeBuffer(buffer) {
  const utf8 = buffer.toString('utf8');
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  return buffer.toString('latin1');
}

function detectDelimiter(sampleLine) {
  const semicolons = (sampleLine.match(/;/g) || []).length;
  const commas = (sampleLine.match(/,/g) || []).length;
  const tabs = (sampleLine.match(/\t/g) || []).length;
  if (tabs > semicolons && tabs > commas) return '\t';
  return semicolons >= commas ? ';' : ',';
}

// POST /api/import/preview  (multipart/form-data, campo "file")
router.post('/preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const text = decodeBuffer(req.file.buffer).trim();
  if (!text) return res.status(400).json({ error: 'Arquivo vazio' });

  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = detectDelimiter(firstLine);

  let records;
  try {
    records = parse(text, {
      delimiter,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    return res.status(400).json({ error: 'Não foi possível ler o CSV: ' + err.message });
  }

  if (!records.length) return res.status(400).json({ error: 'Arquivo sem linhas' });

  const looksLikeHeader = records[0].some((cell) => cell && /[a-zA-ZÀ-ÿ]/.test(cell));
  const headers = looksLikeHeader
    ? records[0].map((h, i) => h || `Coluna ${i + 1}`)
    : records[0].map((_, i) => `Coluna ${i + 1}`);
  const dataRows = looksLikeHeader ? records.slice(1) : records;

  const MAX_ROWS = 2000;
  const rows = dataRows.slice(0, MAX_ROWS);

  res.json({
    headers,
    rows,
    totalRows: dataRows.length,
    truncated: dataRows.length > MAX_ROWS,
    delimiter,
  });
});

module.exports = router;
