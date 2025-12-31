import { api_url } from '../../../lib/constants';
import { getHeaders } from '../../../common/util/apiHeaders';

export type PresignResult = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  usedBytes: number;
  limitBytes: number;
};

export type SimplePresignResult = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
};

export async function presignUpload(params: {
  documentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<PresignResult> {
  const headers = await getHeaders();
  const res = await fetch(`${api_url}/api/files/presign-upload`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.errorMsg || 'presign failed');
  return json.data as PresignResult;
}

export async function simplePresignUpload(params: {
  documentId: string;
  fileName: string;
  fileType: string;
}): Promise<SimplePresignResult> {
  const headers = await getHeaders();
  const res = await fetch(`${api_url}/api/files/simple-presign-upload`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.errorMsg || 'presign failed');
  return json.data as SimplePresignResult;
}

export type ListedItem = {
  key: string;
  name: string;
  size: number;
  lastModified?: string;
  url: string;
};

export async function listFiles(documentId: string, cursor?: string, pageSize = 50): Promise<{ items: ListedItem[]; nextCursor?: string; usedBytes: number; }> {
  const headers = await getHeaders();
  const qs = new URLSearchParams({ documentId, pageSize: String(pageSize) });
  if (cursor) qs.set('cursor', cursor);
  const res = await fetch(`${api_url}/api/files/list?${qs.toString()}`, {
    method: 'GET',
    headers,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.errorMsg || 'list failed');
  return json.data as { items: ListedItem[]; nextCursor?: string; usedBytes: number };
}

export async function deleteFile(documentId: string, key: string): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch(`${api_url}/api/files/object`, {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, key }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.errorMsg || 'delete failed');
}

export async function getQuota(documentId: string): Promise<{ usedBytes: number; limitBytes: number }> {
  const headers = await getHeaders();
  const qs = new URLSearchParams({ documentId });
  const res = await fetch(`${api_url}/api/files/quota?${qs.toString()}`, {
    method: 'GET',
    headers,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.errorMsg || 'quota failed');
  return json.data as { usedBytes: number; limitBytes: number };
}


