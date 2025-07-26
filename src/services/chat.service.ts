import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DetailLevel } from "../types/summarization.types.js";
import { S3Service } from "./s3.service.js";
import { mcpClientService } from "./mcp.client.service.js";
import { RecordService } from "./record.service.js";
import { redisClient } from "../utils/redisClient.js";
import { config } from "../utils/config.js";
import logger from "../utils/logger.js";

export interface ChatMessage {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: string;
  sessionId?: string;
  tool_call_id?: string;
  name?: string;
}

export class ChatService {
  private s3Service: S3Service;
  private recordService: RecordService;
  private geminiApiKey: string;
  private genAI: GoogleGenerativeAI;
  private FIXED_SESSION_ID: string = "fixed-session-dev-001"; // Fixed session ID
  private System_Prompt: string = `You are a helpful document analysis assistant. You can help users understand and summarize documents they upload. 

Available functions:
- summarize_document: Extract text from documents and get chunks for analysis

When a user uploads a document and asks for summarization:
1. Call the summarize_document function with the document details
2. Process the returned chunks to create a comprehensive summary based on the requested detail level
3. Provide insights and answer questions about the document content

Always be helpful, accurate, and provide detailed responses when analyzing documents.`;

  constructor() {
    this.s3Service = new S3Service();
    this.recordService = new RecordService();
    this.geminiApiKey = config.GEMINI_API_KEY!;
    this.genAI = new GoogleGenerativeAI(this.geminiApiKey);

    if (!this.geminiApiKey) {
      logger.error('Missing Gemini API configuration. Set GEMINI_API_KEY environment variable.');
      throw new Error('Missing Gemini API configuration');
    }
  }

  /**
 * CORE FUNCTION: Enhanced chat method with Redis chat history and LLM chunking support
 */
  async chat(req: Request, res: Response): Promise<void> {
    const { message: userMessage, sessionId: clientSessionId, detailLevel = DetailLevel.MEDIUM } = req.body;
    const file = req.file;
    const currentSessionId = this.FIXED_SESSION_ID; // Override with fixed ID

    if (!userMessage) {
      res.status(400).json({ error: 'User message content is required' });
      return;
    }

    let internalConversationMessages: any[] = [];
    let displayableConversation: ChatMessage[] = [];

    try {
      // Ensure Redis client is connected
      if (!redisClient) {
        logger.error('Redis client is not available');
        res.status(503).json({ error: 'Chat history service is temporarily unavailable.' });
        return;
      }

      // STEP 2: Load displayable history from Redis
      const storedHistory = await redisClient.get(`session:${currentSessionId}:display`);
      if (storedHistory) {
        displayableConversation = JSON.parse(storedHistory);
      }

      const limitedHistory = displayableConversation.slice(-5);

      // STEP 3: Convert displayable history to Gemini format
      // Gemini only accepts 'user' and 'model' roles, and they must alternate
      const geminiHistory: any[] = [];
      for (const msg of limitedHistory) {
        if (msg.role === 'user') {
          geminiHistory.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        } else if (msg.role === 'assistant') {
          geminiHistory.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
        // Skip system and tool messages as Gemini doesn't support them directly
      }

      // Ensure history starts with 'user' role and alternates properly
      const validGeminiHistory: any[] = [];
      let lastRole = '';
      for (const msg of geminiHistory) {
        // Skip consecutive messages with the same role
        if (msg.role !== lastRole) {
          // If we're starting with a 'model' message, skip it
          if (validGeminiHistory.length === 0 && msg.role === 'model') {
            continue;
          }
          validGeminiHistory.push(msg);
          lastRole = msg.role;
        }
      }

      // Handle file upload if present
      let uploadedFileInfo: { s3Key: string; fileName: string; userId: string } | null = null;
      if (file) {
        const hashKey = `${currentSessionId}-${file.originalname}`;
        await this.s3Service.uploadFileToS3(hashKey, file);
        uploadedFileInfo = {
          s3Key: hashKey,
          fileName: file.originalname,
          userId: currentSessionId
        };
        logger.info(`File uploaded: ${file.originalname} -> ${hashKey}`);
      }

      // Prepare the current user message with system prompt and file info
      let currentUserMessage = userMessage;
      if (uploadedFileInfo) {
        currentUserMessage = `${this.System_Prompt} 
        A document has been uploaded. 
        Filename: ${uploadedFileInfo.fileName}
        S3 Key: ${uploadedFileInfo.s3Key}
        User ID: ${currentSessionId}
        Please use this information if you need to process or summarize the document.       
        User message: ${userMessage}`;
      } else if (validGeminiHistory.length === 0) {
        // Add system prompt to first message if no history
        currentUserMessage = `${this.System_Prompt}
        User message: ${userMessage}`;
      }

      let finalAssistantResponseText: string | null = null;
      let maxIterations = 5;
      let iterations = 0;
      let recordId: number | undefined;

      // STEP 5: Iterative processing loop
      while (finalAssistantResponseText === null && iterations < maxIterations) {
        iterations++;
        logger.info(`[ChatService] Processing iteration ${iterations}/${maxIterations}`);

        // STEP 6: Call Gemini with function calling
        const model = this.genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          tools: mcpClientService.functionDefinitions.length > 0 ? [{
            functionDeclarations: mcpClientService.functionDefinitions.map(def => ({
              name: def.function.name,
              description: def.function.description,
              parameters: def.function.parameters,
            }))
          }] : undefined,
        });

        let result;
        if (validGeminiHistory.length === 0) {
          // First message
          result = await model.generateContent(currentUserMessage);
        } else {
          // Continue existing chat
          const chat = model.startChat({
            history: validGeminiHistory
          });
          result = await chat.sendMessage(currentUserMessage);
        }

        const response = result.response;
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
          // Add model response with function calls to history
          validGeminiHistory.push({
            role: 'user',
            parts: [{ text: currentUserMessage }]
          });
          validGeminiHistory.push({
            role: 'model',
            parts: [{ text: response.text() || 'Calling functions...' }]
          });

          // Process function calls
          let toolResults: string[] = [];
          for (const functionCall of functionCalls) {
            const { name, args } = functionCall;

            logger.info(`[ChatService] Calling MCP tool: ${name} with arguments:`, JSON.stringify(args));

            try {
              let toolResult: any;

              // Handle document processing with file upload
              if (name === 'summarize_document' && uploadedFileInfo) {
                const mcpArgs = {
                  s3Key: uploadedFileInfo.s3Key,
                  fileName: uploadedFileInfo.fileName,
                  userId: uploadedFileInfo.userId
                };

                const mcpResponse = await mcpClientService.client.callTool({
                  name: name,
                  arguments: mcpArgs as Record<string, unknown>,
                });

                toolResult = JSON.parse((mcpResponse.content as any[])[0].text);

                // Process the chunks for summarization
                if (toolResult.success && toolResult.chunks) {
                  const processedSummary = await this.processDocumentChunks(
                    toolResult.chunks,
                    detailLevel as DetailLevel,
                    validGeminiHistory
                  );

                  toolResult.processedSummary = processedSummary;
                }
              } else {
                // Handle regular tool calls
                logger.info(`[ChatService] Calling regular MCP tool: ${name}`);
                const mcpResponse = await mcpClientService.client.callTool({
                  name: name,
                  arguments: args as Record<string, unknown>,
                });
                toolResult = JSON.parse((mcpResponse.content as any[])[0].text);
              }

              toolResults.push(JSON.stringify(toolResult));

            } catch (toolError) {
              logger.error(`[ChatService] Error in tool execution:`, toolError);
              toolResults.push(JSON.stringify({
                error: toolError instanceof Error ? toolError.message : 'Unknown error',
                details: toolError
              }));
            }
          }

          // Send tool results as next user message
          const toolResultsMessage = `Tool results: ${toolResults.join('\n\n')}`;
          currentUserMessage = toolResultsMessage;

        } else {
          // Final response received
          finalAssistantResponseText = response.text();
        }
      }

      // STEP 12: Handle max iterations reached
      if (!finalAssistantResponseText && iterations >= maxIterations) {
        finalAssistantResponseText = "I seem to be having trouble completing your request after several attempts. Could you please try rephrasing or breaking it down?";
      }

      // STEP 13: Update displayable conversation
      displayableConversation.push({
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
        sessionId: currentSessionId
      });

      if (finalAssistantResponseText) {
        displayableConversation.push({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: finalAssistantResponseText,
          timestamp: new Date().toISOString(),
          sessionId: currentSessionId
        });
      }

      // Save updated displayable history to Redis
      const redisKey = `session:${currentSessionId}:display`;
      const redisValue = JSON.stringify(displayableConversation);

      if (typeof redisKey !== 'string' || redisKey === '' || typeof redisValue !== 'string') {
        logger.error('Invalid key or value for Redis set command.', { redisKey, typeOfValue: typeof redisValue });
      } else {
        await redisClient.set(redisKey, redisValue, 86400); // Expires in 1 day
        logger.info(`Successfully set Redis key: ${redisKey}`);
      }

      res.json({
        assistantResponse: finalAssistantResponseText,
        updatedConversation: displayableConversation,
        recordId: recordId
      });

    } catch (error) {
      logger.error('Error processing chat:', error);
      let detailMessage = "An unexpected error occurred.";
      if (error instanceof Error) {
        detailMessage = error.message;
      } else if (typeof error === 'string') {
        detailMessage = error;
      }
      res.status(500).json({ error: 'Internal server error', details: detailMessage });
    }
  }

  /**
   * Process document chunks for summarization
   */
  private async processDocumentChunks(
    chunks: string[],
    detailLevel: DetailLevel,
    geminiHistory: any[]
  ): Promise<string> {
    if (chunks.length === 0) {
      return "I couldn't extract any text from the document. Please try uploading a different file.";
    }

    const chunkSummaries: string[] = [];
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const maxWords = {
      [DetailLevel.SHORT]: 50,
      [DetailLevel.MEDIUM]: 150,
      [DetailLevel.DETAILED]: 300,
    }[detailLevel];

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const contextPrompt = geminiHistory
        .map(msg => `${msg.role === 'model' ? 'assistant' : msg.role}: ${msg.parts[0].text}`)
        .join('\n\n');

      const prompt = `${contextPrompt}
  
  Summarize this document chunk (${i + 1}/${chunks.length}) in ${detailLevel} detail (max ${maxWords} words):
  
  ${chunks[i]}`;

      const result = await model.generateContent(prompt);
      const summary = result.response.text();
      chunkSummaries.push(summary);
    }

    // Combine summaries if multiple chunks
    if (chunkSummaries.length === 1) {
      return chunkSummaries[0];
    }

    const combinedSummaries = chunkSummaries.join('\n\n---\n\n');
    const finalPrompt = `Combine these individual summaries into one cohesive ${detailLevel} summary of the entire document:
  
  ${combinedSummaries}
  
  Create a well-structured, comprehensive summary that maintains the ${detailLevel} level of detail requested.`;

    const finalResult = await model.generateContent(finalPrompt);
    return finalResult.response.text();
  }

  /**
   * Get chat history from Redis
   */
  async getChatHistory(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const currentSessionId = sessionId || this.FIXED_SESSION_ID;

    try {
      const storedHistory = await redisClient.get(`session:${currentSessionId}:display`);
      const history = storedHistory ? JSON.parse(storedHistory) : [];

      res.json({
        sessionId: currentSessionId,
        conversation: history
      });
    } catch (error) {
      logger.error('Error fetching chat history:', error);
      res.status(500).json({ error: 'Failed to fetch chat history' });
    }
  }
}

export const chatService = new ChatService();