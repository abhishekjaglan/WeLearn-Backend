import { S3Client } from "@aws-sdk/client-s3";
import { TextractClient } from "@aws-sdk/client-textract";
import { config } from "./config.js";

export class AWSAuth {
  private static s3Client: S3Client;
  private static textractClient: TextractClient;

  private static command = {
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID!,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY!,
    },
  };

  static getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client(this.command);
    }
    return this.s3Client;
  }

  static getTextractClient(): TextractClient {
    if (!this.textractClient) {
      this.textractClient = new TextractClient(this.command);
    }
    return this.textractClient;
  }
}