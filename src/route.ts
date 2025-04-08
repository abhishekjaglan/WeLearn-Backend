import { Router } from "express";
import userRouter from "./routes/user.route";
import recordRouter from "./routes/record.route";
const router = Router();

router.use('/user', userRouter);
router.use('/record', recordRouter);

export default router;