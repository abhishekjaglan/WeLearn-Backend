import { NextFunction, Request, Response } from 'express';
import { SummarizationResponse } from '../types/summarization.types.js';
import logger from '../utils/logger.js';
import { summarizationSchema, Types } from '../utils/validation.js';
import { z } from 'zod';
import { AppError } from '../types/error.type.js';
import { SummarizationService } from '../services/summarization.service.js';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { AWSAuth } from '../utils/awsAuth.js';
import fs from 'fs';
import { LLMService } from '../services/llm.service.js';

export class SummarizationController {
  private summarizationService: SummarizationService;
  private s3Client: S3Client;
  private llmService: LLMService;

  constructor() {
    this.summarizationService = new SummarizationService();
    this.s3Client = AWSAuth.getS3Client();
    this.llmService = new LLMService();
  }

  async summarize(req: Request, res: Response, next: NextFunction) {
    try {
      // check if both types and detailLevel are present
      if (!req.body.data) {
        logger.error("Request body does not contain 'types or detailLevel'");
        return res.status(400).json({ error: '"types and detailLevel" required' });
      }
      const data = JSON.parse(req.body.data);
      logger.info("Parsed data: ", data);
      const { detailLevel, type } = summarizationSchema.parse(data);
      let file: Express.Multer.File | undefined;
      let summary: string | undefined;

      // if url
      if (type === Types.URL) {
         // TODO: Implement URL handling
          return res.status(400).json({ error: 'URL type not yet implemented' });
          // if text
      } else if (type === Types.TEXT) {
        if (!req.body.text) {
          logger.error("Request body does not contain 'text' for type 'text'");
          return res.status(400).json({ error: 'text field required' });
        }

        const text = req.body.text;
        logger.info("Received text for summarization: ", text);
        summary = await this.llmService.summarizeExtractedText(text, detailLevel, 'TEXT', type);
        // if file  
      } else if (type === Types.FILE) { 
        if(!req.file) {
          logger.error("Request body does not contain 'file' for type 'file'");
          return res.status(400).json({ error: 'file field required' });
        }
        file = req.file;
        const content = await this.summarizationService.processFile(
          detailLevel,
          file
        );
        summary = await this.llmService.summarizeExtractedText(content.stitchedText as string, detailLevel, file.originalname, type);
      }

      if(!summary){
        logger.error("Failed to generate summary");
        return res.status(500).json({ error: 'Failed to generate summary' });
      }


      res.status(200).json({
        response : summary
      });
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

  async verifyS3File(bucket: string, key: string) {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await this.s3Client.send(command);
    const body = await this.streamToBuffer(response.Body); // Convert stream to buffer
    await fs.promises.writeFile(`./s3-download-${key}`, body);
    console.log(`Downloaded S3 file as ./s3-download-${key}`);
  }

  // Helper to convert stream to buffer
  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

export const summarizationController = new SummarizationController();