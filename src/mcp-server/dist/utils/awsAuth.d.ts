import { S3Client } from "@aws-sdk/client-s3";
import { TextractClient } from "@aws-sdk/client-textract";
export declare class AWSAuth {
    private static s3Client;
    private static textractClient;
    private static command;
    static getS3Client(): S3Client;
    static getTextractClient(): TextractClient;
}
