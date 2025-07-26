export declare class RedisClient {
    private client;
    constructor();
    get(key: string): Promise<string | null>;
    set(key: string, value: string, expirySeconds: number): Promise<void>;
    hget(hash: string, field: string): Promise<string | null>;
    hset(hash: string, field: string, value: string): Promise<void>;
    lpush(key: string, value: string): Promise<void>;
    lrange(key: string, start: number, stop: number): Promise<string[]>;
    expire(key: string, seconds: number): Promise<void>;
}
