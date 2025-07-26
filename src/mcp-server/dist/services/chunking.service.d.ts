export declare class ChunkingService {
    private readonly MAX_CHUNK_TOKENS;
    private readonly CHARS_PER_TOKEN;
    private readonly MAX_CHUNK_CHARS;
    createChunks(text: string): Promise<string[]>;
    private splitIntoSentences;
    private splitLongSentence;
}
