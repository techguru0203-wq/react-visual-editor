import { DOCTYPE, Document, DocumentPermissionTypes } from '@prisma/client';
import { AppGenState } from '../../services/llmService/appAgentAnthropic';

export type DocumentOutput = Readonly<
  Omit<Document, 'content' | 'type'> & {
    type: Exclude<DOCTYPE, typeof DOCTYPE.DEVELOPMENT_PLAN>;
    contents?: string;
    documentPermission?: DocumentPermissionTypes;
  }
>;

export type LegacyDocumentOutput = Readonly<
  Omit<Document, 'content'> & {
    contentStr: string;
    chatSessionId?: string;
  }
>;

export type RefinementOutput = Readonly<{ contentStr: string }>;

export type RefinementGenerationInput = Readonly<{
  paragraphBefore: string;
  userInput: string;
  paragraphAfter: string;
  selection: string;
  docId: string;
}>;

export interface FileContent {
  fileContent: string;
  fileType: string;
  fileId: string;
  s3Url?: string; // S3 URL for images, to be used by LLM in generated code
}

export type DocumentGenerationInput = Readonly<{
  id: string;
  description: string;
  name: string;
  projectId: string;
  meta: any;
  type: DOCTYPE;
  contents: string;
  imageBase64: string;
  templateId: string;
  outputFormat: string;
  uploadedFileContent?: FileContent[];
  chosenDocumentIds?: string;
  contextText?: string;
  additionalContextFromUserFiles?: string;
  chatSessionId?: string;
  isFixingDeploymentError?: boolean;
}>;

export type AppGenerationInput = Readonly<{
  id: string;
  description: string;
  name: string;
  projectId: string;
  meta: any;
  type: DOCTYPE;
  contents: string;
  imageBase64: string;
  templateId: string;
  outputFormat: string;
  uploadedFileContent?: FileContent[];
  chosenDocumentIds?: string;
  contextText?: string;
  additionalContextFromUserFiles?: string;
  chatSessionId?: string;
  appGenState?: AppGenState;
}>;

export type ChatMessage = Readonly<{
  type: string;
  message: string;
  createdAt: Date;
}>;
