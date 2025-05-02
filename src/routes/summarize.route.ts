import { Router } from "express";
import { summarizationController } from "../controllers/summarization.controller";
import { upload } from "../middleware/multer.middleware";

const summarizeRouter = Router();

// summarizeRouter. post('/', upload.single('file'), (req, res, next) => {summarizationController.summarize(req, res, next)});
summarizeRouter.post('/', (req, res, next) => { summarizationController.summarize(req, res, next) });

export default summarizeRouter;