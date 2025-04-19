import { Server, Client } from 'jsonrpc-ws';
import logger from './logger';

export class MCPServer {
  private server: Server;
  private methods: Map<string, (params: any) => Promise<any>>;

  constructor(options: { port: number; auth?: { type: string } }) {
    this.server = new Server({ port: options.port });
    this.methods = new Map();
    this.server.on('error', (err: any) => logger.error(`mcp server error: ${err}`));
  }

  registerMethod(name: string, handler: (params: any) => Promise<any>) {
    this.methods.set(name, handler);
    this.server.register(name, async (params: any) => {
      const handler = this.methods.get(name);
      if (!handler) throw new Error(`method ${name} not found`);
      return handler(params);
    });
  }

  async start() {
    await new Promise<void>((resolve) => {
      this.server.listen(() => resolve());
    });
  }
}

export class MCPClient {
  private client: Client;
  private url: string;

  constructor(options: { host: string; port: number }) {
    this.url = `ws://${options.host}:${options.port}`;
    this.client = new Client(this.url);
    this.client.on('error', (err: any) => logger.error(`mcp client error: ${err}`));
  }

  async call<T, U>(method: string, params: T): Promise<U> {
    await this.client.connect();
    const result = await this.client.call(method, params);
    await this.client.close();
    return result as U;
  }
}