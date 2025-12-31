import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

export interface CommunityProject {
  id: string;
  name: string;
  description: string;
  domain: string;
  imageUrl: string;
  previewUrl?: string;
  author?: string;
  createdAt?: string;
  projectId?: string; // The actual project ID for cloning
}

export interface CommunityProjectsResponse {
  success: boolean;
  data: CommunityProject[];
  errorMsg?: string;
}

export interface CommunityProjectResponse {
  success: boolean;
  data: CommunityProject;
  errorMsg?: string;
}

/**
 * Fetch all community projects with optional project ID filtering
 */
export async function fetchCommunityProjects(
  projectIds?: string[]
): Promise<CommunityProject[]> {
  try {
    let url = `${api_url}/api/community/projects`;

    if (projectIds && projectIds.length > 0) {
      const idsParam = projectIds.join(',');
      url += `?projectIds=${idsParam}`;
    }

    const headers = await getHeaders();
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    const result: CommunityProjectsResponse = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.errorMsg || 'Failed to fetch community projects');
    }
  } catch (error) {
    console.error('Error fetching community projects:', error);
    throw error;
  }
}

/**
 * Fetch a specific community project by ID
 */
export async function fetchCommunityProject(
  id: string
): Promise<CommunityProject> {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${api_url}/api/community/projects/${id}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    const result: CommunityProjectResponse = await response.json();

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.errorMsg || 'Failed to fetch community project');
    }
  } catch (error) {
    console.error('Error fetching community project:', error);
    throw error;
  }
}
