"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AWSAuth = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_textract_1 = require("@aws-sdk/client-textract");
const config_js_1 = require("./config.js");
class AWSAuth {
    static getS3Client() {
        if (!this.s3Client) {
            this.s3Client = new client_s3_1.S3Client(this.command);
        }
        return this.s3Client;
    }
    static getTextractClient() {
        if (!this.textractClient) {
            this.textractClient = new client_textract_1.TextractClient(this.command);
        }
        return this.textractClient;
    }
}
exports.AWSAuth = AWSAuth;
AWSAuth.command = {
    region: config_js_1.config.AWS_REGION,
    credentials: {
        accessKeyId: config_js_1.config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config_js_1.config.AWS_SECRET_ACCESS_KEY,
    },
};
