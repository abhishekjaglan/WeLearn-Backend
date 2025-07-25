import { Router } from "express";
import userRouter from "./routes/user.route.js";
import recordRouter from "./routes/record.route.js";
import summarizeRouter from "./routes/summarize.route.js";
import chatRouter from "./routes/chat.route.js";

export const router = Router();

router.use('/user', userRouter);
router.use('/record', recordRouter);
router.use('/summarize', summarizeRouter);
router.use('/chat', chatRouter);