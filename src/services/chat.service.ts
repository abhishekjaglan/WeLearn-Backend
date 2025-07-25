import { DetailLevel } from "../types/summarization.types.js";
import { S3Service } from "./s3.service.js";
import { mcpClientService } from "./mcp.client.service.js";
import { LLMService } from "./llm.service.js";
import { RecordService } from "./record.service.js";
import { redisClient } from "../utils/redisClient.js";
import logger from "../utils/logger.js";

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: Date;
  tool_call_id?: string;
  name?: string;
}

export interface ChatResponse {
  message: string;
  recordId?: number;
  conversationId: string;
}

export class ChatService {
  private s3Service: S3Service;
  private llmService: LLMService;
  private recordService: RecordService;

  private readonly SYSTEM_PROMPT = `You are a helpful document analysis assistant. You can help users understand and summarize documents they upload. 

When a user uploads a document and asks for summarization:
1. Use the available tools to process the document
2. Analyze the returned data to create comprehensive summaries
3. Provide insights and answer questions about the document content

Always be helpful, accurate, and provide detailed responses when analyzing documents.`;

  constructor() {
    this.s3Service = new S3Service();
    this.llmService = new LLMService();
    this.recordService = new RecordService();
  }

  async processUserMessage(
    message: string,
    userId: string,
    conversationId: string,
    file?: Express.Multer.File,
    detailLevel: DetailLevel = DetailLevel.MEDIUM
  ): Promise<ChatResponse> {
    try {
      // Store user message in conversation history
      await this.storeMessage(conversationId, {
        role: 'user',
        content: message,
        timestamp: new Date(),
      });

      // Get conversation context (system prompt + last 3 messages)
      const context = await this.getConversationContext(conversationId);

      let response: string;
      let recordId: number | undefined;

      if (file) {
        // Handle document upload and processing
        const result = await this.processDocumentWithDynamicLLM(
          message,
          userId,
          file,
          detailLevel,
          context
        );
        response = result.summary;
        recordId = result.recordId;
      } else {
        // Handle regular chat message with potential function calling
        response = await this.processChatWithFunctionCalling(message, context);
      }

      // Store assistant response
      await this.storeMessage(conversationId, {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });

      return {
        message: response,
        recordId,
        conversationId,
      };
    } catch (error) {
      logger.error('Error processing user message:', error);
      throw error;
    }
  }

  private async processDocumentWithDynamicLLM(
    userMessage: string,
    userId: string,
    file: Express.Multer.File,
    detailLevel: DetailLevel,
    context: ChatMessage[]
  ): Promise<{ summary: string; recordId: number }> {
    // Upload file to S3
    const hashKey = `${userId}-${file.originalname}-${Date.now()}`;
    await this.s3Service.uploadFileToS3(hashKey, file);

    // Use dynamic function calling
    const llmResponse = await this.llmService.processWithFunctionCalling(
      userMessage,
      context,
      {
        s3Key: hashKey,
        fileName: file.originalname,
        userId,
      }
    );

    let summary = llmResponse.response;

    if (llmResponse.shouldCallFunction) {
      // Process function calls dynamically
      const functionResult = await this.handleFunctionCall(
        llmResponse.functionName!,
        llmResponse.functionArgs,
        detailLevel,
        context
      );
      summary = functionResult;
    }

    // Create record in database
    const record = await this.recordService.createRecord(userId, {
      mediaType: file.mimetype.includes('pdf') ? 'pdf' : 'doc',
      mediaName: file.originalname,
    });

    return {
      summary,
      recordId: record.id,
    };
  }

  private async processChatWithFunctionCalling(
    message: string,
    context: ChatMessage[]
  ): Promise<string> {
    const llmResponse = await this.llmService.processWithFunctionCalling(
      message,
      context
    );

    if (llmResponse.shouldCallFunction) {
      // Handle function calls for non-document scenarios
      return await this.handleFunctionCall(
        llmResponse.functionName!,
        llmResponse.functionArgs,
        DetailLevel.MEDIUM,
        context
      );
    }

    return llmResponse.response;
  }

  private async handleFunctionCall(
    functionName: string,
    functionArgs: any,
    detailLevel: DetailLevel,
    context: ChatMessage[]
  ): Promise<string> {
    try {
      logger.info(`Handling function call: ${functionName}`);

      // Call the MCP tool dynamically
      const toolResult = await mcpClientService.callTool(functionName, functionArgs);
      
      // Parse the tool result
      let resultData;
      if (typeof toolResult.content === 'string') {
        try {
          resultData = JSON.parse(toolResult.content);
        } catch {
          resultData = { content: toolResult.content };
        }
      } else if (Array.isArray(toolResult.content) && toolResult.content.length > 0) {
        try {
          resultData = JSON.parse(toolResult.content[0].text || '{}');
        } catch {
          resultData = { content: toolResult.content[0]?.text || 'No content' };
        }
      } else {
        resultData = toolResult.content;
      }

      // Handle different function types
      switch (functionName) {
        case 'summarize_document':
          return await this.handleDocumentSummarization(resultData, detailLevel, context);
        default:
          // Generic function handling
          return `Function ${functionName} executed successfully. Result: ${JSON.stringify(resultData)}`;
      }
    } catch (error) {
      logger.error(`Error handling function call ${functionName}:`, error);
      return `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleDocumentSummarization(
    resultData: any,
    detailLevel: DetailLevel,
    context: ChatMessage[]
  ): Promise<string> {
    if (!resultData.success || !resultData.chunks) {
      return "I couldn't process the document. Please try uploading a different file.";
    }

    const chunks: string[] = resultData.chunks;
    
    if (chunks.length === 0) {
      return "I couldn't extract any text from the document. Please try uploading a different file.";
    }

    // Process chunks with LLM to create summary
    const chunkSummaries: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkSummary = await this.llmService.summarizeChunk(
        chunks[i],
        detailLevel,
        context,
        i + 1,
        chunks.length
      );
      chunkSummaries.push(chunkSummary);
    }

    // Combine chunk summaries into final summary
    const finalSummary = await this.llmService.combineSummaries(
      chunkSummaries,
      detailLevel,
      context
    );

    return finalSummary;
  }

  private async getConversationContext(conversationId: string): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];

    // Always include system prompt as first message
    messages.push({
      role: 'system',
      content: this.SYSTEM_PROMPT,
    });

    // Get last 3 messages from conversation history
    const recentMessages = await redisClient.lrange(`chat:${conversationId}`, 0, 2);
    
    for (const msgStr of recentMessages.reverse()) {
      const message: ChatMessage = JSON.parse(msgStr);
      messages.push(message);
    }

    return messages;
  }

  private async storeMessage(conversationId: string, message: ChatMessage): Promise<void> {
    const key = `chat:${conversationId}`;
    await redisClient.lpush(key, JSON.stringify(message));
    
    // Keep only last 10 messages per conversation
    const messageCount = await redisClient.llen(key);
    if (messageCount > 10) {
      await redisClient.ltrim(key, 0, 9);
    }

    // Set expiry for conversation (24 hours)
    await redisClient.expire(key, 86400);
  }

  async getConversationHistory(conversationId: string): Promise<ChatMessage[]> {
    const messages = await redisClient.lrange(`chat:${conversationId}`, 0, -1);
    return messages.reverse().map(msgStr => JSON.parse(msgStr));
  }
}