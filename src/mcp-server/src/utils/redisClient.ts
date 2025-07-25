import Redis from "ioredis";
import logger from "./logger.js";
import { config } from "./config.js";

export class RedisClient {
    private client: Redis;

    constructor() {
        this.client = new Redis(Number(config.REDIS_PORT), String(config.REDIS_HOST));
        this.client.on('connect', () => { logger.info('MCP Server: Connected to Redis'); });
        this.client.on('error', (err) => { logger.error(`MCP Server: Redis error: ${err}`); });
    }

    async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    async set(key: string, value: string, expirySeconds: number): Promise<void> {
        await this.client.setex(key, expirySeconds, value);
    }

    async hget(hash: string, field: string): Promise<string | null> {
        return this.client.hget(hash, field);
    }

    async hset(hash: string, field: string, value: string): Promise<void> {
        await this.client.hset(hash, field, value);
    }

    async lpush(key: string, value: string): Promise<void> {
        await this.client.lpush(key, value);
    }

    async lrange(key: string, start: number, stop: number): Promise<string[]> {
        return this.client.lrange(key, start, stop);
    }

    async expire(key: string, seconds: number): Promise<void> {
        await this.client.expire(key, seconds);
    }
}
