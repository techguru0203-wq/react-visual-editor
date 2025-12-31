export enum IssueEvent {
  ISSUE_CREATED = 'jira:issue_created',
  ISSUE_DELETED = 'jira:issue_deleted',
  ISSUE_UPDATED = 'jira:issue_updated',
}

export enum IssueTypeEvent {
  ISSUETYPE_CREATED = 'issuetype_created',
  ISSUETYPE_UPDATED = 'issuetype_updated',
  ISSUETYPE_DELETED = 'issuetype_deleted',
}

export enum CommentEvent {
  COMMENT_CREATED = 'comment_created',
  COMMENT_UPDATED = 'comment_updated',
  COMMENT_DELETED = 'comment_deleted',
}

export enum SprintEvent {
  SPRINT_CREATED = 'sprint_created',
  SPRINT_UPDATED = 'sprint_updated',
  SPRINT_DELETED = 'sprint_deleted',
  SPRINT_STARTED = 'sprint_started',
  SPRINT_CLOSED = 'sprint_closed',
}

export enum WorkLogEvent {
  WORK_LOG_CREATED = 'worklog_created',
  WORK_LOG_UPDATED = 'worklog_updated',
  WORK_LOG_DELETED = 'worklog_deleted',
}

export enum ProjectEvent {
  PROJECT_CREATED = 'project_created',
  PROJECT_UPDATED = 'project_updated',
  PROJECT_DELETED = 'project_deleted',
}

export interface ProjectFromJiraAPI {
  id: string;
  key: string;
  name: string;
  projectLead: {
    accountId: string;
  };
}

export interface SprintFromJiraApi {
  id: string;
  state: string;
  name: string;
  startDate?: string;
  endDate?: string;
  createdDate?: string;
  completeDate?: string;
  goal?: string;
}

export interface WorkLogFromJiraApi {
  id: string;
  comment?: string;
  timeSpent?: string;
  timeSpentSeconds?: string;
  issueId: string;
}

export interface CommentFromJiraAPI {
  id: string;
  author: {
    accountId: string;
  };
  body: string;
}
export interface IssueFromJiraAPI {
  id: string;
  key: string;
  fields: {
    issuetype: IssueType;
    parent?: ParentIssue;
    timespent: number | null;
    project: Project;
    customfield_10032: number | null; // Story points
    aggregatetimespent: number | null;
    created: string;
    priority: Priority;
    labels: Array<string>;
    timeestimate: number | null;
    aggregatetimeoriginalestimate: number | null;
    assignee: JiraUser;
    updated: string;
    status: Status;
    timeoriginalestimate: number | null;
    description: string;
    aggregatetimeestimate: number | null;
    summary: string;
    creator: JiraUser;
    reporter: JiraUser;
    aggregateprogress: Progress;
    duedate: string | null;
    progress: Progress;
  } & { [key: string]: any };
}

interface IssueType {
  id: string;
}

interface ParentIssue {
  id: string;
}

interface Project {
  id: string;
}

interface Priority {
  id: string;
}

export interface JiraUser {
  accountId: string;
}

interface Status {
  id: string;
}

interface Progress {
  progress: number;
  total: number;
}

export const JiraIssueStatus = ['In Progress', 'To Do', 'Done'];
