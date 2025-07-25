import { NextFunction, Request, Response } from 'express';
import { ChatService } from '../services/chat.service.js';
import { DetailLevel } from '../types/summarization.types.js';
import logger from '../utils/logger.js';
import { z } from 'zod';
import { AppError } from '../types/error.type.js';
import { v4 as uuidv4 } from 'uuid';

const chatSchema = z.object({
  message: z.string().min(1, "Message is required"),
  userId: z.string().min(1, "User ID is required"),
  conversationId: z.string().optional(),
  detailLevel: z.enum([DetailLevel.SHORT, DetailLevel.MEDIUM, DetailLevel.DETAILED]).optional().default(DetailLevel.MEDIUM),
});

export class ChatController {
  private chatService: ChatService;

  constructor() {
    this.chatService = new ChatService();
  }

  async processMessage(req: Request, res: Response, next: NextFunction) {
    try {
      let messageData;
      
      // Handle both form data (with file) and JSON data
      if (req.body.data) {
        messageData = JSON.parse(req.body.data);
      } else {
        messageData = req.body;
      }

      const { message, userId, conversationId, detailLevel } = chatSchema.parse(messageData);
      const file = req.file;

      // Generate conversation ID if not provided
      const convId = conversationId || `${userId}-${uuidv4()}`;

      logger.info(`Processing chat message for user: ${userId}, conversation: ${convId}`);

      const response = await this.chatService.processUserMessage(
        message,
        userId,
        convId,
        file,
        detailLevel
      );

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logger.error("Validation error:", error.errors);
        return res.status(400).json({
          success: false,
          message: "Invalid input",
          errors: error.errors,
        });
      }
      logger.error("Chat processing error:", error);
      next(new AppError('Chat processing error', 500));
    }
  }

  async getConversationHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      
      if (!conversationId) {
        throw new AppError('Conversation ID is required', 400);
      }

      const history = await this.chatService.getConversationHistory(conversationId);

      res.status(200).json({
        success: true,
        data: {
          conversationId,
          messages: history,
        },
      });
    } catch (error) {
      logger.error("Error fetching conversation history:", error);
      next(error);
    }
  }
}

export const chatController = new ChatController();
