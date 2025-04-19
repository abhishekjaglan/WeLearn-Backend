declare module 'jsonrpc-ws' {
    interface ServerOptions {
      port: number;
    }
  
    class Server {
      constructor(options: ServerOptions);
      listen(callback: () => void): void;
      register(method: string, handler: (params: any) => Promise<any>): void;
      on(event: 'error', handler: (err: any) => void): void;
    }
  
    class Client {
      constructor(url: string);
      connect(): Promise<void>;
      call(method: string, params: any): Promise<any>;
      close(): Promise<void>;
      on(event: 'error', handler: (err: any) => void): void;
    }
  
    export { Server, Client };
  }