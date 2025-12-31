import { TemplateDocument } from '@prisma/client';

export type TemplateDocumentItemType = TemplateDocument & {
  organization: { name: string };
};

export type CreateTemplateDocumentPromptInput = {
  name: string;
  type: string;
  description: string;
};

export type CreateTemplateSampleOutputInput = {
  promptText: string;
  sampleInputText: string;
  type: string;
  chatSessionId?: string;
};

export type CreateTemplateCloneInput = {
  templateId: string;
  newName?: string;
};

export type CreateNewTemplateInput = {
  name: string;
  description: string;
  type: string;
  promptText: string;
};
