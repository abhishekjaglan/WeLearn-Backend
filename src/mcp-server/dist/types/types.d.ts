export declare enum DetailLevel {
    SHORT = "short",
    MEDIUM = "medium",
    DETAILED = "detailed"
}
export interface Block {
    BlockType: 'LINE' | 'WORD' | string;
    Text?: string;
    Id?: string;
    Relationships?: Relationship[];
}
export interface Relationship {
    Type: 'CHILD' | string;
    Ids?: string[];
}
export interface DocumentChunk {
    text: string;
    chunkIndex: number;
    totalChunks: number;
}
export interface ProcessDocumentRequest {
    s3Key: string;
    fileName: string;
    userId: string;
}
export interface ProcessDocumentResponse {
    success: boolean;
    chunks: string[];
    metadata: {
        totalChunks: number;
        originalTextLength: number;
        averageChunkSize: number;
    };
}
