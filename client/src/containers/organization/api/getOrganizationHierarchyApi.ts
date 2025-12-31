import { getHeaders } from "../../../common/util/apiHeaders";
import { api_url } from "../../../lib/constants";
import { OrganizationHierarchy } from "../types/organizationTypes";

export async function getOrganizationHierarchyApi(): Promise<OrganizationHierarchy> {
  const headers = await getHeaders();

  const result = await fetch(`${api_url}/api/organization/hierarchy`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error loading team and project hierarchy: ' + errorMsg);
  }
}
