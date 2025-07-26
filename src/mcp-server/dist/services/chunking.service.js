"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkingService = void 0;
const logger_js_1 = __importDefault(require("../utils/logger.js"));
class ChunkingService {
    constructor() {
        this.MAX_CHUNK_TOKENS = Math.floor(1000000 * 0.85);
        this.CHARS_PER_TOKEN = 4;
        this.MAX_CHUNK_CHARS = this.MAX_CHUNK_TOKENS * this.CHARS_PER_TOKEN;
    }
    createChunks(text) {
        return __awaiter(this, void 0, void 0, function* () {
            if (text.length <= this.MAX_CHUNK_CHARS) {
                logger_js_1.default.info(`Text fits in single chunk: ${text.length} characters`);
                return [text];
            }
            const chunks = [];
            const sentences = this.splitIntoSentences(text);
            let currentChunk = '';
            for (const sentence of sentences) {
                if (currentChunk.length + sentence.length > this.MAX_CHUNK_CHARS) {
                    if (currentChunk.trim()) {
                        chunks.push(currentChunk.trim());
                        currentChunk = sentence;
                    }
                    else {
                        const splitSentence = this.splitLongSentence(sentence);
                        chunks.push(...splitSentence);
                    }
                }
                else {
                    currentChunk += sentence;
                }
            }
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            logger_js_1.default.info(`Created ${chunks.length} chunks from ${text.length} characters`);
            return chunks;
        });
    }
    splitIntoSentences(text) {
        return text.split(/(?<=[.!?])\s+/);
    }
    splitLongSentence(sentence) {
        if (sentence.length <= this.MAX_CHUNK_CHARS) {
            return [sentence];
        }
        const chunks = [];
        let remaining = sentence;
        while (remaining.length > this.MAX_CHUNK_CHARS) {
            let breakPoint = this.MAX_CHUNK_CHARS;
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
exports.ChunkingService = ChunkingService;
