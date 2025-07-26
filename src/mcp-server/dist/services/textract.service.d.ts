export declare class TextractService {
    private textractClient;
    private redisClient;
    constructor();
    textract(hashKey: string): Promise<{
        Blocks: any[];
    }>;
    stitchTextFromBlocks(blocks: any, hashKey: string): Promise<string>;
    private getTextractJobStatus;
}
