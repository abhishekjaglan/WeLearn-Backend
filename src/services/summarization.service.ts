//TODO:

import { DetailLevel, SummarizationResponse } from "../types/summarization.types.js";
import { config } from "../utils/config.js";
import bcrypt from "bcrypt";
import { TextractService } from "./textract.service.js";
import { LLMService } from "./llm.service.js";
import { S3Service } from "./s3.service.js";
import Record from "../models/Record.js";
import logger from "../utils/logger.js";
import { RecordService } from "./record.service.js";

// 1-generate s3Key
// 2- read and upload file to s3 (send s3key)
// 3 - extract text from s3 (send s3key)(res: extracted text (blocks))
// 4 - stitch text from blocks (send extracted text) (res: stitched text)
// 5 - summarize text (send stitchedf text, detailLevel) (res: summary)

export class SummarizationService {
  private textractService: TextractService;
  private llmService: LLMService;
  private s3Service: S3Service;
  private recordService: RecordService;

  constructor() {
    this.textractService = new TextractService();
    this.llmService = new LLMService();
    this.s3Service = new S3Service();
    this.recordService = new RecordService();
  }

  async processFile(detailLevel: DetailLevel, userId: string, file?: Express.Multer.File): Promise<SummarizationResponse> {
    try {

      logger.info(`Processing request to process file with detail level: ${detailLevel} and userId: ${userId}`);
      // Step 1: Generate S3 key
      // hash of file name and userId
      // const hashText = `${file.originalname}-${userId}`;
      // const hashText = `Latest Resume.pdf-${userId}`;
      // const hashKey = await bcrypt.hash(hashText, config.BCRYPT_SALT_ROUNDS);
      const hashKey = `Latest Resume.pdf-${userId}`;
      // Step 2: Upload file to S3
      await this.s3Service.uploadPdfToS3(hashKey);
      // Step 3: Extract text from S3
      const extractedText = await this.textractService.textract(hashKey);
      // Step 4: Stitch text from blocks
      const stitchedText = await this.textractService.stitchTextFromBlocks(extractedText.Blocks, hashKey);
      // Step 5: Summarize text
      const summary = await this.llmService.summarizeExtractedText(stitchedText, detailLevel, hashKey);

      const record = await this.recordService.createRecord(
        userId,
        {
          // mediaType: file?.mimetype.includes('pdf') ? 'pdf' : 'doc', // Remove ? when using dynamic file
          mediaType: 'pdf', // Remove when using dynamic file
          mediaName: file?.originalname || 'Resume Latest.pdf', // Remove ? when using dynamic file
        }
      );
      logger.info(`Record created with ID: ${record.id}`);

      return {
        summary: summary.summary, // summary.summary,
        recordId: record.id,
      };
    } catch (error) {
      console.error('Error processing file:', error);
      throw error;

    }
  }
}