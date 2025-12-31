export const AdminOrgId = 'adminOrg';

export interface IAddIssueInput {
  name: string;
  sprintKey: string;
  storyPoint?: number;
  parentIssueKey?: string;
}
