import Redis from "ioredis";
import logger from "./logger.js";
import { config } from "./config.js";

export class RedisClient {
    private client: Redis;

    constructor() {
        this.client = new Redis(Number(config.REDIS_PORT), String(config.REDIS_HOST));
        this.client.on('connect', () => { logger.info('Connected to Redis'); });
        this.client.on('error', (err) => { logger.error(`Redis error: ${err}`); });
    }

    async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    async set(key: string, value: string, expirySeconds: number): Promise<void> {
        await this.client.setex(key, expirySeconds, value);
    }
}

export const redisClient = new RedisClient();