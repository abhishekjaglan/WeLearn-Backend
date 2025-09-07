
import { SummarizationResponse } from "../types/summarization.types.js";
import { TextractService } from "./textract.service.js";
// import { LLMService } from "./llm.service.js";
import { S3Service } from "./s3.service.js";
import logger from "../utils/logger.js";
import { RecordService } from "./record.service.js";

// 1-generate s3Key
// 2- read and upload file to s3 (send s3key)
// 3 - extract text from s3 (send s3key)(res: extracted text (blocks))
// 4 - stitch text from blocks (send extracted text) (res: stitched text)
// 5 - summarize text (send stitchedf text, detailLevel) (res: summary)

export class SummarizationService {
  private textractService: TextractService;
  private s3Service: S3Service;
  private recordService: RecordService;

  constructor() {
    this.textractService = new TextractService();
    this.s3Service = new S3Service();
    this.recordService = new RecordService();
  }

  async processFile(file: Express.Multer.File): Promise<SummarizationResponse> {
    try {

      logger.info(`Processing request to process document for text extraction and summarization for detailLevel`);
      // Step 1: Generate S3 key
      const hashKey = `${file.originalname}`;
      // Step 2: Upload file to S3
      await this.s3Service.uploadFileToS3(hashKey, file);
      // Step 3: Extract text from S3
      const extractedText = await this.textractService.textract(hashKey);
      // Step 4: Stitch text from blocks
      let stitchedText : string;
      if(extractedText.Blocks.length > 0) {
        stitchedText = await this.textractService.stitchTextFromBlocks(extractedText.Blocks, hashKey);
      }else {
        stitchedText = extractedText.redisText;
      }

      return {
        stitchedText: stitchedText,
        // recordId: record.id,
      };
    } catch (error) {
      console.error('Error processing file:', error);
      throw error;

    }
  }
  
}