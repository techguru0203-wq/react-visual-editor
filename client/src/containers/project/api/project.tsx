import {
  CreateProjectInput,
  ProjectAccessResponse,
  ProjectOutput,
  UpdateProjectInput,
} from '../../../../../shared/types';
import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

export async function createProjectApi(
  input: CreateProjectInput
): Promise<ProjectOutput> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/projects`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error creating project: ' + errorMsg);
  }
  return data;
}

export async function updateProjectApi(
  input: UpdateProjectInput
): Promise<ProjectOutput> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/projects/${input.projectId}`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const { success, data, errorMsg } = await result.json();
  if (!success) {
    throw new Error(`Error updating project (${input.projectId}): ${errorMsg}`);
  }
  return data;
}

export async function getProjectApi(projectId: string): Promise<ProjectOutput> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/projects/${projectId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(`Error loading project (${projectId}): ${errorMsg}`);
  }
}

export async function getProjectAccessApi(
  projectId: string
): Promise<ProjectAccessResponse> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/projects/${projectId}/access`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(
      `Error checking project access (${projectId}): ${errorMsg}`
    );
  }
}

export async function deleteProjectApi(
  projectId: string
): Promise<ProjectOutput> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/projects/${projectId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(`Error deleting project (${projectId}): ${errorMsg}`);
  }
}

export async function cloneProjectApi(
  projectId: string
): Promise<ProjectOutput> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/projects/${projectId}/clone`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(`Error cloning project (${projectId}): ${errorMsg}`);
  }
}

export async function deployClonedProjectStreaming(
  projectId: string,
  onStatusUpdate: (data: any) => void
): Promise<void> {
  const headers = await getHeaders();
  const response = await fetch(
    `${api_url}/api/projects/${projectId}/deploy-clone-streaming`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
    }
  );

  if (!response.ok) {
    throw new Error('Network Error, please try again.');
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);
        onStatusUpdate(parsed);
      } catch (error) {
        console.error('Error parsing deployment update:', error);
      }
    }
  }
}
