import { AWSAuth } from '../utils/awsAuth.js';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand, MediaFormat } from '@aws-sdk/client-transcribe';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { redisClient, RedisClient } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import { config } from '../utils/config.js';
import { AppError } from '../types/error.type.js';

export class TranscribeService {
  private transcribeClient: TranscribeClient;
  private s3Client: S3Client;
  private redisClient: RedisClient;

  constructor() {
    this.transcribeClient = AWSAuth.getTranscribeClient();
    this.s3Client = AWSAuth.getS3Client();
    this.redisClient = redisClient;
  }

  async transcribe(hashKey: string): Promise<string> {
    try {
      console.log('Inside TranscribeService');
      const cachedKey = `transcribe:${hashKey}`;
      const extractedCache = await this.redisClient.get(cachedKey);
      
      if (extractedCache) {
        logger.info(`Transcribed text already exists in Redis for: ${hashKey}`);
        return extractedCache;
      }

      const jobName = `transcribe-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const startCommand = new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        Media: {
          MediaFileUri: `s3://${config.AWS_S3_BUCKET}/${hashKey}`,
        },
        MediaFormat: this.getMediaFormat(hashKey),
        LanguageCode: 'en-US',
        OutputBucketName: config.AWS_S3_BUCKET,
      });

      const startResponse = await this.transcribeClient.send(startCommand);
      
      if (!startResponse.TranscriptionJob?.TranscriptionJobName) {
        logger.error(`No TranscriptionJobName returned for: ${hashKey}`);
        throw new AppError('No TranscriptionJobName returned from Transcribe', 500);
      }

      const transcript = await this.getTranscribeJobStatus(jobName);
      
      // Cache the result
      await this.redisClient.set(cachedKey, transcript, 3600);
      logger.info(`Cached transcribed text for ${hashKey} in Redis`);

      return transcript;
    } catch (error) {
      logger.error(`Error transcribing audio file: ${hashKey}`, error);
      throw new AppError('Error transcribing audio file', 500);
    }
  }

  private getMediaFormat(filename: string): MediaFormat {
    const extension = filename.split('.').pop()?.toLowerCase();
    const formatMap: Record<string, MediaFormat> = {
      'mp3': MediaFormat.MP3,
      'mp4': MediaFormat.MP4,
      'wav': MediaFormat.WAV,
      'flac': MediaFormat.FLAC,
      'm4a': MediaFormat.M4A,
      'ogg': MediaFormat.OGG,
      'webm': MediaFormat.WEBM
    };
    
    return formatMap[extension || ''] || MediaFormat.MP3;
  }

  async getTranscribeJobStatus(jobName: string): Promise<string> {
    const getCommand = new GetTranscriptionJobCommand({ TranscriptionJobName: jobName });
    let response;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max wait time
    
    do {
      response = await this.transcribeClient.send(getCommand);
      attempts++;
      
      logger.info(`Transcribe job ${jobName} status: ${response.TranscriptionJob?.TranscriptionJobStatus} (attempt ${attempts})`);
      
      if (response.TranscriptionJob?.TranscriptionJobStatus === 'COMPLETED') {
        const transcriptUri = response.TranscriptionJob.Transcript?.TranscriptFileUri;
        
        if (!transcriptUri) {
          throw new Error('No transcript URI found');
        }
        
        logger.info(`Transcript completed, downloading from: ${transcriptUri}`);
        return await this.downloadTranscriptFromS3(transcriptUri, jobName);
      } else if (response.TranscriptionJob?.TranscriptionJobStatus === 'FAILED') {
        const failureReason = response.TranscriptionJob?.FailureReason;
        logger.error(`Transcribe job failed: ${failureReason}`);
        throw new Error(`Transcribe job failed: ${failureReason || 'Unknown reason'}`);
      }
      
      if (attempts >= maxAttempts) {
        throw new Error(`Transcribe job timeout after ${maxAttempts} attempts`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    } while (response.TranscriptionJob?.TranscriptionJobStatus === 'IN_PROGRESS');
    
    throw new Error('Transcribe job ended with unknown status');
  }

  private async downloadTranscriptFromS3(transcriptUri: string, jobName: string): Promise<string> {
    try {
      logger.info(`Downloading transcript from S3 using AWS SDK for job: ${jobName}`);
      
      // Extract the S3 key from the URI
      const s3Key = `${jobName}.json`;
      
      const getObjectCommand = new GetObjectCommand({
        Bucket: config.AWS_S3_BUCKET,
        Key: s3Key,
      });

      const response = await this.s3Client.send(getObjectCommand);
      
      if (!response.Body) {
        throw new Error('Empty response body from S3');
      }

      // Convert stream to string
      const responseText = await this.streamToString(response.Body);
      logger.info(`Transcript response length: ${responseText.length} characters`);
      
      // Log first 200 characters to debug
      logger.info(`Transcript response preview: ${responseText.substring(0, 200)}`);
      
      // Parse JSON transcript
      const transcriptJson = JSON.parse(responseText);
      
      if (!transcriptJson.results || !transcriptJson.results.transcripts || transcriptJson.results.transcripts.length === 0) {
        throw new Error('Invalid transcript JSON structure');
      }
      
      const transcript = transcriptJson.results.transcripts[0].transcript;
      logger.info(`Successfully extracted transcript: ${transcript.length} characters`);
      
      // Clean up the transcript file from S3 (optional)
      try {
        const deleteCommand = new GetObjectCommand({
          Bucket: config.AWS_S3_BUCKET,
          Key: s3Key,
        });
        // Note: You can uncomment the next line if you want to delete the transcript file after processing
        await this.s3Client.send(new DeleteObjectCommand({ Bucket: config.AWS_S3_BUCKET, Key: s3Key }));
        logger.info(`Transcript file cleanup completed for: ${s3Key}`);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup transcript file ${s3Key}:`, cleanupError);
      }
      
      return transcript;
    } catch (error) {
      logger.error('Error downloading transcript from S3:', error);
      throw new AppError('Error downloading transcript', 500);
    }
  }

  private async streamToString(stream: any): Promise<string> {
    const chunks: Buffer[] = [];
    
    if (stream.getReader) {
      // Handle ReadableStream (browser environment)
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let result = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
        }
        return result;
      } finally {
        reader.releaseLock();
      }
    } else {
      // Handle Node.js Readable stream
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString('utf-8');
    }
  }
}