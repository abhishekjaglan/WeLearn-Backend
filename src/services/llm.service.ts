import { GoogleGenerativeAI } from '@google/generative-ai';
import { DetailLevel } from '../types/summarization.types.js';
import logger from '../utils/logger.js';
import { redisClient, RedisClient } from '../utils/redisClient.js';
import { config } from '../utils/config.js';
import { ChatMessage } from './chat.service.js';
import { mcpClientService, FunctionDefinition } from './mcp.client.service.js';

export interface FunctionCallResponse {
  shouldCallFunction: boolean;
  functionName?: string;
  functionArgs?: any;
  response: string;
}

export class LLMService {
  private redisClient: RedisClient;
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.redisClient = redisClient;
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY!);
  }

  async processWithFunctionCalling(
    userMessage: string,
    context: ChatMessage[],
    documentInfo?: { s3Key: string; fileName: string; userId: string }
  ): Promise<FunctionCallResponse> {
    // Get available function definitions dynamically
    const functionDefinitions = mcpClientService.getFunctionDefinitions();
    
    if (functionDefinitions.length === 0) {
      logger.warn('No function definitions available from MCP server');
      return {
        shouldCallFunction: false,
        response: "I'm sorry, but I don't have access to any tools at the moment. Please try again later.",
      };
    }

    // Convert function definitions to Gemini format
    const tools = this.convertToGeminiTools(functionDefinitions);

    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      tools: tools.length > 0 ? tools : undefined,
    });

    const contextPrompt = this.buildContextPrompt(context);
    let prompt = `${contextPrompt}\n\nUser message: ${userMessage}`;
    
    if (documentInfo) {
      prompt += `\n\nDocument available: ${documentInfo.fileName}`;
    }

    const result = await model.generateContent(prompt);
    const response = result.response;

    // Check if the model wants to call a function
    const functionCalls = response.functionCalls();
    
    if (functionCalls && functionCalls.length > 0) {
      const functionCall = functionCalls[0];
      return {
        shouldCallFunction: true,
        functionName: functionCall.name,
        functionArgs: functionCall.args,
        response: response.text() || "I'll help you with that.",
      };
    }

    return {
      shouldCallFunction: false,
      response: response.text() || "How can I help you?",
    };
  }

  private convertToGeminiTools(functionDefinitions: FunctionDefinition[]): any[] {
    return [{
      functionDeclarations: functionDefinitions.map(def => ({
        name: def.function.name,
        description: def.function.description,
        parameters: def.function.parameters,
      }))
    }];
  }

  async processToolCallsWithLLM(
    messages: any[],
    toolCalls: any[]
  ): Promise<{ content: string; updatedMessages: any[] }> {
    const updatedMessages = [...messages];

    // Process each tool call
    for (const toolCall of toolCalls) {
      const { name, arguments: argsString } = toolCall.function;
      let parsedArgs;

      try {
        parsedArgs = JSON.parse(argsString);
      } catch (e) {
        logger.error(`Error parsing arguments for tool ${name}:`, argsString, e);
        updatedMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: name,
          content: JSON.stringify({ error: `Failed to parse arguments for tool ${name}: ${(e as Error).message}` }),
        });
        continue;
      }

      try {
        const toolResult = await mcpClientService.callTool(name, parsedArgs);
        
        updatedMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: name,
          content: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content),
        });
      } catch (toolError) {
        logger.error(`Tool call failed for ${name} with args ${JSON.stringify(parsedArgs)}:`, toolError);
        let errorMessage = `Tool ${name} execution failed.`;
        if (toolError instanceof Error) {
          errorMessage = toolError.message;
        } else if (typeof toolError === 'string') {
          errorMessage = toolError;
        }
        updatedMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: name,
          content: JSON.stringify({ error: errorMessage, details: toolError }),
        });
      }
    }

    // Generate final response with tool results
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const finalResult = await model.generateContent(
      updatedMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')
    );

    return {
      content: finalResult.response.text(),
      updatedMessages,
    };
  }

  async summarizeChunk(
    chunk: string,
    detailLevel: DetailLevel,
    context: ChatMessage[],
    chunkIndex: number,
    totalChunks: number
  ): Promise<string> {
    const cacheKey = `chunk_summary:${Buffer.from(chunk).toString('base64').slice(0, 20)}:${detailLevel}`;
    const cachedSummary = await this.redisClient.get(cacheKey);
    if (cachedSummary) {
      logger.info(`Cache hit for chunk ${chunkIndex}`);
      return cachedSummary;
    }

    const maxWords = {
      [DetailLevel.SHORT]: 50,
      [DetailLevel.MEDIUM]: 150,
      [DetailLevel.DETAILED]: 300,
    }[detailLevel];

    const contextPrompt = this.buildContextPrompt(context);
    const prompt = `${contextPrompt}

Summarize this document chunk (${chunkIndex}/${totalChunks}) in ${detailLevel} detail (max ${maxWords} words):

${chunk}`;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    await this.redisClient.set(cacheKey, summary, 3600);
    logger.info(`Generated summary for chunk ${chunkIndex}/${totalChunks}: ${summary.length} characters`);
    return summary;
  }

  async combineSummaries(
    summaries: string[],
    detailLevel: DetailLevel,
    context: ChatMessage[]
  ): Promise<string> {
    if (summaries.length === 1) {
      return summaries[0];
    }

    const combinedSummaries = summaries.join('\n\n---\n\n');
    const contextPrompt = this.buildContextPrompt(context);
    
    const prompt = `${contextPrompt}

Combine these individual summaries into one cohesive ${detailLevel} summary of the entire document:

${combinedSummaries}

Create a well-structured, comprehensive summary that maintains the ${detailLevel} level of detail requested.`;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const finalSummary = result.response.text();

    logger.info(`Combined ${summaries.length} summaries into final summary: ${finalSummary.length} characters`);
    return finalSummary;
  }

  async generateChatResponse(message: string, context: ChatMessage[]): Promise<string> {
    const contextPrompt = this.buildContextPrompt(context);
    const prompt = `${contextPrompt}\n\nUser: ${message}`;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  private buildContextPrompt(context: ChatMessage[]): string {
    return context
      .map(msg => `${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}: ${msg.content}`)
      .join('\n\n');
  }

  // Legacy method for backward compatibility
  async summarizeExtractedText(extractedText: string, detailLevel: DetailLevel, hashKey: string): Promise<{ summary: string }> {
    const cacheKey = `llm:${hashKey}:${detailLevel}`;
    const cachedSummary = await this.redisClient.get(cacheKey);
    if (cachedSummary) {
      logger.info(`cache hit for ${cacheKey}`);
      return { summary: cachedSummary };
    }

    const maxTokens = {
      [DetailLevel.SHORT]: 100,
      [DetailLevel.MEDIUM]: 250,
      [DetailLevel.DETAILED]: 500,
    }[detailLevel];

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Summarize the following text in ${detailLevel} detail, max ${maxTokens} words, focusing on this text:\n${extractedText}`;
    const result = await model.generateContent(prompt);

    const summary = result.response.text();
    await this.redisClient.set(cacheKey, summary, 3600);
    logger.info(`generated summary for detail level ${detailLevel}: ${summary.length} characters`);
    return { summary: summary };
  }
}