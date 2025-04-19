import { MCPClient } from '../utils/mcp';
import { MCPLLMInput, MCPLLMOutput, DetailLevel } from '../types/summarization.types';
import logger from '../utils/logger';

export class LLMService {
  private client: MCPClient;

  constructor() {
    this.client = new MCPClient({
      host: 'gemini-mcp',
      port: parseInt(process.env.MCP_LLM_PORT!),
    });
  }

  async summarizeText(text: string, detailLevel: DetailLevel): Promise<string> {
    const input: MCPLLMInput = { text, detailLevel };
    const output = await this.client.call<MCPLLMInput, MCPLLMOutput>('summarizeText', input);
    logger.info(`summarized text for ${detailLevel}`);
    return output.summary;
  }
}