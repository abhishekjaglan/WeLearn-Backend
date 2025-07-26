import { Router } from "express";
import { chatController } from "../controllers/chat.controller.js";
import { upload } from "../middleware/multer.middleware.js";

const chatRouter = Router();

chatRouter.post('/', upload.single('file'), (req, res, next) => { 
  chatController.processMessage(req, res, next);
});

chatRouter.get('/history/:sessionId', (req, res, next) => {
  chatController.getChatHistory(req, res, next);
});

export default chatRouter;
