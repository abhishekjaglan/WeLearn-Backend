import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import logger from '../utils/logger.js';
import path from 'path';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface FunctionDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export class MCPClientService {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private functionDefinitions: FunctionDefinition[] = [];
  private isConnected: boolean = false;

  constructor() {
    // Don't initialize immediately, let it be done explicitly
  }

  async initialize(): Promise<void> {
    try {
      // Path to the MCP server
      const serverPath = path.resolve(process.cwd(), 'src/mcp-server/dist/index.js');
      
      const transportOptions = {
        command: 'node',
        args: [serverPath],
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'inherit'] as const
      };

      this.transport = new StdioClientTransport(transportOptions);

      this.client = new Client(
        {
          name: 'welearn-backend-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
          defaultRequestTimeout: 300000 // 5 minutes
        }
      );

      await this.client.connect(this.transport);
      this.isConnected = true;
      logger.info('MCP Client connected successfully');

      // Fetch available tools dynamically
      await this.fetchFunctionDefinitions();
    } catch (error) {
      logger.error('Failed to initialize MCP client:', error);
      throw error;
    }
  }

  private async fetchFunctionDefinitions(): Promise<void> {
    if (!this.client) {
      throw new Error('MCP Client not initialized');
    }

    try {
      const toolsResponse = await this.client.listTools(undefined, { timeout: 300000 });
      let actualTools: MCPTool[] = [];

      if (toolsResponse && Array.isArray(toolsResponse.tools)) {
        actualTools = toolsResponse.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));
      } else {
        logger.warn("toolsResponse.tools is not an array or is undefined:", toolsResponse);
        this.functionDefinitions = [];
        return;
      }

      // Clear existing definitions
      this.functionDefinitions = [];

      // Create new function definitions for LLM
      const newDefinitions: FunctionDefinition[] = actualTools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema || { type: 'object', properties: {} },
        },
      }));

      this.functionDefinitions.push(...newDefinitions);
      
      logger.info('Retrieved tools:', actualTools.map((t) => t.name));
      logger.info('Function definitions available:', this.functionDefinitions.map(f => f.function.name));
    } catch (error) {
      logger.error('Error fetching function definitions from MCP server:', error);
      this.functionDefinitions = [];
      throw error;
    }
  }

  async ensureConnected(): Promise<void> {
    if (!this.isConnected || !this.client) {
      await this.initialize();
    }
  }

  getFunctionDefinitions(): FunctionDefinition[] {
    return this.functionDefinitions;
  }

  hasFunctions(): boolean {
    return this.functionDefinitions.length > 0;
  }

  async callTool(name: string, args: any): Promise<any> {
    await this.ensureConnected();
    
    if (!this.client) {
      throw new Error('MCP Client not connected');
    }

    try {
      logger.info(`Calling MCP tool: ${name} with arguments:`, JSON.stringify(args));
      
      const result = await this.client.callTool({
        name,
        arguments: args,
      });

      if (result.isError) {
        throw new Error(`MCP Tool error: ${result.content[0]?.text}`);
      }

      logger.info(`Received response from MCP tool ${name}`);
      return result;
    } catch (error) {
      logger.error(`Error calling MCP tool ${name}:`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.transport) {
      try {
        await this.client.close();
        logger.info('MCP Client disconnected');
      } catch (error) {
        logger.error('Error closing MCP client:', error);
      } finally {
        this.client = null;
        this.transport = null;
        this.isConnected = false;
        this.functionDefinitions = [];
      }
    }
  }
}

// Singleton instance
export const mcpClientService = new MCPClientService();