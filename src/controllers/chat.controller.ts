import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service.js';
import logger from '../utils/logger.js';

export class ChatController {
  async processMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await chatService.chat(req, res);
    } catch (error) {
      logger.error('Error in chat endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getChatHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await chatService.getChatHistory(req, res);
    } catch (error) {
      logger.error('Error in get chat history endpoint:', error);
      res.status(500).json({ error: 'Failed to fetch chat history' });
    }
  }
}

export const chatController = new ChatController();