import { NextFunction, Request, Response } from 'express';
import { SummarizationResponse } from '../types/summarization.types.js';
import logger from '../utils/logger.js';
import { upload } from '../middleware/multer.middleware.js';
import { summarizationSchema } from '../utils/validation.js';
import { z } from 'zod';
import { AppError } from '../types/error.type.js';
import { SummarizationService } from '../services/summarization.service.js';

export class SummarizationController {
  private summarizationService: SummarizationService;

  constructor() {
    this.summarizationService = new SummarizationService();
  }

  async summarize(req: Request, res: Response, next: NextFunction) {
    try {
      const { detailLevel, userId } = summarizationSchema.parse(req.body);
      // if (!req.file) {
      //   return res.status(400).json({ error: 'file required' });
      // }
      logger.info(`Received request to summarize file with detail level: ${detailLevel} and userId: ${userId}`);

      const response: SummarizationResponse = await this.summarizationService.processFile(
        detailLevel,
        userId,
      );

      res.json(response);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logger.error("Validation error:", error.errors);
        return res.status(400).json({
          success: false,
          message: "Invalid input",
          errors: error.errors,
        });
      }
      logger.error("Summarization error:", error);
      throw new AppError('Summarization error', 500);
    }
  }
}

export const summarizationController = new SummarizationController();