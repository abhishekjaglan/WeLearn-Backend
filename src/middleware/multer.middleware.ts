import { Request } from 'express';
import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    // Documents
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    // Images
    'image/png', 
    'image/jpeg', 
    'image/tiff',
    // Audio files
    'audio/mpeg',      // .mp3
    'audio/mp4',       // .m4a
    'audio/wav',       // .wav
    'audio/flac',      // .flac
    'audio/ogg',       // .ogg
    'audio/webm',      // .webm
    'audio/x-m4a',     // alternative .m4a
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC/DOCX, PNG, JPEG, TIFF, and audio files (MP3, M4A, WAV, FLAC, OGG, WebM) are allowed.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for audio files
});