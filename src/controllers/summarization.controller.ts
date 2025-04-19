import { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { DetailLevel, SummarizationResponse } from '../types/summarization.types';
import { MCPOrchestrationService } from '../services/mcpOrchestration.service';
import logger from '../utils/logger';
import { upload } from '../middleware/multer.middleware';
import { summarizationSchema } from '../utils/validation';

export class SummarizationController {
  private orchestrationService: MCPOrchestrationService;

  constructor() {
    this.orchestrationService = new MCPOrchestrationService();
  }

  summarize = [
    upload.single('file'),
    async (req: Request, res: Response) => {
      try {
        const { detailLevel, userId } = summarizationSchema.parse(req.body);
        if (!req.file) {
          return res.status(400).json({ error: 'file required' });
        }

        const response: SummarizationResponse = await this.orchestrationService.processFile(
          req.file,
          detailLevel,
          userId,
        );

        res.json(response);
      } catch (error) {
        logger.error(`summarization error: ${error}`);
        res.status(500).json({ error: 'internal server error' });
      }
    },
  ];
}