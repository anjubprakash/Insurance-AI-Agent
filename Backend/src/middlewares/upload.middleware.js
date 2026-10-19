import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ApiError } from '../utils/apiError.js';

// Ensure the local uploads storage directory exists on disk
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage to assign unique timestamped filenames to prevent overwrites
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save uploaded files to the uploads directory
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique suffix using timestamp and random number
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter middleware: validates allowed extensions including Excel sheets (.xlsx, .xls, .csv)
const fileFilter = (req, file, cb) => {
  // Supported document formats: PDF, Word, Plain text, and Excel spreadsheets
  const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.xlsx', '.xls', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    // Accept file if extension is in the allowed list
    cb(null, true);
  } else {
    // Reject with a clear user error if file format is unsupported
    cb(
      ApiError.badRequest(
        `Invalid file type: ${ext}. Supported formats: PDF (.pdf), Word (.docx, .doc), Excel (.xlsx, .xls, .csv), and Text (.txt).`
      ),
      false
    );
  }
};

// Export configured Multer instance with 25MB maximum upload limit
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB max file size
  }
});
