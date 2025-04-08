import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import logger from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());
await connectDB();

app.get('/health', async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'WeLearn Backend is running',
  });
});

app.listen(PORT, (err) => {
  if (err) {
    console.error(`Error starting backend server!`);
  }
  logger.info(`WeLearn backend server running on port ${PORT}!`);
});
