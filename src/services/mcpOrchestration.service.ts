
import Record from '../models/Record';
import User from '../models/User';
import { DetailLevel, SummarizationResponse } from '../types/summarization.types';
import logger from '../utils/logger';
import { LLMService } from './llm.service';
import { S3Service } from './s3.service';
import { TextractService } from './textract.service';

export class MCPOrchestrationService {
  private s3Service: S3Service;
  private textractService: TextractService;
  private llmService: LLMService;

  constructor() {
    this.s3Service = new S3Service();
    this.textractService = new TextractService();
    this.llmService = new LLMService();
  }

  async processFile(
    file: Express.Multer.File,
    detailLevel: DetailLevel,
    userId: string,
  ): Promise<SummarizationResponse> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('user not found');
    }

    const s3Key = await this.s3Service.uploadFile(file);
    const text = await this.textractService.extractText(s3Key, file.originalname);
    const summary = await this.llmService.summarizeText(text, detailLevel);

    const record = await Record.create({
      userId,
      mediaType: file.mimetype.includes('pdf') ? 'pdf' : 'doc',
      mediaName: file.originalname,
    });

    logger.info(`processed file ${file.originalname} for user ${userId}`);
    return { summary, recordId: record.id };
  }
}