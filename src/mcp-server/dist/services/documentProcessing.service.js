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
exports.DocumentProcessingService = void 0;
const textract_service_js_1 = require("./textract.service.js");
const chunking_service_js_1 = require("./chunking.service.js");
const redisClient_js_1 = require("../utils/redisClient.js");
const logger_js_1 = __importDefault(require("../utils/logger.js"));
class DocumentProcessingService {
    constructor() {
        this.textractService = new textract_service_js_1.TextractService();
        this.chunkingService = new chunking_service_js_1.ChunkingService();
        this.redisClient = new redisClient_js_1.RedisClient();
    }
    processDocument(s3Key, fileName, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `document_chunks:${userId}:${s3Key}`;
            const cachedResult = yield this.redisClient.get(cacheKey);
            if (cachedResult) {
                logger_js_1.default.info(`Cache hit for document chunks: ${s3Key}`);
                return JSON.parse(cachedResult);
            }
            const extractedText = yield this.extractTextFromDocument(s3Key);
            const chunks = yield this.chunkingService.createChunks(extractedText);
            const result = {
                chunks,
                metadata: {
                    totalChunks: chunks.length,
                    originalTextLength: extractedText.length,
                    averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length),
                },
            };
            yield this.redisClient.set(cacheKey, JSON.stringify(result), 3600);
            logger_js_1.default.info(`Cached document chunks for: ${s3Key}, total chunks: ${chunks.length}`);
            return result;
        });
    }
    extractTextFromDocument(s3Key) {
        return __awaiter(this, void 0, void 0, function* () {
            const extractedBlocks = yield this.textractService.textract(s3Key);
            const stitchedText = yield this.textractService.stitchTextFromBlocks(extractedBlocks.Blocks, s3Key);
            return stitchedText;
        });
    }
}
exports.DocumentProcessingService = DocumentProcessingService;
