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
exports.TextractService = void 0;
const awsAuth_js_1 = require("../utils/awsAuth.js");
const client_textract_1 = require("@aws-sdk/client-textract");
const redisClient_js_1 = require("../utils/redisClient.js");
const logger_js_1 = __importDefault(require("../utils/logger.js"));
const config_js_1 = require("../utils/config.js");
const errors_js_1 = require("../types/errors.js");
class TextractService {
    constructor() {
        this.textractClient = awsAuth_js_1.AWSAuth.getTextractClient();
        this.redisClient = new redisClient_js_1.RedisClient();
    }
    textract(hashKey) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cachedKey = `textract:${hashKey}`;
                const extractedCache = yield this.redisClient.get(cachedKey);
                if (extractedCache) {
                    logger_js_1.default.info(`Extracted text already exists in Redis for: ${hashKey}`);
                    return { Blocks: [] };
                }
                const detectDocumentTextCommand = new client_textract_1.StartDocumentTextDetectionCommand({
                    DocumentLocation: {
                        S3Object: {
                            Bucket: config_js_1.config.AWS_S3_BUCKET,
                            Name: hashKey,
                        },
                    },
                });
                const DetectionResponse = yield this.textractClient.send(detectDocumentTextCommand);
                const jobId = DetectionResponse.JobId;
                if (!jobId) {
                    logger_js_1.default.error(`No JobId returned for: ${hashKey}`);
                    throw new errors_js_1.AppError('No JobId returned from Textract', 500);
                }
                const response = yield this.getTextractJobStatus(jobId);
                logger_js_1.default.info(`Document text detected for: ${hashKey}`);
                if (response.Blocks) {
                    logger_js_1.default.info(`Blocks detected: ${response.Blocks.length}`);
                }
                else {
                    logger_js_1.default.error(`No blocks detected for: ${hashKey}`);
                }
                return { Blocks: response.Blocks || [] };
            }
            catch (error) {
                logger_js_1.default.error(`Error extracting text from document: ${hashKey}`, error);
                throw new errors_js_1.AppError('Error extracting text from document', 500);
            }
        });
    }
    stitchTextFromBlocks(blocks, hashKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const extractedCache = yield this.redisClient.get(`textract:${hashKey}`);
            if (extractedCache) {
                logger_js_1.default.info(`Extracted and stitched text already exists in Redis for: ${hashKey}`);
                return extractedCache;
            }
            if (!blocks || blocks.length === 0) {
                logger_js_1.default.error(`No blocks found for ${hashKey}`);
                return 'No Blocks Found';
            }
            const lineBlocks = [];
            const childWordIds = new Set();
            blocks.forEach((block) => {
                if (block.BlockType === 'LINE') {
                    lineBlocks.push(block);
                    if (block.Relationships) {
                        block.Relationships.forEach((rel) => {
                            if (rel.Type === 'CHILD' && rel.Ids) {
                                rel.Ids.forEach((id) => childWordIds.add(id));
                            }
                        });
                    }
                }
            });
            const standaloneWordBlocks = blocks.filter((block) => block.BlockType === 'WORD' && !childWordIds.has(block.Id));
            const lineText = lineBlocks
                .map(block => block.Text || '')
                .join('\n');
            const wordText = standaloneWordBlocks
                .map((block) => block.Text || '')
                .join(' ');
            const text = lineText + (lineText && wordText ? '\n' : '') + wordText;
            logger_js_1.default.info(`Stitched text (50 chars): ${text.slice(0, 50)}...`);
            const cacheKey = `textract:${hashKey}`;
            yield this.redisClient.set(cacheKey, text, 3600);
            logger_js_1.default.info(`Cached extracted text for ${hashKey} in Redis`);
            return text;
        });
    }
    getTextractJobStatus(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const getCommand = new client_textract_1.GetDocumentTextDetectionCommand({ JobId: jobId });
            let response;
            do {
                response = yield this.textractClient.send(getCommand);
                if (response.JobStatus === 'SUCCEEDED') {
                    return response;
                }
                else if (response.JobStatus === 'FAILED') {
                    throw new Error('Textract job failed');
                }
                yield new Promise(resolve => setTimeout(resolve, 5000));
            } while (response.JobStatus === 'IN_PROGRESS');
        });
    }
}
exports.TextractService = TextractService;
