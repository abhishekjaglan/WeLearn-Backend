export class AppError extends Error {
    constructor(public message: string, public status: number) {
        super(message);
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400);
    }
}

export class ProcessingError extends AppError {
    constructor(message: string) {
        super(message, 500);
    }
}
