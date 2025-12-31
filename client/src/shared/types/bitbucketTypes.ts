export interface BitbucketUserProfile {
  accessToken: string;
  userName: string;
  workspace?: string;
  expiresAt: Date;
  refreshToken: string;
}

export interface BitbucketRepoInfo {
  name: string;
  description: string;
  html_url: string;
} 