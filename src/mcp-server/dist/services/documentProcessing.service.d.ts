export interface ProcessDocumentResult {
    chunks: string[];
    metadata: {
        totalChunks: number;
        originalTextLength: number;
        averageChunkSize: number;
    };
}
export declare class DocumentProcessingService {
    private textractService;
    private chunkingService;
    private redisClient;
    constructor();
    processDocument(s3Key: string, fileName: string, userId: string): Promise<ProcessDocumentResult>;
    private extractTextFromDocument;
}
