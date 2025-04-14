import { Router } from "express";
import { recordController } from "../controllers/record.controller";

const recordRouter = Router();

// TODO: Add controller class/function
recordRouter.post('/create',(req, res, next) => {recordController.createRecord(req, res, next)} );
recordRouter.get('/:userId', (req, res, next) => {recordController.getRecordsByUser(req, res, next)});
recordRouter.get('/', (req, res, next) => {recordController.getRecordById(req, res, next)});
recordRouter.delete('/:userId', (req, res, next) => {recordController.deleteRecordsByUser(req, res, next)});
recordRouter.delete('/', (req, res, next) => {recordController.deleteRecordById(req, res, next)});

export default recordRouter;