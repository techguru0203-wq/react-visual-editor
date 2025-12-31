export enum RiskLevel {
  LOW = 0.2,
  MEDIUM = 0.3,
  HIGH = 0.5,
}

export interface IProjectDataKeyMetrics {
  currentVelocity?: number | null;
  expectedVelocity?: number | null;
  riskScore?: number | null;
  totalTime?: number | null;
  pastTime?: number | null;
  pastTimePercentage?: number | null;
  totalStoryPoints?: number | null;
  completedStoryPoints?: number | null;
  progress?: number | null;
  velocity?: number | null;
  predictedDeliveryDate?: number | null;
  plannedEndDate?: Date | null;
  predictedDueDate?: string;
}

export interface ISnapShotData {
  overall: {
    name: string;
    metrics: IProjectDataKeyMetrics;
    insights?: string[];
    stage: string;
  };
  planning: {
    name: string;
    metrics: Partial<IProjectDataKeyMetrics>;
    insights?: string[];
    stage: string;
  }[];
  building: {
    name: string;
    metrics: Partial<IProjectDataKeyMetrics>;
    insights?: string[];
    stage: string;
  }[];
}
