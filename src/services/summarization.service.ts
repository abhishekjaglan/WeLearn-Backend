
import { DetailLevel, SummarizationResponse } from "../types/summarization.types.js";
import { TextractService } from "./textract.service.js";
import { LLMService } from "./llm.service.js";
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

  async processFile(detailLevel: DetailLevel, file: Express.Multer.File): Promise<SummarizationResponse> {
    try {

      logger.info(`Processing request to process document for detailLevel: ${detailLevel}`);
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
      // Step 5: Summarize text
      // const summary = await this.llmService.summarizeExtractedText(stitchedText, detailLevel, hashKey);

      // const record = await this.recordService.createRecord(
      //   userId,
      //   {
      //     // mediaType: file?.mimetype.includes('pdf') ? 'pdf' : 'doc', // Remove ? when using dynamic file
      //     mediaType: 'pdf', // Remove when using dynamic file
      //     mediaName: file?.originalname || 'Resume Latest.pdf', // Remove ? when using dynamic file
      //   }
      // );
      // logger.info(`Record created with ID: ${record.id}`);

      return {
        stitchedText: stitchedText,
        // recordId: record.id,
      };
    } catch (error) {
      console.error('Error processing file:', error);
      throw error;

    }
  }

  // async processURL(detailLevel: DetailLevel, text: string): Promise<SummarizationResponse> {
  //   try {
  //     logger.info(`Processing request to summarize URL for detailLevel: ${detailLevel}`);
  //     // Step 1: Extract text from URL
  //     const extractedText = await this.llmService.extractTextFromURL(text);
  //     // Step 2: Stitch text from blocks
  //     const stitchedText = await this.llmService.stitchTextFromBlocks(extractedText);

  //     return {
  //       stitchedText: stitchedText,
  //     };
  //   } catch (error) {
  //     console.error('Error processing URL:', error);
  //     throw error;
  //   }
  // }
  
}