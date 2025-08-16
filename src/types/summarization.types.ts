export enum DetailLevel {
  SHORT = 'short',
  MEDIUM = 'medium',
  DETAILED = 'detailed',
}

export interface SummarizationRequest {
  file: Express.Multer.File;
  detailLevel: DetailLevel;
  userId: string;
}

export interface SummarizationResponse {
  stitchedText: string;
}

export interface TextractInput {
  s3Key: string;
  fileName: string;
}

export interface TextractOutput {
  text: string;
}

export interface LLMInput {
  text: string;
  detailLevel: DetailLevel;
}

export interface LLMOutput {
  summary: string;
}