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
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const documentProcessing_service_js_1 = require("./services/documentProcessing.service.js");
const logger_js_1 = __importDefault(require("./utils/logger.js"));
class MCPServer {
    constructor() {
        this.server = new index_js_1.Server({
            name: 'welearn-document-server',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.documentService = new documentProcessing_service_js_1.DocumentProcessingService();
        this.setupRequestHandlers();
    }
    setupRequestHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, () => __awaiter(this, void 0, void 0, function* () {
            return {
                tools: [
                    {
                        name: 'summarize_document',
                        description: 'Extract text from a document and return chunks for summarization',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                s3Key: {
                                    type: 'string',
                                    description: 'S3 key of the document to process',
                                },
                                fileName: {
                                    type: 'string',
                                    description: 'Original filename of the document',
                                },
                                userId: {
                                    type: 'string',
                                    description: 'User ID for caching purposes',
                                },
                            },
                            required: ['s3Key', 'fileName', 'userId'],
                        },
                    },
                ],
            };
        }));
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, (request) => __awaiter(this, void 0, void 0, function* () {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'summarize_document':
                        return yield this.handleSummarizeDocument(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                logger_js_1.default.error(`Error handling tool ${name}:`, error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        },
                    ],
                    isError: true,
                };
            }
        }));
    }
    handleSummarizeDocument(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const { s3Key, fileName, userId } = args;
            logger_js_1.default.info(`Processing document: ${s3Key} for user: ${userId}`);
            const result = yield this.documentService.processDocument(s3Key, fileName, userId);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            chunks: result.chunks,
                            metadata: result.metadata,
                            s3Key,
                            fileName,
                            userId,
                        }),
                    },
                ],
            };
        });
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            const transport = new stdio_js_1.StdioServerTransport();
            yield this.server.connect(transport);
            logger_js_1.default.info('WeLearn MCP Document Server started successfully');
        });
    }
}
const server = new MCPServer();
server.start().catch((error) => {
    logger_js_1.default.error('Failed to start MCP server:', error);
    process.exit(1);
});
