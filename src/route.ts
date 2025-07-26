import { Router } from "express";
import userRouter from "./routes/user.route.js";
import recordRouter from "./routes/record.route.js";
import summarizeRouter from "./routes/summarize.route.js";
import chatRouter from "./routes/chat.route.js";

export const router = Router();

router.use('/user', userRouter);
router.use('/record', recordRouter);
router.use('/summarize', summarizeRouter);
router.use('/chat', chatRouter);

// router.get('/health', async (req: Request, res: Response) => {
//   const health = {
//     status: 'healthy',
//     timestamp: new Date().toISOString(),
//     services: {
//       mcp: false,
//       redis: false,
//       functions: 0
//     }
//   };

//   try {
//     // Check MCP connection
//     if (mcpClientService.isConnected) {
//       health.services.mcp = true;
//       health.services.functions = mcpClientService.functionDefinitions.length;
//     } else {
//       health.status = 'degraded';
//     }

//     // Check Redis connection
//     try {
//       await redisClient.ping();
//       health.services.redis = true;
//     } catch (error) {
//       logger.error('Redis health check failed:', error);
//       health.status = 'degraded';
//     }

//     const statusCode = health.status === 'healthy' ? 200 : 503;
//     res.status(statusCode).json(health);

//   } catch (error) {
//     logger.error('Health check failed:', error);
//     res.status(503).json({
//       status: 'unhealthy',
//       timestamp: new Date().toISOString(),
//       error: error instanceof Error ? error.message : 'Unknown error'
//     });
//   }
// });