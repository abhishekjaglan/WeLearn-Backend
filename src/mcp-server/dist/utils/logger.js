"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format.colorize(), winston_1.default.format.printf((info) => {
        const { timestamp, level, message } = info, meta = __rest(info, ["timestamp", "level", "message"]);
        return `[MCP-Server] ${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    })),
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({ filename: '../../logs/mcp-server.log' }),
    ],
});
exports.default = logger;
