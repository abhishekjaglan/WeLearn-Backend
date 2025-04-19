import { MCPServer } from '../../utils/mcp';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { redisClient } from '../../utils/redisClient';
import logger from '../../utils/logger';
import { DetailLevel, MCPLLMInput, MCPLLMOutput } from '../../types/summarization.types';

export class GeminiMCPServer {
  private server: MCPServer;
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.server = new MCPServer({
      port: parseInt(process.env.MCP_LLM_PORT!),
      auth: { type: 'none' },
    });
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async start() {
    this.server.registerMethod('summarizeText', async (input: MCPLLMInput): Promise<MCPLLMOutput> => {
      const cacheKey = `llm:${input.text.slice(0, 50)}:${input.detailLevel}`;
      const cachedSummary = await redisClient.get(cacheKey);
      if (cachedSummary) {
        logger.info(`cache hit for ${cacheKey}`);
        return { summary: cachedSummary };
      }

      const maxTokens = {
        [DetailLevel.SHORT]: 100,
        [DetailLevel.MEDIUM]: 250,
        [DetailLevel.DETAILED]: 500,
      }[input.detailLevel];

      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `Summarize the following text in ${input.detailLevel} detail, max ${maxTokens} words, focusing on key points:\n${input.text}`;
      const result = await model.generateContent(prompt);

      const summary = result.response.text();
      await redisClient.set(cacheKey, summary, 3600);  // Cache for 1 hour
      logger.info(`generated summary size for ${input.detailLevel}: ${summary.length} characters`);
      return { summary: summary };
    });

    await this.server.start();
    logger.info(`gemini mcp server running on port ${process.env.MCP_LLM_PORT}`);
  }
}

const geminiServer = new GeminiMCPServer();
geminiServer.start();