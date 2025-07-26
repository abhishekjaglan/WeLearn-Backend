import path from "path";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import logger from '../utils/logger.js';

export interface FunctionDefinition {
  type: string;
  function: {
    name: string;
    description: string | undefined;
    parameters: any;
  };
}

export class MCPClientService {
  private mcpServerPath: string;
  public functionDefinitions: FunctionDefinition[] = [];
  private transport: StdioClientTransport;
  public client: Client;

  constructor() {
    // Path to the MCP server
    this.mcpServerPath = path.resolve(process.cwd(), 'src/mcp-server/dist/index.js');
    
    const transportOptions = {
      command: 'node',
      args: [this.mcpServerPath],
      env: Object.keys(process.env).reduce((acc, key) => {
        const value = process.env[key];
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>), // Ensure all env values are strings
      stdio: ['pipe', 'pipe', 'inherit'] as const, // stdin, stdout, stderr (inherit stderr for debugging MCP)
    };

    this.transport = new StdioClientTransport(transportOptions);
    this.client = new Client(
      { 
        name: 'welearn-client-cli', 
        version: '1.0.0' 
      },
      { capabilities: {} }  // Remove defaultRequestTimeout as it's not supported
    );
  }

  async functionDefinitionsFunction(): Promise<void> {
    try {
      await this.client.connect(this.transport);
      logger.info('Connected to WeLearn MCP server');

      // Explicitly set timeout for the listTools call
      const toolsResponse = await this.client.listTools(undefined, { timeout: 300000 }); // 300,000 ms = 5 minutes
      let actualTools = [];
      
      if (toolsResponse && Array.isArray(toolsResponse.tools)) {
        actualTools = toolsResponse.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));
      } else {
        logger.warn("toolsResponse.tools is not an array or is undefined:", toolsResponse);
        // Ensure functionDefinitions remains empty or is explicitly cleared if no tools are found
        this.functionDefinitions.length = 0;
        return; // Exit if no tools are found or response is invalid
      }

      // Clear the existing array contents without creating a new reference
      this.functionDefinitions.length = 0; 
      
      // Populate the array with new definitions
      const newDefinitions = actualTools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema || { type: 'object', properties: {} }, // Fallback for parameters
        },
      }));
      this.functionDefinitions.push(...newDefinitions); // Add items from newDefinitions to the existing array reference
      
      logger.info('Retrieved tools:', actualTools.map((t) => t.name));
    } catch (error) {
      logger.error('Error connecting to MCP server or listing tools:', error);
      // Clear functionDefinitions in case of an error to prevent using stale/partial data
      this.functionDefinitions.length = 0; 
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    logger.info('Shutting down MCP client...');
    if (this.client) {
      try {
        await this.client.close(); 
        logger.info('MCP client closed.');
      } catch (e) {
        logger.error('Error closing MCP client:', e);
      }
    }
  }
}

// Singleton instance
export const mcpClientService = new MCPClientService();