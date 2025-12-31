// Keep consistent with server/shared/types/jiraTypes.ts
export type JiraResource = {
  id: string;
  url: string;
  name: string;
  scopes: string[];
  avatarUrl: string;
};

export type JiraUserProfile = {
  account_type: string;
  account_id: string;
  email: string;
  name: string;
  picture: string;
  accout_status: string;
  nickname: string;
  zoneinfo: string;
  locale: string;
  extended_profile: {
    job_title: string;
    organization: string;
    department: string;
    location: string;
  };
  resource: JiraResource;
};

export type JiraEntity = {
  id: number;
  key: string;
  self: string;
};
