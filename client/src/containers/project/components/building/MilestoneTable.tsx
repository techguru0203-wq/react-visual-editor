import { useEffect, useMemo, useState } from 'react';
import { WorkPlanStatus } from '@prisma/client';
import { Spin, Table } from 'antd';

import {
  ProjectMilestone,
  ProjectOutput,
} from '../../../../../../shared/types';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { workplanStatus } from '../../../../lib/constants';
import useWorkPlanMutation from '../../hooks/userWorkPlanMutation';
import { useEpicGoalsColumn } from './columns/useEpicGoalsColumn';
import { useOwnerAndNameColumn } from './columns/useOwnerAndNameColumn';
import { useProgressColumn } from './columns/useProgressColumn';
import { useScheduleColumn } from './columns/useScheduleColumn';
import { useStatusColumn } from './columns/useStatusColumn';
import { SprintTable } from './SprintTable';
import { TaskTable } from './TaskTable';

type MilestoneTableProps = Readonly<{
  project: ProjectOutput;
  className?: string;
  milestones: ReadonlyArray<ProjectMilestone>;
  filterMode: string;
  editable?: boolean;
}>;

export function MilestoneTable({
  project,
  className,
  milestones,
  filterMode,
  editable = true,
}: MilestoneTableProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [screenSize, setScreenSize] = useState<'desktop' | 'tablet' | 'mobile'>(
    'desktop'
  );
  const { t } = useLanguage();

  const { updateWorkPlanMutation } = useWorkPlanMutation({
    onSuccess: () => {
      setIsLoading(false);
      console.log('updateWorkPlanMutation.success');
    },
    onError: (e) => {
      setIsLoading(false);
      console.error('updateWorkPlanMutation.error:', e);
    },
  });
  const ownerAndNameColumn = useOwnerAndNameColumn({
    title: t('building.milestone'),
    teamId: project.teamId,
    onChange: (arg: {
      id: string;
      ownerUserId?: string | undefined;
      name?: string | undefined;
    }) => {
      setIsLoading(true);
      updateWorkPlanMutation.mutate({
        id: arg.id,
        ownerUserId: arg.ownerUserId,
      });
    },
  });
  const epicGoalsColumn = useEpicGoalsColumn();
  const scheduleColumn = useScheduleColumn();
  const progressColumn = useProgressColumn();
  const statusColumn = useStatusColumn({
    options: workplanStatus,
    onChange: (item: { id: string; status: WorkPlanStatus | undefined }) => {
      setIsLoading(true);
      updateWorkPlanMutation.mutate(item);
    },
    editable: editable,
  });

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width <= 575) {
        setScreenSize('mobile');
      } else if (width <= 1023) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };
    window.addEventListener('resize', updateScreenSize);
    updateScreenSize();
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  const milestoneColumns = useMemo(() => {
    if (screenSize === 'mobile') {
      return [ownerAndNameColumn, epicGoalsColumn];
    }
    if (screenSize === 'tablet') {
      return [ownerAndNameColumn, epicGoalsColumn, statusColumn];
    }
    return [
      ownerAndNameColumn,
      epicGoalsColumn,
      scheduleColumn,
      progressColumn,
      statusColumn,
    ];
  }, [
    screenSize,
    ownerAndNameColumn,
    epicGoalsColumn,
    scheduleColumn,
    progressColumn,
    statusColumn,
  ]);

  return (
    <Spin spinning={isLoading}>
      <Table
        className={className}
        columns={milestoneColumns}
        rowKey="id"
        expandable={{
          expandedRowRender: (record: ProjectMilestone) =>
            filterMode === 'kanban' ? (
              <TaskTable
                className="backlog-table"
                project={project}
                issues={record.sprints.flatMap((sprint) =>
                  sprint.stories
                    .map(({ tasks, ...story }) =>
                      tasks.map((task) => ({ ...task, parentIssue: story }))
                    )
                    .flat()
                )}
                setIsLoading={setIsLoading}
                editable={editable}
              />
            ) : (
              <SprintTable
                project={project}
                sprints={record.sprints}
                setIsLoading={setIsLoading}
                editable={editable}
              />
            ),
          indentSize: 0,
          defaultExpandedRowKeys: [milestones[0].id],
        }}
        dataSource={milestones}
      />
    </Spin>
  );
}
