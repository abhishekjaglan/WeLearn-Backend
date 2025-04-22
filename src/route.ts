import { Router } from "express";
import userRouter from "./routes/user.route";
import recordRouter from "./routes/record.route";
import summarizeRouter from "./routes/summarize.route";
const router = Router();

router.use('/user', userRouter);
router.use('/record', recordRouter);
router.use('/summarize', summarizeRouter);

export default router;