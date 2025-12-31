import {
  Issue,
  IssueStatus,
  Prisma,
  Project,
  ProjectStatus,
  WorkPlan,
} from '@prisma/client';
import dayjs from 'dayjs';

import {
  IProjectDataKeyMetrics,
  ISnapShotData,
  RiskLevel,
} from '../types/projectReportingTypes';

const RiskScoreMultiplier = 1.2;

function getProjectInsights(
  name: string,
  projectStage: string,
  riskScore: number,
  predictedDueDate: string,
  projectInsights: any,
  dueDate: Date | null,
  pastTimePercentage: number,
  progress: number
) {
  let riskLevel =
    riskScore < RiskLevel.LOW
      ? 'Low'
      : riskScore < RiskLevel.LOW + RiskLevel.MEDIUM
        ? 'Medium'
        : 'High';
  let insights = [
    `Project is currently in ${projectStage} phase, with ${riskLevel} risk score of ${Math.floor(
      riskScore * 100
    )}%`,
  ];
  // add insights for planning phase
  if (projectInsights.highRisk.planning.length) {
    let msg = `Planner has found ${
      projectInsights.highRisk.planning.length
    } High risk items: ${projectInsights.highRisk.planning.join(',')}`;
    if (projectInsights.mediumRisk.planning.length) {
      msg += `; and ${
        projectInsights.mediumRisk.planning.length
      } Medium risk issues: ${projectInsights.mediumRisk.planning.join(',')}`;
    }
    insights.push(msg);
  }

  // add insights for building phase
  if (projectInsights.highRisk.building.length) {
    let msg = `Builder has found ${
      projectInsights.highRisk.building.length
    } High risk items: ${projectInsights.highRisk.building.join(',')}`;
    if (projectInsights.mediumRisk.building.length) {
      msg += `; and ${
        projectInsights.mediumRisk.building.length
      } Medium risk issues: ${projectInsights.mediumRisk.building.join(',')}`;
    }
    insights.push(msg);
  }
  let diff = dayjs(predictedDueDate).diff(
    dayjs(dueDate || predictedDueDate),
    'day'
  );
  if (projectStage === 'Planning') {
    insights.push(
      `Predicted delivery date is not available yet. Please first publish your Development Plan.`
    );
  } else if (pastTimePercentage === 0 && progress === 0) {
    // no work has been done and no time has passed
    insights.push(
      `Dev work has not started yet. Initial due date is set as ${dayjs(
        dueDate
      ).format('MM/DD/YYYY')}`
    );
  } else if (pastTimePercentage > 0 && progress === 0) {
    // time has passed but no work has been done
    insights.push(
      `Dev work has not started yet. Initial due date is set as ${dayjs(
        dueDate
      ).format('MM/DD/YYYY')}`
    );
  } else if (!dueDate) {
    insights.push(`Predicted delivery date is ${predictedDueDate}`);
  } else if (diff > 0) {
    insights.push(
      `Predicted delivery date is ${predictedDueDate}, ${Math.abs(
        diff
      )} days later than initial due date of ${dayjs(dueDate).format(
        'MM/DD/YYYY'
      )}`
    );
  } else {
    insights.push(
      `Predicted delivery date is ${predictedDueDate}, ${Math.abs(
        diff
      )} days earlier than initial due date of ${dayjs(dueDate).format(
        'MM/DD/YYYY'
      )}`
    );
  }
  return insights;
}

export function computeSnapshotData(
  project: Project,
  buildables: ReadonlyArray<Issue>,
  milestones: ReadonlyArray<WorkPlan>
): ISnapShotData {
  let { name, createdAt, dueDate, status } = project;
  let projectStage = 'Planning';
  let totalStoryPoint = 0,
    completedStoryPoint = 0;
  let planning = [];
  let projectMetrics;
  let building: any[] = [];
  // first, determine project stage: Planning, Building, QA, Done
  let devPlan = buildables.find((i) =>
    i.name.toLowerCase().trim().includes('development plan')
  );
  if (status === ProjectStatus.COMPLETED) {
    projectStage = 'Done';
  } else if (
    devPlan?.status === IssueStatus.CREATED ||
    devPlan?.status === IssueStatus.STARTED
  ) {
    projectStage = 'Planning';
  } else if (devPlan?.status === IssueStatus.COMPLETED) {
    [totalStoryPoint, completedStoryPoint] = milestones.reduce(
      (result, wp) => {
        result[0] += wp.storyPoint || 0;
        result[1] += wp.completedStoryPoint || 0;
        return result;
      },
      [0, 0]
    );
    projectStage = totalStoryPoint > completedStoryPoint ? 'Building' : 'QA';
  }
  let projectRiskScore = 0;
  let projectInsights: {
    highRisk: { planning: string[]; building: String[] };
    mediumRisk: { planning: string[]; building: String[] };
  } = {
    highRisk: { planning: [], building: [] },
    mediumRisk: { planning: [], building: [] },
  };
  // second, calculate project metrics for planning phase
  planning = buildables
    .filter((b) => b.status !== IssueStatus.CANCELED)
    .map((b) => {
      let {
        name,
        plannedStartDate,
        plannedEndDate,
        actualStartDate,
        actualEndDate,
        status,
        progress,
        createdAt,
        updatedAt,
      } = b;
      let totalTime = Math.max(
        1,
        dayjs(plannedEndDate).diff(
          dayjs(actualStartDate || plannedStartDate || createdAt),
          'day'
        )
      );
      let pastTime = Math.max(
        0,
        status === IssueStatus.COMPLETED
          ? dayjs(actualEndDate || updatedAt).diff(
              dayjs(plannedStartDate || createdAt),
              'day'
            )
          : dayjs().diff(
              dayjs(actualStartDate || plannedStartDate || createdAt),
              'day'
            )
      );
      let pastTimePercentage = Math.floor((pastTime / totalTime) * 100);
      let riskScore = getRiskScore(progress as number, pastTimePercentage);
      if (status === IssueStatus.COMPLETED) {
        riskScore = 0;
      }
      // update project risk score & insights
      projectRiskScore = Math.max(projectRiskScore, riskScore);
      if (riskScore >= RiskLevel.LOW + RiskLevel.MEDIUM) {
        projectInsights.highRisk.planning.push(
          name + '(' + Math.floor(riskScore * 100) + '%)'
        );
      } else if (riskScore >= RiskLevel.LOW) {
        projectInsights.mediumRisk.planning.push(
          name + '(' + Math.floor(riskScore * 100) + '%)'
        );
      }

      // update planning metrics
      let metrics: Partial<IProjectDataKeyMetrics> = {
        totalTime,
        pastTime,
        pastTimePercentage,
        progress,
        velocity: Math.floor(
          ((progress || 0) / (pastTimePercentage || 1)) * 100
        ),
        riskScore,
        plannedEndDate,
      };
      return {
        name,
        metrics,
        stage: status as string,
        actualEndDate,
        insights: [`${name} is at ${status} stage`],
      };
    });

  // third: calculate Building Metrics
  if (projectStage === 'Building') {
    building = [...milestones]
      .filter((m) => m.status !== IssueStatus.CANCELED && m.name !== 'Backlog')
      .sort((a, b) => {
        let aObj = a.meta as Prisma.JsonObject;
        let bObj = b.meta as Prisma.JsonObject;
        let aMilestone = (aObj.key || 'milestone:0') as string;
        let bMilestone = (bObj.key || 'milestone:0') as string;
        return (
          parseInt(aMilestone.replace('milestone:', '')) -
          parseInt(bMilestone.replace('milestone:', ''))
        );
      })
      .map((e) => {
        let {
          name,
          plannedStartDate,
          plannedEndDate,
          actualStartDate,
          actualEndDate,
          status,
          progress,
          updatedAt,
          createdAt,
        } = e;
        let totalTime = Math.max(
          1,
          dayjs(actualEndDate || plannedEndDate).diff(
            dayjs(actualStartDate || plannedStartDate || createdAt),
            'day'
          )
        );
        let pastTime = Math.max(
          0,
          status === IssueStatus.COMPLETED
            ? dayjs(actualEndDate || updatedAt).diff(
                dayjs(plannedStartDate || createdAt),
                'day'
              )
            : dayjs().diff(
                dayjs(actualStartDate || plannedStartDate || createdAt),
                'day'
              )
        );
        let pastTimePercentage = Math.floor((pastTime / totalTime) * 100);
        let riskScore = getRiskScore(progress as number, pastTimePercentage);
        let buildingInsights: String[] = [];
        let buildingVelocity = Math.floor(
          ((progress || 0) / (pastTimePercentage || 1)) * 100
        );
        // update project risk score & insights, and building insights
        projectRiskScore = Math.max(projectRiskScore, riskScore);
        if (riskScore >= RiskLevel.LOW + RiskLevel.MEDIUM) {
          projectInsights.highRisk.building.push(
            name + '(' + Math.floor(riskScore * 100) + '%)'
          );
          buildingInsights.push(
            `${name} has High risk score of ${Math.floor(riskScore * 100)}%`,
            `Development velocity is very low at ${buildingVelocity}% of expected velocity`
          );
        } else if (riskScore > RiskLevel.LOW) {
          projectInsights.mediumRisk.building.push(
            name + '(' + Math.floor(riskScore * 100) + '%)'
          );
          buildingInsights.push(
            `${name} has Medium risk score of ${Math.floor(riskScore * 100)}%`,
            `Development velocity is low at ${buildingVelocity}% of expected velocity`
          );
        } else {
          buildingInsights.push(
            `${name} has low risk score of ${Math.floor(riskScore * 100)}%`,
            progress > 0
              ? `Development velocity is ${
                  buildingVelocity > 100 ? 'high' : 'low'
                } at ${buildingVelocity}% of expected velocity`
              : 'Development work has not started yet'
          );
        }
        // update building metrics
        let metrics = {
          totalTime,
          pastTime,
          pastTimePercentage,
          progress,
          riskScore,
          velocity: buildingVelocity,
          plannedEndDate,
        };
        return {
          name,
          metrics,
          stage: status,
          actualEndDate,
          insights: buildingInsights,
        };
      });
  }
  // fourth: update project metrics
  // if project due date is set to the creation date, then set it to 1 day
  let totalTime = Math.max(
    1,
    dueDate ? dayjs(dueDate).diff(dayjs(createdAt), 'day') : 1
  );
  let pastTime = Math.max(0, dayjs().diff(dayjs(createdAt), 'day'));
  let pastTimePercentage = Math.floor((pastTime / totalTime) * 100);
  // TODO - improve this logic (if project has little progress, we set it to be 10% by default
  let devVelocity = 0;
  if (pastTimePercentage === 0 || project.progress === 0) {
    devVelocity = 0;
  } else {
    devVelocity = Math.floor(
      ((project.progress || 0) / pastTimePercentage) * 100
    );
  }
  let predictedDueDate = dayjs(createdAt)
    .add(Math.ceil((totalTime / (devVelocity || 1)) * 100), 'day')
    .format('MM/DD/YYYY');
  projectMetrics = {
    metrics: {
      totalTime,
      pastTime,
      pastTimePercentage,
      progress: project.progress,
      velocity: devVelocity,
      riskScore: projectRiskScore,
      predictedDueDate,
    },
    insights: getProjectInsights(
      name,
      projectStage,
      projectRiskScore,
      predictedDueDate,
      projectInsights,
      dueDate,
      pastTimePercentage,
      project.progress as number
    ),
  };

  return {
    overall: {
      name,
      metrics: projectMetrics.metrics,
      insights: projectMetrics.insights,
      stage: projectStage,
    },
    planning,
    building,
  };
}

function getRiskScore(progress: number, pastTimePercentage: number) {
  let riskScore = 0;
  if (progress > 0 && pastTimePercentage > 0) {
    riskScore =
      Math.floor((1 - (progress as number) / (pastTimePercentage || 1)) * 100) /
      100;
  } else if (pastTimePercentage === 0) {
    riskScore = 0;
  } else if (progress === 0) {
    // TODO - Fix this logic (if no progress, now we default to risk score with 20% more than past time)
    riskScore = Math.ceil(pastTimePercentage * RiskScoreMultiplier) / 100;
  }
  riskScore = riskScore < 0 ? 0 : riskScore > 1 ? 1 : riskScore;
  return riskScore;
}
export function getRiskTooltip(step: any) {
  let { name, stage, metrics } = step;
  let result;
  if (stage === IssueStatus.COMPLETED) {
    result = `${name} has been completed. Risk score is 0`;
  } else {
    result = `${name} is at ${stage} stage. Risk score is ${metrics.riskScore}`;
  }
  return result;
}

export function getPassedTimeTooltip(step: any) {
  let { stage, metrics, actualEndDate } = step;
  let { pastTime, totalTime, plannedEndDate } = metrics;
  let result;
  if (stage === IssueStatus.COMPLETED) {
    result = `initial due date ${dayjs(plannedEndDate).format(
      'MM/DD/YYYY'
    )}, completed on ${dayjs(actualEndDate).format('MM/DD/YYYY')}`;
  } else if (pastTime > totalTime) {
    result = `due date ${dayjs(plannedEndDate).format(
      'MM/DD/YYYY'
    )}, already late by ${pastTime - totalTime} days`;
  } else {
    result =
      pastTime +
      ' out of ' +
      totalTime +
      ' days passed, due date ' +
      dayjs(plannedEndDate).format('MM/DD/YYYY');
  }
  return result;
}
