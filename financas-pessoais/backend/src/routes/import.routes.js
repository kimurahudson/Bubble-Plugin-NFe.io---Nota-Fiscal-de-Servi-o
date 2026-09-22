const express = require('express');
const multer = require('multer');
const path = require('path');
const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
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

function isXlsxFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.xlsx') return true;
  return file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

function cellToString(cell) {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) {
    const y = cell.getFullYear();
    const m = String(cell.getMonth() + 1).padStart(2, '0');
    const d = String(cell.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof cell === 'object') {
    if ('result' in cell) return cellToString(cell.result);
    if ('text' in cell) return String(cell.text ?? '');
    if (Array.isArray(cell.richText)) return cell.richText.map((rt) => rt.text).join('');
    return '';
  }
  return String(cell);
}

// Lê a primeira planilha do arquivo .xlsx e devolve as linhas como texto,
// no mesmo formato (array de arrays de string) que o parser de CSV produz.
async function parseXlsxBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows = [];
  let maxCols = 0;
  worksheet.eachRow((row) => {
    const values = row.values.slice(1).map(cellToString);
    maxCols = Math.max(maxCols, values.length);
    rows.push(values);
  });

  return rows
    .map((row) => {
      while (row.length < maxCols) row.push('');
      return row;
    })
    .filter((row) => row.some((cell) => cell !== ''));
}

// POST /api/import/preview  (multipart/form-data, campo "file")
router.post('/preview', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  let records;
  if (isXlsxFile(req.file)) {
    try {
      records = await parseXlsxBuffer(req.file.buffer);
    } catch (err) {
      return res.status(400).json({ error: 'Não foi possível ler o XLSX: ' + err.message });
    }
  } else {
    const text = decodeBuffer(req.file.buffer).trim();
    if (!text) return res.status(400).json({ error: 'Arquivo vazio' });

    const firstLine = text.split(/\r?\n/, 1)[0];
    const delimiter = detectDelimiter(firstLine);
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
  });
});

module.exports = router;
