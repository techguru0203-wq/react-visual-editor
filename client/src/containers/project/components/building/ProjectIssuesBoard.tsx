import { useState } from 'react';
import { Empty, Progress, Select, Typography } from 'antd';
import dayjs from 'dayjs';

import { IssueOutput } from '../../../../../../shared/types/projectTypes';
import { useLanguage } from '../../../../common/contexts/languageContext';
import ColumnList from '../board/ColumnList';
import { useProject } from '../Project';

export function ProjectIssuesBoard() {
  const { project, filterMode, access } = useProject();
  const editable = access?.projectPermission === 'EDIT';
  const { t } = useLanguage();

  const [activeSprintInd, setActiveSprintInd] = useState(
    project.activeSprintInd
  );
  const [activeMilestoneInd, setActiveMilestoneInd] = useState(0);

  console.log('in containers.project.components.building.ProjectIssuesBoard');

  if (!project.milestones.length) {
    return (
      <Empty description={t('building.publishDevPlan')} />
    );
  }

  const sprintOptions = project?.sprints?.map((sprint, i) => {
    const sprintStartDate = sprint.actualStartDate || sprint.plannedStartDate;
    const sprintEndDate = sprint.actualEndDate || sprint.plannedEndDate;
    const displayStartDate = dayjs(sprintStartDate).format('MM/DD/YYYY');
    const displayEndDate = dayjs(sprintEndDate).format('MM/DD/YYYY');

    const optionLabel = `${displayStartDate} - ${displayEndDate}: ${sprint.name}`;

    return {
      value: i,
      label: optionLabel,
    };
  });

  const selectSprint = (sprintInd: number) => {
    setActiveSprintInd(sprintInd);
  };

  let issues: IssueOutput[] | undefined = [];
  let options;
  let defaultValue;
  let onChange;
  switch (filterMode) {
    case 'kanban':
      issues = project.issues.filter(
        (it) => !it.childIssues || it.childIssues.length === 0
      ) as IssueOutput[];
      break;
    case 'sprint':
      issues = project.sprints[activeSprintInd]?.issues;
      options = sprintOptions;
      defaultValue = activeSprintInd;
      onChange = selectSprint;
      break;
    case 'milestone':
      issues = project.milestones[activeMilestoneInd].sprints.flatMap(
        (sprint) =>
          project.sprints.filter((it) => it.id === sprint.id)[0]?.issues || []
      );
      options = project.milestones.map((milestone, i) => {
        return {
          value: i,
          label: milestone.name,
        };
      });
      defaultValue = activeMilestoneInd;
      onChange = (mileInd: number) => setActiveMilestoneInd(mileInd);
      break;
  }
  let completedPoints =
    issues?.reduce((total, obj) => (obj.completedStoryPoint || 0) + total, 0) ||
    0;
  let totalPoints =
    issues?.reduce((total, obj) => (obj.storyPoint || 0) + total, 0) || 0;
  let progress = completedPoints / totalPoints;

  return (
    <>
      {filterMode === 'kanban' ? (
        <div></div>
      ) : (
        <Select
          key={filterMode}
          defaultValue={defaultValue}
          options={options}
          onChange={onChange}
          style={{
            marginBottom: '10px',
            width: '270px',
          }}
        />
      )}
      <Typography.Text
        style={{
          paddingLeft: '10px',
        }}
      >
        {t('building.progressFormat').replace('{completed}', completedPoints.toString()).replace('{total}', totalPoints.toString())}
      </Typography.Text>
      <Progress
        style={{
          paddingLeft: '10px',
        }}
        type="circle"
        percent={Math.round(progress * 100)}
        size={30}
      />
      <ColumnList project={project} issues={issues} editable={editable} />
    </>
  );
}
