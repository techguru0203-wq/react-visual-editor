import { Empty } from 'antd';

import { useLanguage } from '../../../../common/contexts/languageContext';
import { useProject } from '../Project';
import { MilestoneTable } from './MilestoneTable';

export function ProjectExecution() {
  const { project, filterMode, access } = useProject();
  const { t } = useLanguage();

  console.log('in containers.project.components.building.ProjectExecution');

  if (!project.milestones.length) {
    return (
      <Empty description={t('building.publishPrdAndDevPlan')} />
    );
  }

  return (
    <MilestoneTable
      className="milestone-table"
      project={project}
      milestones={project.milestones}
      filterMode={filterMode}
      editable={access.projectPermission === 'EDIT'}
    />
  );
}
