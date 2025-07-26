import { NextFunction, Request, Response } from "express";
import { UserService } from "../services/user.service.js";
import { createUserSchema, deleteUserSchema, getUserSchema } from "../utils/validation.js";
import logger from "../utils/logger.js";
import { z } from "zod";

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    // Create a user (POST /api/user)
    async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const validatedData = createUserSchema.parse(req.body);
            console.log(validatedData);
            const user = await this.userService.createUser(validatedData);
            logger.debug(`Service call done`)
            res.status(201).json({
                success: true,
                data: user,
            });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                logger.error("Validation error:", error.errors);
                res.status(400).json({
                    success: false,
                    message: "Invalid input",
                    errors: error.errors,
                });
                return;
            }
            next(error); // Pass AppError or DatabaseError to error middleware
        }
    }

    // Get a user by firstName and lastName (GET /api/user)
    async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.params.id;
            const user = await this.userService.getUser(userId);
            res.status(200).json({
                success: true,
                data: user,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.error("Validation error:", error.errors);
                res.status(400).json({
                    success: false,
                    message: "Invalid input",
                    errors: error.errors,
                });
                return;
            }
            next(error);
        }
    }

    // Get all users (GET /api/user/all)
    async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const users = await this.userService.getAllUsers();
            res.status(200).json({
                success: true,
                data: users || [],
            });
        } catch (error) {
            next(error);
        }
    }

    // Delete a user (DELETE /api/user)
    async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.params.id;
            const result = await this.userService.deleteUser(userId);
            res.status(200).json({
                success: true,
                message: `User deleted successfully`,
                data: result,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.error("Validation error:", error.errors);
                res.status(400).json({
                    success: false,
                    message: "Invalid input",
                    errors: error.errors,
                });
                return;
            }
            next(error);
        }
    }
}

export const userController = new UserController();