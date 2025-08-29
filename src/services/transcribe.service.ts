import { AWSAuth } from '../utils/awsAuth.js';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand, MediaFormat } from '@aws-sdk/client-transcribe';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
    
    do {
      response = await this.transcribeClient.send(getCommand);
      
      if (response.TranscriptionJob?.TranscriptionJobStatus === 'COMPLETED') {
        const transcriptUri = response.TranscriptionJob.Transcript?.TranscriptFileUri;
        
        if (!transcriptUri) {
          throw new Error('No transcript URI found');
        }
        
        return await this.downloadTranscript(transcriptUri);
      } else if (response.TranscriptionJob?.TranscriptionJobStatus === 'FAILED') {
        throw new Error('Transcribe job failed');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    } while (response.TranscriptionJob?.TranscriptionJobStatus === 'IN_PROGRESS');
    
    throw new Error('Transcribe job timeout');
  }

  private async downloadTranscript(transcriptUri: string): Promise<string> {
    try {
      const response = await fetch(transcriptUri);
      const transcriptJson = await response.json();
      
      return transcriptJson.results.transcripts[0].transcript;
    } catch (error) {
      logger.error('Error downloading transcript:', error);
      throw new AppError('Error downloading transcript', 500);
    }
  }
}