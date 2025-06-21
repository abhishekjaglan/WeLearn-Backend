import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import logger from './utils/logger.js';
import errorMiddleware from './middleware/error.middleware.js';
import { router } from './route.js';
import { config } from './utils/config.js';
import { connectDB } from './config/database.js';


dotenv.config();

const app = express();
const PORT = config.PORT;

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
// app.use(express.static('public'));

app.get('/health', async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'WeLearn Backend is running',
  });
});

app.use('/api', router);

app.use(errorMiddleware);

app.listen(PORT, async (err) => {
  if (err) {
    console.error(`Error starting backend server!`);
  }
  logger.info(`WeLearn backend http server running on port ${PORT}!`);
  await connectDB();
});
