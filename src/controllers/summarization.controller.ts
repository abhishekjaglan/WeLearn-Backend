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
import { URLProcessingService } from '../services/url.service.js';

export class SummarizationController {
  private summarizationService: SummarizationService;
  private s3Client: S3Client;
  private llmService: LLMService;
  private urlProcessingService: URLProcessingService;

  constructor() {
    this.summarizationService = new SummarizationService();
    this.s3Client = AWSAuth.getS3Client();
    this.llmService = new LLMService();
    this.urlProcessingService = new URLProcessingService();
  }

  async summarize(req: Request, res: Response, next: NextFunction) {
    try {
      // check if both types and detailLevel are present
      if (!req.body.detailLevel || !req.body.type) {
        logger.error("Request body does not contain 'type or detailLevel'");
        return res.status(400).json({ error: '"type and detailLevel" required' });
      }
      const detailLevel = req.body.detailLevel;
      const type = req.body.type;
      logger.info("Parsed data: ", { detailLevel, type });

      // Check which fields are present
      const hasUrl = !!req.body.url;
      const hasText = !!req.body.text;
      const hasFile = !!req.file;

      // Validation: Ensure only one input source is provided
      const inputCount = [hasUrl, hasText, hasFile].filter(Boolean).length;
      if (inputCount === 0) {
        logger.error("No input source provided");
        return res.status(400).json({ error: 'At least one input source required: url, text, or file' });
      }
      if (inputCount > 1) {
        logger.error("Multiple input sources provided");
        return res.status(400).json({ error: 'Only one input source allowed at a time' });
      }

      // Validation: Ensure the correct field matches the specified type
      if (type === Types.URL && !hasUrl) {
        logger.error("Type 'url' specified but no url field provided");
        return res.status(400).json({ error: 'url field required when type is "url"' });
      }
      if (type === Types.TEXT && !hasText) {
        logger.error("Type 'text' specified but no text field provided");
        return res.status(400).json({ error: 'text field required when type is "text"' });
      }
      if (type === Types.FILE && !hasFile) {
        logger.error("Type 'file' specified but no file field provided");
        return res.status(400).json({ error: 'file field required when type is "file"' });
      }

      let file: Express.Multer.File | undefined;
      let summary: string | undefined;

      // url
      if (type === Types.URL) {
         // TODO: Implement URL handling
         if (!req.body.url) {
          logger.error("Request body does not contain 'url' for type 'url'");
          return res.status(400).json({ error: 'url field required' });
        }
        const url = req.body.url;
        const extractedText = await this.urlProcessingService.processURL(url);
        summary = await this.llmService.summarizeExtractedText(extractedText, detailLevel, url, type);
      // text
      } else if (type === Types.TEXT) {
        if (!req.body.text) {
          logger.error("Request body does not contain 'text' for type 'text'");
          return res.status(400).json({ error: 'text field required' });
        }

        const text = req.body.text;
        logger.info("Received text for summarization: ", text);
        summary = await this.llmService.summarizeExtractedText(text, detailLevel, 'TEXT', type);
      // file  
      } else if (type === Types.FILE) { 
        if(!req.file) {
          logger.error("Request body does not contain 'file' for type 'file'");
          return res.status(400).json({ error: 'file field required' });
        }
        file = req.file;
        const content = await this.summarizationService.processFile(
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