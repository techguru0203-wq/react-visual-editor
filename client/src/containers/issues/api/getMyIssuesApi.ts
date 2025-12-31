import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { IssueOutput } from '../types/issueTypes';

export interface GetMyIssuesResponse {
  data: ReadonlyArray<IssueOutput>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export async function getMyIssuesApi(
  page: number = 1,
  limit: number = 25
): Promise<GetMyIssuesResponse> {
  const headers = await getHeaders();

  const result = await fetch(
    `${api_url}/api/issues?page=${page}&limit=${limit}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );
  const response = await result.json();
  if (response.success) {
    return {
      data: response.data,
      pagination: response.pagination,
    };
  } else {
    throw new Error('Error loading issues: ' + response.errorMsg);
  }
}
