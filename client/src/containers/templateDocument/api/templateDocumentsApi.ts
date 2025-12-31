import { TemplateDocument } from '@prisma/client';

import { PaginationInfo } from '../../../../../shared/types';
import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import {
  CreateNewTemplateInput,
  CreateTemplateCloneInput,
  CreateTemplateDocumentPromptInput,
  CreateTemplateSampleOutputInput,
  TemplateDocumentItemType,
} from '../types/templateDocumentTypes';

export async function getTemplateDocumentsApi(
  q: string = '',
  type: string = '',
  page: number = 1,
  limit: number = 20
): Promise<{
  list: ReadonlyArray<TemplateDocumentItemType>;
  pagination: PaginationInfo;
}> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/template-documents?q=${q}&type=${type}&page=${page}&limit=${limit}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg);
  }
  return data;
}

export async function getTemplateDocumentByIdApi(
  id: string
): Promise<TemplateDocumentItemType> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/template-documents/${id}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg);
  }
  return data;
}

export async function addTemplateDocumentsApi(
  input: Partial<TemplateDocument>
): Promise<TemplateDocumentItemType> {
  const headers = await getHeaders();
  console.log('in addTemplateDocumentsApi:', input);
  const result = await fetch(`${api_url}/api/template-documents`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error loading team: ' + errorMsg);
  }
}

export async function createTemplatePromptApi(
  input: CreateTemplateDocumentPromptInput
): Promise<Partial<TemplateDocument>> {
  const headers = await getHeaders();
  console.log('createTemplatePromptApi.input:', JSON.stringify(input));
  const result = await fetch(`${api_url}/api/template-documents/instructions`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const { success, data: promptText, errorMsg } = await result.json();
  if (success) {
    return { promptText };
  } else {
    throw new Error('Error loading team: ' + errorMsg);
  }
}

export async function createTemplateSampleOutputApi(
  input: CreateTemplateSampleOutputInput
): Promise<
  Partial<TemplateDocument> & { chatSessionId: string; docId: string }
> {
  const headers = await getHeaders();

  const result = await fetch(
    `${api_url}/api/template-documents/review-output`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(input),
    }
  );
  const { success, data, errorMsg } = await result.json();
  if (success) {
    const { sampleOutputText, chatSessionId, docId } = data;
    return { sampleOutputText, chatSessionId, docId };
  } else {
    throw new Error('Error loading team: ' + errorMsg);
  }
}

export async function createNewTemplateApi(
  input: CreateNewTemplateInput
): Promise<TemplateDocument> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/template-documents/create`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const { success, data, errorMsg } = await result.json();

  if (success) {
    return data as TemplateDocument;
  } else {
    throw new Error('Error creating new template: ' + errorMsg);
  }
}

export async function createTemplateCloneApi(
  input: CreateTemplateCloneInput
): Promise<TemplateDocument> {
  const { templateId, newName } = input;
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/template-documents/clone`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ templateId, name: newName }),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error cloning template: ' + errorMsg);
  }
}
