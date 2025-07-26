import dotenv from 'dotenv';
import path from 'path';

// Use CommonJS __dirname
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

export const config = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
};