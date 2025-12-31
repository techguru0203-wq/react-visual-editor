// create a react component that display a line of text "Project Dashboard - {projectId}"
import {
  Descriptions,
  DescriptionsProps,
  Empty,
  Skeleton,
  Typography,
} from 'antd';
import dayjs from 'dayjs';

import { ProjectOutput } from '../../../../../shared/types';
import { useLanguage } from '../../../common/contexts/languageContext';
import { useProjectQuery } from '../../../common/hooks/useProjectsQuery';

export default function ProjectOverview({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error } = useProjectQuery(projectId);
  const { t } = useLanguage();

  // todo - add spinner for loading and error msg display for errors
  if (isLoading) {
    console.log('in containers.project.components.ProjectDashboard.loading');
    <Skeleton active />;
  }
  if (isError) {
    return <>Error: {error}</>;
  }
  console.log('in containers.project.components.ProjectDashboard:', data);

  let items = data ? getProjectDataItems(data, t) : [];
  const { Text, Title } = Typography;
  return (
    <>
      <Descriptions
        className="project-overview"
        title={t('project.info')}
        items={items}
      />
      <section className="project-progress">
        <Title level={5}>{t('project.progress')} </Title>
        <Text disabled>{t('project.timelineShowingDeliverables')}</Text>
        <Empty />
      </section>
      <br />
      <section className="project-insight">
        <Title level={5}>{t('project.insight')}</Title>
        <Text disabled>{t('project.risksMitigationsActions')}</Text>

        <Empty />
      </section>
    </>
  );
}

function getProjectDataItems(project: ProjectOutput, t: (key: string) => string) {
  let { name, description, createdAt, dueDate, ownerUserId, teamId } = project;
  const items: DescriptionsProps['items'] = [
    {
      key: 'name',
      label: t('project.projectName'),
      span: 1,
      children: <span>{name}</span>,
    },
    {
      key: 'description',
      label: t('project.description'),
      span: 2,
      children: <span>{description}</span>,
    },
    {
      key: 'owner',
      label: t('project.owner'),
      children: (
        <span>
          {ownerUserId}, {teamId}
        </span>
      ),
    },
    {
      key: 'stakeholders',
      label: t('project.stakeholders'),
      span: 2,
      children: <span></span>,
    },
    {
      key: 'createDate',
      label: t('project.createDate'),
      children: <span>{dayjs(createdAt).format('MM/DD/YYYY')}</span>,
    },
    {
      key: 'dueDate',
      label: t('project.dueDate'),
      children: (
        <span>{dueDate ? dayjs(dueDate).format('MM/DD/YYYY') : ''}</span>
      ),
    },
  ];
  return items;
}
