import { Issue, IssueType, Project, WorkPlan, WorkPlanType } from "@prisma/client";
import { Card } from "antd";
import { Link } from "react-router-dom";

import { ProjectsPath } from "../../nav/paths";
import { computeSnapshotData } from "../hooks/snapshotData";
import { ProjectRiskScore } from "./reporting/ProjectRiskScore";

type ProjectRollupCardProps = Readonly<{
  project: Readonly<Project & {
    issues: ReadonlyArray<Readonly<Issue>>;
    workPlans: ReadonlyArray<Readonly<WorkPlan>>;
  }>;
}>;

// This component rolls up information about a project for display in rollup pages
export function ProjectRollupCard({
  project: { issues, workPlans, ...project},
}: ProjectRollupCardProps) {
  const { overall: snapshot } = computeSnapshotData(
    project,
    issues.filter(i => i.type === IssueType.BUILDABLE),
    workPlans.filter(wp => wp.type === WorkPlanType.MILESTONE),
  );

  return (
    <Link className='link-card' to={`/${ProjectsPath}/${project.id}`}>
      <Card title={project.name} className='app-card'>
        <ProjectRiskScore project={project} data={snapshot} />
      </Card>
    </Link>
  );
}