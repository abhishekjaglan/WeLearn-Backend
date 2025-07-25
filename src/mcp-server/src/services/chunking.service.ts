import logger from '../utils/logger.js';

export class ChunkingService {
  // Gemini 1.5 Flash has ~1M token context window
  // Using 85% for chunks to leave room for system prompt and conversation context
  private readonly MAX_CHUNK_TOKENS = Math.floor(1000000 * 0.85);
  private readonly CHARS_PER_TOKEN = 4; // Rough estimate for English text
  private readonly MAX_CHUNK_CHARS = this.MAX_CHUNK_TOKENS * this.CHARS_PER_TOKEN;

  async createChunks(text: string): Promise<string[]> {
    if (text.length <= this.MAX_CHUNK_CHARS) {
      logger.info(`Text fits in single chunk: ${text.length} characters`);
      return [text];
    }

    const chunks: string[] = [];
    const sentences = this.splitIntoSentences(text);
    let currentChunk = '';

    for (const sentence of sentences) {
      // If adding this sentence would exceed limit, start new chunk
      if (currentChunk.length + sentence.length > this.MAX_CHUNK_CHARS) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          // Handle very long sentences by splitting them
          const splitSentence = this.splitLongSentence(sentence);
          chunks.push(...splitSentence);
        }
      } else {
        currentChunk += sentence;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    logger.info(`Created ${chunks.length} chunks from ${text.length} characters`);
    return chunks;
  }

  private splitIntoSentences(text: string): string[] {
    // Split on sentence endings, but preserve the delimiter
    return text.split(/(?<=[.!?])\s+/);
  }

  private splitLongSentence(sentence: string): string[] {
    if (sentence.length <= this.MAX_CHUNK_CHARS) {
      return [sentence];
    }

    const chunks: string[] = [];
    let remaining = sentence;

    while (remaining.length > this.MAX_CHUNK_CHARS) {
      // Find a good breaking point (space, comma, etc.)
      let breakPoint = this.MAX_CHUNK_CHARS;
      
      // Look backwards for a good break point
      for (let i = this.MAX_CHUNK_CHARS; i > this.MAX_CHUNK_CHARS * 0.8; i--) {
        if (/[\s,;-]/.test(remaining[i])) {
          breakPoint = i + 1;
          break;
        }
      }

      chunks.push(remaining.substring(0, breakPoint).trim());
      remaining = remaining.substring(breakPoint).trim();
    }

    if (remaining.trim()) {
      chunks.push(remaining.trim());
    }

    return chunks;
  }
}
