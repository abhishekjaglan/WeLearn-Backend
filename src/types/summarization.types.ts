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
  summary: string;
  recordId: String;
}

export interface MCPTextractInput {
  s3Key: string;
  fileName: string;
}

export interface MCPTextractOutput {
  text: string;
}

export interface MCPLLMInput {
  text: string;
  detailLevel: DetailLevel;
}

export interface MCPLLMOutput {
  summary: string;
}