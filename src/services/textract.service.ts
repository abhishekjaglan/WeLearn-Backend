import { MCPTextractInput, MCPTextractOutput } from '../types/summarization.types';
import logger from '../utils/logger';
import { MCPClient } from '../utils/mcp';

export class TextractService {
  private client: MCPClient;

  constructor() {
    this.client = new MCPClient({
      host: 'textract-mcp',
      port: parseInt(process.env.MCP_TEXTRACT_PORT!),
    });
  }

  async extractText(s3Key: string, fileName: string): Promise<string> {
    const input: MCPTextractInput = { s3Key, fileName };
    const output = await this.client.call<MCPTextractInput, MCPTextractOutput>('extractText', input);
    logger.info(`extracted text for ${fileName}`);
    return output.text;
  }
}
