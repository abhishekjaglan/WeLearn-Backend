import { S3Client } from "@aws-sdk/client-s3";
import { TextractClient } from "@aws-sdk/client-textract";

export class AWSAuth {
    private static s3Client: S3Client;
    private static textractClient: TextractClient;
  
    static getS3Client(): S3Client {
      if (!this.s3Client) {
        this.s3Client = new S3Client({
          region: process.env.AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });
      }
      return this.s3Client;
    }
  
    static getTextractClient(): TextractClient {
      if (!this.textractClient) {
        this.textractClient = new TextractClient({
          region: process.env.AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });
      }
      return this.textractClient;
    }
  }

const awsClient = new AWSAuth();
export const s3Client = AWSAuth.getS3Client();
export const textractClient = AWSAuth.getTextractClient();