import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import logger from '../utils/logger.js';
import { AppError } from '../types/error.type.js';
import { S3Service } from './s3.service.js';
import { TranscribeService } from './transcribe.service.js';

const execAsync = promisify(exec);

export class URLProcessingService {
  private s3Service: S3Service;
  private transcribeService: TranscribeService;

  constructor() {
    this.s3Service = new S3Service();
    this.transcribeService = new TranscribeService();
  }

  async processURL(url: string): Promise<string | boolean> {
    try {
      if (this.isYouTubeURL(url)) {
        logger.info(`Processing YouTube URL: ${url}`);
        return await this.processYouTubeURL(url);
      } else {
        logger.info(`Processing website URL: ${url}`);
        // return await this.scrapeWebsite(url);
        return false;
      }
    } catch (error) {
      logger.error('Error processing URL:', error);
      throw new AppError('Failed to process URL', 500);
    }
  }

  private isYouTubeURL(url: string): boolean {
    const youtubePatterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
      /^https?:\/\/m\.youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/v\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
    ];

    return youtubePatterns.some(pattern => pattern.test(url));
  }

  private async processYouTubeURL(url: string): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    const videoId = this.extractVideoId(url);
    const outputPath = path.join(tempDir, `${videoId}.%(ext)s`);

    try {
      // Ensure temp directory exists
      await fs.mkdir(tempDir, { recursive: true });

      // Download audio using yt-dlp
      const command = `yt-dlp -f "bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio" --extract-audio --audio-format mp3 -o "${outputPath}" "${url}"`;
      
      logger.info(`Executing: ${command}`);
      await execAsync(command);

      // Find the downloaded file
      const files = await fs.readdir(tempDir);
      const audioFile = files.find(file => file.startsWith(videoId) && (file.endsWith('.mp3') || file.endsWith('.m4a')));

      if (!audioFile) {
        throw new Error('Audio file not found after download');
      }

      const audioFilePath = path.join(tempDir, audioFile);
      const audioBuffer = await fs.readFile(audioFilePath);

      // Create file object for S3 upload
      const fileObj: Express.Multer.File = {
        fieldname: 'file',
        originalname: audioFile,
        encoding: '7bit',
        mimetype: audioFile.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4',
        buffer: audioBuffer,
        size: audioBuffer.length,
        destination: '',
        filename: audioFile,
        path: audioFilePath,
        stream: null as any,
      };

      // Upload to S3
      const hashKey = `youtube-${videoId}-${audioFile}`;
      await this.s3Service.uploadFileToS3(hashKey, fileObj);

      // Transcribe audio
      const transcript = await this.transcribeService.transcribe(hashKey);

      // Cleanup temp file
      await fs.unlink(audioFilePath);

      return transcript;
    } catch (error) {
      logger.error('Error processing YouTube URL:', error);
      throw new AppError('Failed to process YouTube URL', 500);
    }
  }

  private extractVideoId(url: string): string {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    throw new Error('Could not extract video ID from YouTube URL');
  }

  private async scrapeWebsite(url: string): Promise<string> {
    try {
      // Initialize the web loader with custom selectors to avoid unwanted content
      const loader = new CheerioWebBaseLoader(url, {
        selector: 'main, article, .content, #content, .main-content, #main-content, .post-content, .entry-content, body',
      });

      // Load the document
      const docs = await loader.load();

      if (!docs || docs.length === 0) {
        throw new Error('No content found on the page');
      }

      // Extract text content from all loaded documents
      let combinedText = docs.map(doc => doc.pageContent).join('\n\n');

      // Clean up the text
      combinedText = combinedText
        .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
        .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
        .trim();

      if (combinedText.length < 100) {
        throw new Error('Extracted content is too short');
      }

      // Optional: Split text into manageable chunks if needed
      // const textSplitter = new RecursiveCharacterTextSplitter({
      //   chunkSize: 10000,
      //   chunkOverlap: 200,
      // });

      // const textChunks = await textSplitter.splitText(combinedText);
      // const finalText = textChunks.join('\n\n');

      logger.info(`Scraped ${combinedText.length} characters from website using LangChain`);
      return combinedText;
    } catch (error) {
      logger.error('Error scraping website with LangChain:', error);
      
      // Fallback to basic scraping if LangChain fails
      try {
        logger.info('Attempting fallback scraping method');
        return await this.fallbackScrapeWebsite(url);
      } catch (fallbackError) {
        logger.error('Fallback scraping also failed:', fallbackError);
        throw new AppError('Failed to scrape website content', 500);
      }
    }
  }

  private async fallbackScrapeWebsite(url: string): Promise<string> {
    const axios = await import('axios');
    const { JSDOM } = await import('jsdom');

    const response = await axios.default.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // Remove unwanted elements
    const unwantedElements = document.querySelectorAll('script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar');
    unwantedElements.forEach(el => el.remove());

    // Try to extract main content
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '#content',
      '.main-content',
      '#main-content',
      '.post-content',
      '.entry-content',
    ];

    let mainContent = null;
    for (const selector of contentSelectors) {
      mainContent = document.querySelector(selector);
      if (mainContent) break;
    }

    const contentElement = mainContent || document.body;
    
    if (!contentElement) {
      throw new Error('No content found on the page');
    }

    let text = contentElement.textContent || '';
    
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    if (text.length < 100) {
      throw new Error('Extracted content is too short');
    }

    logger.info(`Fallback scraping extracted ${text.length} characters`);
    return text;
  }
}

export const urlProcessingService = new URLProcessingService();