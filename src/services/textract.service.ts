import { MCPTextractInput, MCPTextractOutput } from '../types/summarization.types';
import { AWSAuth } from '../utils/awsAuth';
import logger from '../utils/logger';
import { TextractClient } from "@aws-sdk/client-textract";

export class TextractService {
  private textractClient: TextractClient;

  constructor() {
    this.textractClient = new AWSAuth.getTextractClient();
  }

  async extractText(s3Key: string, fileName: string): Promise<string> {
    const input: MCPTextractInput = { s3Key, fileName };
    const output = await this.client.call<MCPTextractInput, MCPTextractOutput>('extractText', input);
    logger.info(`extracted text for ${fileName}`);
    return output.text;
  }
}
