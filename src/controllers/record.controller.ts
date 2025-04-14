import { Request, Response, NextFunction } from "express";
import { RecordService } from "../services/record.service";
import { createRecordSchema, deleteRecordSchema, getRecordSchema } from "../utils/validation";
import { z } from "zod";
import logger from "../utils/logger";
import { AppError } from "../types/error.type";

class RecordController {
    constructor(private recordService: RecordService) {
        this.recordService = new RecordService();
    }

    async createRecord(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
                const validatedData = createRecordSchema.parse(req.body);
                logger.debug(`Validated data: ${validatedData}`);
                const user = await this.recordService.getRecordsByUser(validatedData.user);
                if (!user) {
                    throw new AppError("User does not exist", 400);
                }
                const createdRecord = await this.recordService.createRecord(validatedData.user, validatedData);
                return res.status(201).json({
                    data: createdRecord,
                    success: true
                });
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.error("Validation error:", error.errors);
                return res.status(400).json({
                    success: false,
                    message: "Invalid input",
                    errors: error.errors,
                });
            }
            next(error); // Pass AppError or DatabaseError to error middleware
        }
    }

    async getRecordById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const validatedData = getRecordSchema.parse(req.body);
            logger.debug(`Validated data: ${validatedData}`);
            const record = await this.recordService.getRecordById(validatedData.userId, validatedData.recordId);
            return res.status(200).json({
                success: true,
                data: record
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
            next(error); // Pass AppError or DatabaseError to error middleware
        }
    }

    async getRecordsByUser(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const userId = req.params.userId;
            const records = await this.recordService.getRecordsByUser(userId);
            return res.status(200).json({
                data: records,
                success: true
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.error("Validation error:", error.errors);
                return res.status(400).json({
                    success: false,
                    message: "Invalid input",
                    errors: error.errors,
                });
            }
            next(error); // Pass AppError or DatabaseError to error middleware
        }
    }

    async deleteRecordsByUser(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const userId = req.params.userId;
            await this.recordService.deleteRecordsByUser(userId);
            return res.status(200).json({
                success: true,
                message: "Records deleted successfully"
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.error("Validation error:", error.errors);
                return res.status(400).json({
                    success: false,
                    message: "Invalid input",
                    errors: error.errors,
                });
            }
            next(error); // Pass AppError or DatabaseError to error middleware
        }
    }

    async deleteRecordById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const validatedData = deleteRecordSchema.parse(req.body);
            logger.debug(`Validated data: ${validatedData}`);
            await this.recordService.deleteRecordById(validatedData.userId, validatedData.recordId);
            return res.status(200).json({
                success: true,
                message: "Record deleted successfully"
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.error("Validation error:", error.errors);
                return res.status(400).json({
                    success: false,
                    message: "Invalid input",
                    errors: error.errors,
                });
            }
            next(error); // Pass AppError or DatabaseError to error middleware
        }
    }
}

export const recordController = new RecordController(new RecordService());