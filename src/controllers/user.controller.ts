import { NextFunction, Request, Response } from "express";
import { UserService } from "../services/user.service";
import { createUserSchema, deleteUserSchema, getUserSchema } from "../utils/validation";
import logger from "../utils/logger";
import { z } from "zod";

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    // Create a user (POST /api/user)
    async createUser(req: Request, res: Response, next: NextFunction) {
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
                return res.status(400).json({
                    success: false,
                    message: "Invalid input",
                    errors: error.errors,
                });
            }
            next(error); // Pass AppError or DatabaseError to error middleware
        }
    }

    // Get a user by firstName and lastName (GET /api/user)
    async getUser(req: Request, res: Response, next: NextFunction) {
        try {
            const validatedData = getUserSchema.parse(req.body); // Using query params for GET
            const user = await this.userService.getUser(validatedData);
            res.status(200).json({
                success: true,
                data: user,
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
            next(error);
        }
    }

    // Get all users (GET /api/user/all)
    async getAllUsers(req: Request, res: Response, next: NextFunction) {
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
    async deleteUser(req: Request, res: Response, next: NextFunction) {
        try {
            const validatedData = deleteUserSchema.parse(req.body); // Using body for DELETE
            const result = await this.userService.deleteUser(validatedData);
            res.status(200).json({
                success: true,
                message: `User deleted successfully`,
                data: result,
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
            next(error);
        }
    }
}

export const userController = new UserController();