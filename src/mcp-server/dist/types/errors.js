"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, status) {
        super(message);
        this.message = message;
        this.status = status;
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}
exports.ValidationError = ValidationError;
class ProcessingError extends AppError {
    constructor(message) {
        super(message, 500);
    }
}
exports.ProcessingError = ProcessingError;
