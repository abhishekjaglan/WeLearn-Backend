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
exports.RedisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_js_1 = __importDefault(require("./logger.js"));
const config_js_1 = require("./config.js");
class RedisClient {
    constructor() {
        this.client = new ioredis_1.default(Number(config_js_1.config.REDIS_PORT), String(config_js_1.config.REDIS_HOST));
        this.client.on('connect', () => { logger_js_1.default.info('MCP Server: Connected to Redis'); });
        this.client.on('error', (err) => { logger_js_1.default.error(`MCP Server: Redis error: ${err}`); });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.client.get(key);
        });
    }
    set(key, value, expirySeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.setex(key, expirySeconds, value);
        });
    }
    hget(hash, field) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.client.hget(hash, field);
        });
    }
    hset(hash, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.hset(hash, field, value);
        });
    }
    lpush(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.lpush(key, value);
        });
    }
    lrange(key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.client.lrange(key, start, stop);
        });
    }
    expire(key, seconds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.expire(key, seconds);
        });
    }
}
exports.RedisClient = RedisClient;
