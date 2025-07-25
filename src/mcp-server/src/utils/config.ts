import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the parent directory
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export const config = {
  // AWS
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  // Gemini - LLM
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
};
