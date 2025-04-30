import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import logger from './utils/logger';
import helmet from 'helmet';
import { errorMiddleware } from './middleware/error.middleware';
import router from './route';
import { config } from './utils/config';

dotenv.config();

const app = express();
const PORT = config.PORT;

app.use(express.json());
app.use(helmet());
await connectDB();

app.get('/health', async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'WeLearn Backend is running',
  });
});

app.use('/api', router);

app.use(errorMiddleware);

app.listen(PORT, (err) => {
  if (err) {
    console.error(`Error starting backend server!`);
  }
  logger.info(`WeLearn backend server running on port ${PORT}!`);
});
