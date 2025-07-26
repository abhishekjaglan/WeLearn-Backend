export declare class AppError extends Error {
    message: string;
    status: number;
    constructor(message: string, status: number);
}
export declare class ValidationError extends AppError {
    constructor(message: string);
}
export declare class ProcessingError extends AppError {
    constructor(message: string);
}
