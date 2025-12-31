export type SupabaseInfo = {
  info: string;
  error: string;
};

export type ProjectFile = {
  path: string;
  content: string;
  type: 'file';
};

export interface DeployResult {
  sourceUrl: string;
  success: boolean;
  errorMessage: string;
  deploymentId?: string;
}
