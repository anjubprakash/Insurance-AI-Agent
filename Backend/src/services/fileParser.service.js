import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

// Use createRequire to safely import CommonJS packages in Node.js ESM modules
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
import mammoth from 'mammoth';
import { ApiError } from '../utils/apiError.js';

/**
 * Calculate SHA-256 hash of a file for duplicate detection
 * This ensures identical files are not indexed multiple times into MongoDB or Qdrant
 */
export const calculateFileHash = (filePath) => {
  // Read physical file contents into a memory buffer
  const fileBuffer = fs.readFileSync(filePath);
  // Create SHA-256 cryptographic hash instance
  const hashSum = crypto.createHash('sha256');
  // Update hash with file bytes
  hashSum.update(fileBuffer);
  // Return hexadecimal string representation
  return hashSum.digest('hex');
};

/**
 * Extract raw text from PDF (.pdf), Word (.docx, .doc), Excel (.xlsx, .xls, .csv), or Plain Text (.txt)
 * Returns clean, structured text ready for AI Gatekeeper validation and chunking
 */
export const extractTextFromFile = async (filePath) => {
  // Extract lowercased file extension (e.g. .pdf, .xlsx, .docx)
  const ext = path.extname(filePath).toLowerCase();

  try {
    // ----------------------------------------------------
    // 1. PDF Document Parsing
    // ----------------------------------------------------
    if (ext === '.pdf') {
      // Read binary buffer of PDF file
      const buffer = fs.readFileSync(filePath);
      // Parse PDF pages into raw text stream
      const data = await pdfParse(buffer);
      const extracted = data.text || '';
      return cleanExtractedText(extracted);
    }

    // ----------------------------------------------------
    // 2. Word Document Parsing (.docx, .doc)
    // ----------------------------------------------------
    else if (ext === '.docx' || ext === '.doc') {
      // Extract raw text from Word document using Mammoth
      const result = await mammoth.extractRawText({ path: filePath });
      const extracted = result.value || '';
      return cleanExtractedText(extracted);
    }

    // ----------------------------------------------------
    // 3. Excel Spreadsheet Parsing (.xlsx, .xls, .csv)
    // ----------------------------------------------------
    else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      // Parse Excel workbook from file path
      const workbook = XLSX.readFile(filePath);
      let excelText = '';

      // Loop through all sheets in the Excel workbook
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        // Convert spreadsheet rows into 2D array of cells (header: 1 means raw array rows)
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (!rawRows || rawRows.length === 0) continue;

        // Add sheet section header
        excelText += `\n\n======================================================\n`;
        excelText += `SHEET: ${sheetName}\n`;
        excelText += `======================================================\n`;

        // The first row typically represents column headers (e.g., Plan, Cover Limit, Deductible, Waiting Period)
        const headers = rawRows[0] || [];

        // Iterate through each data row in the spreadsheet
        for (let r = 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          // Skip empty or blank rows
          if (!row || row.length === 0 || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
            continue;
          }

          // Build a readable record pairing column header with its cell value
          const rowItems = [];
          headers.forEach((headerName, colIdx) => {
            const cellValue = row[colIdx];
            if (cellValue !== undefined && cellValue !== null && String(cellValue).trim() !== '') {
              const label = headerName ? String(headerName).trim() : `Column ${colIdx + 1}`;
              rowItems.push(`${label}: ${String(cellValue).trim()}`);
            }
          });

          // Append formatted row entry as a distinct policy clause section
          if (rowItems.length > 0) {
            excelText += `\nSECTION: ${sheetName} - Row ${r}\n`;
            excelText += rowItems.join('\n') + '\n';
          }
        }
      }

      // Return formatted tabular text
      return cleanExtractedText(excelText);
    }

    // ----------------------------------------------------
    // 4. Plain Text File Parsing (.txt)
    // ----------------------------------------------------
    else if (ext === '.txt') {
      // Read plain UTF-8 text file directly from disk
      const content = fs.readFileSync(filePath, 'utf-8');
      return cleanExtractedText(content);
    }

    // ----------------------------------------------------
    // 5. Unsupported Extension Fallback
    // ----------------------------------------------------
    else {
      throw ApiError.badRequest(
        `Unsupported file format: ${ext}. Supported formats are PDF, DOCX, XLSX, XLS, CSV, and TXT.`
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.badRequest(`Failed to parse document content: ${error.message}`);
  }
};

/**
 * Normalize whitespace, carriage returns, and clean up line endings
 */
const cleanExtractedText = (text) => {
  return text
    .replace(/\r\n/g, '\n') // Normalize Windows line breaks
    .replace(/\r/g, '\n') // Normalize legacy Mac line breaks
    .replace(/\t/g, ' ') // Convert tabs to single spaces
    .replace(/[^\S\n]+/g, ' ') // Collapse multiple spaces
    .replace(/\n{3,}/g, '\n\n') // Collapse excessive blank lines
    .trim();
};
