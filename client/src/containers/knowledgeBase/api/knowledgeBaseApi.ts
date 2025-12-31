import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

// Types
export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  files?: Array<{ id: string; fileName: string }>;
  _count?: {
    files: number;
  };
  creator: {
    id: string;
    username: string;
    email: string;
  };
}

export interface KBFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  s3Key: string;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  chunkCount: number;
  errorMessage?: string;
  createdAt: string;
  uploader: {
    username: string;
  };
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
  projectIds?: string[];
}

export interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string;
  projectIds?: string[];
}

export interface SearchResult {
  text: string;
  score: number;
  fileId: string;
  fileName: string;
  metadata?: any;
}

export interface ChatResponse {
  message: string;
  sources: SearchResult[];
  chatSessionId: string;
}

// API Functions

export async function getKnowledgeBaseListApi(): Promise<KnowledgeBase[]> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/knowledge-base`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(errorMsg || 'Failed to fetch knowledge bases');
  }
}

export async function getKnowledgeBaseByIdApi(
  id: string
): Promise<KnowledgeBase> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/knowledge-base/${id}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(errorMsg || 'Failed to fetch knowledge base');
  }
}

export async function createKnowledgeBaseApi(
  input: CreateKnowledgeBaseInput
): Promise<KnowledgeBase> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/knowledge-base`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(errorMsg || 'Failed to create knowledge base');
  }
}

export async function updateKnowledgeBaseApi(
  id: string,
  input: UpdateKnowledgeBaseInput
): Promise<KnowledgeBase> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/knowledge-base/${id}`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(errorMsg || 'Failed to update knowledge base');
  }
}

export async function deleteKnowledgeBaseApi(id: string): Promise<void> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/knowledge-base/${id}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  const { success, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg || 'Failed to delete knowledge base');
  }
}

// File Operations

export async function getKnowledgeBaseFilesApi(
  knowledgeBaseId: string
): Promise<KBFile[]> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/knowledge-base/${knowledgeBaseId}/files`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(errorMsg || 'Failed to fetch files');
  }
}

export async function presignUploadApi(
  knowledgeBaseId: string,
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<{ uploadUrl: string; publicUrl: string; fileId: string }> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/knowledge-base/${knowledgeBaseId}/presign-upload`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ fileName, fileType, fileSize }),
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(errorMsg || 'Failed to generate presigned URL');
  }
}

export async function processFileApi(
  knowledgeBaseId: string,
  fileId: string
): Promise<void> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/knowledge-base/${knowledgeBaseId}/files/${fileId}/process`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
    }
  );

  const { success, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg || 'Failed to start file processing');
  }
}

export async function deleteFileApi(
  knowledgeBaseId: string,
  fileId: string
): Promise<void> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/knowledge-base/${knowledgeBaseId}/files/${fileId}`,
    {
      method: 'DELETE',
      headers,
      credentials: 'include',
    }
  );

  const { success, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg || 'Failed to delete file');
  }
}

export async function reprocessFileApi(
  knowledgeBaseId: string,
  fileId: string
): Promise<void> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/knowledge-base/${knowledgeBaseId}/files/${fileId}/reprocess`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
    }
  );

  const { success, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg || 'Failed to reprocess file');
  }
}

export async function getFileDownloadUrlApi(
  knowledgeBaseId: string,
  fileId: string
): Promise<string> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/knowledge-base/${knowledgeBaseId}/files/${fileId}/download`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data.downloadUrl;
  } else {
    throw new Error(errorMsg || 'Failed to get download URL');
  }
}

// Search and Chat

export async function searchKnowledgeBaseApi(
  knowledgeBaseId: string,
  query: string,
  topK?: number
): Promise<SearchResult[]> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/knowledge-base/${knowledgeBaseId}/search`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ query, topK }),
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data.results;
  } else {
    throw new Error(errorMsg || 'Failed to search knowledge base');
  }
}

export async function chatWithKnowledgeBaseApi(
  knowledgeBaseId: string,
  message: string,
  chatSessionId?: string
): Promise<ChatResponse> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/knowledge-base/${knowledgeBaseId}/chat`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ message, chatSessionId }),
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(errorMsg || 'Failed to generate response');
  }
}

// Project Linking

export async function linkProjectToKnowledgeBaseApi(
  knowledgeBaseId: string,
  projectId: string
): Promise<any> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/knowledge-base/${knowledgeBaseId}/projects/${projectId}`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(errorMsg || 'Failed to link project');
  }
}

export async function unlinkProjectFromKnowledgeBaseApi(
  knowledgeBaseId: string,
  projectId: string
): Promise<void> {
  const headers = await getHeaders();
  const result = await fetch(
    `${api_url}/api/knowledge-base/${knowledgeBaseId}/projects/${projectId}`,
    {
      method: 'DELETE',
      headers,
      credentials: 'include',
    }
  );

  const { success, errorMsg } = await result.json();
  if (!success) {
    throw new Error(errorMsg || 'Failed to unlink project');
  }
}
