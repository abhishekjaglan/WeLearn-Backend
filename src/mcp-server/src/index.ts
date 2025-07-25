import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { DocumentProcessingService } from './services/documentProcessing.service.js';
import logger from './utils/logger.js';

class MCPServer {
  private server: Server;
  private documentService: DocumentProcessingService;

  constructor() {
    this.server = new Server(
      {
        name: 'welearn-document-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.documentService = new DocumentProcessingService();
    this.setupRequestHandlers();
  }

  private setupRequestHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
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
        ] as Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'summarize_document':
            return await this.handleSummarizeDocument(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Error handling tool ${name}:`, error);
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
    });
  }

  private async handleSummarizeDocument(args: any) {
    const { s3Key, fileName, userId } = args;
    logger.info(`Processing document: ${s3Key} for user: ${userId}`);

    const result = await this.documentService.processDocument(s3Key, fileName, userId);

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
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('WeLearn MCP Document Server started successfully');
  }
}

// Start the server
const server = new MCPServer();
server.start().catch((error) => {
  logger.error('Failed to start MCP server:', error);
  process.exit(1);
});
