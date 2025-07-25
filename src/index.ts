import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import logger from './utils/logger.js';
import errorMiddleware from './middleware/error.middleware.js';
import { router } from './route.js';
import { config } from './utils/config.js';
import { connectDB } from './config/database.js';
import { mcpClientService } from './services/mcp.client.service.js';

dotenv.config();

const app = express();
const PORT = config.PORT;

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'WeLearn Backend is running',
  });
});

app.use('/api', router);

app.use(errorMiddleware);

const server = app.listen(PORT, async (err?: any) => {
  if (err) {
    console.error(`Error starting backend server!`);
  }
  logger.info(`WeLearn backend http server running on port ${PORT}!`);
  
  try {
    await connectDB();
    
    // Initialize MCP client and fetch function definitions
    await mcpClientService.initialize();
    const functionDefinitions = mcpClientService.getFunctionDefinitions();
    logger.info("Available function definitions for LLM:", functionDefinitions.map(f => f.function.name));
  } catch (error) {
    logger.error('Failed to initialize services:', error);
  }
});

// Graceful shutdown
const cleanup = async () => {
  logger.info('Shutting down gracefully...');
  try {
    await mcpClientService.disconnect();
    logger.info('MCP client disconnected.');
  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
};

process.on('SIGINT', async () => {
  await cleanup();
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  await cleanup();
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});
