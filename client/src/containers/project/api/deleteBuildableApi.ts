import { getHeaders } from "../../../common/util/apiHeaders";
import { api_url } from "../../../lib/constants";
import { DeleteBuildableArgs } from "../types/projectType";

export async function deleteBuildableApi({ projectId, buildableIssueId }: DeleteBuildableArgs): Promise<DeleteBuildableArgs> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/projects/${projectId}/planningStep/${buildableIssueId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  const { success, errorMsg } = await result.json();
  if (!success) {
    throw new Error('Error loading team: ' + errorMsg);
  }
  return { projectId, buildableIssueId };
}
