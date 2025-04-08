import { Request, Response } from "express"
import { AppError, DatabaseError, ValidationError } from "../types/error.type"
import logger from "../utils/logger"

export const errorMiddleware = (
    err: Error,
    req: Request,
    res: Response
) => {
    if(err instanceof AppError){
        logger.error(err.message, {status: err.status});
        res.status(err.status).json({ message: err.message });
    }else if(err instanceof ValidationError){
        logger.error(err.message, {status: err.status});
        res.status(err.status).json({ message: err.message });
    }else if (err instanceof DatabaseError){
        logger.error(err.message, {status: err.status});
        res.status(err.status).json({ message: err.message });
    }else{
        logger.error('Unhandled Error', { error: err.stack });
        res.status(500).json({  message: "Internal Server Error "});
    }
};