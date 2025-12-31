import {
  DevPlan,
  SchedulingParameters,
  Sprint,
} from '../types/schedulingTypes';

export type DevPlanGenInput = SchedulingParameters & {
  additionalContextFromUserFiles?: string;
  requiredSpecialties: string[];
  sampleTaskStoryPoint: number;
  outputFormat?: string;
  documentGenerateLang?: string;
};

export interface ICreateIssueWorkPlanInput {
  creatorUserId: string;
  projectId: string;
  organizationId: string;
  devPlan: DevPlan;
}

export interface INameToIDMap {
  [key: string]: string;
}
export interface ITeammateCapacity {
  userId: string;
  skill: string;
  totalCapacity: number;
  remainingCapacity: number;
}
export interface ITeamSprintCapacity {
  remainingCapacity: Map<string, number>;
  teammates: ITeammateCapacity[];
}
export interface EpicSprintMap {
  [key: string]: {
    key: string | undefined;
    name: string;
    sprints: Sprint[];
    storyPoint: number;
    startDate: string;
    endDate: string;
  };
}
