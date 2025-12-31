import { useEffect, useMemo, useState } from 'react';
import { WorkPlanStatus } from '@prisma/client';
import { Table } from 'antd';
import dayjs from 'dayjs';

import { ProjectOutput, ProjectSprint } from '../../../../../../shared/types';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { workplanStatus } from '../../../../lib/constants';
import useWorkPlanMutation from '../../hooks/userWorkPlanMutation';
import { useOwnerAndNameColumn } from './columns/useOwnerAndNameColumn';
import { useProgressColumn } from './columns/useProgressColumn';
import { useScheduleColumn } from './columns/useScheduleColumn';
import { useStatusColumn } from './columns/useStatusColumn';
import { TaskTable } from './TaskTable';

type SprintTableProps = Readonly<{
  className?: string;
  project: ProjectOutput;
  sprints: ReadonlyArray<ProjectSprint>;
  setIsLoading: (isLoading: boolean) => void;
  editable?: boolean;
}>;

export function SprintTable({
  className,
  project,
  sprints,
  setIsLoading,
  editable = true,
}: SprintTableProps) {
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
    title: t('building.sprint'),
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
  const scheduleColumn = useScheduleColumn();
  const progressColumn = useProgressColumn();
  const statusColumn = useStatusColumn({
    options: workplanStatus,
    onChange: (item: { id: string; status: WorkPlanStatus | undefined }) => {
      setIsLoading(true);
      updateWorkPlanMutation.mutate(item);
    },
    editable,
  });

  const sortedSprints = [...sprints].sort(
    (a, b) =>
      dayjs(a.plannedStartDate).unix() - dayjs(b.plannedStartDate).unix()
  );

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

  const sprintColumns = useMemo(() => {
    if (screenSize === 'mobile') {
      return [ownerAndNameColumn, statusColumn];
    }
    if (screenSize === 'tablet') {
      return [ownerAndNameColumn, scheduleColumn, statusColumn];
    }
    return [ownerAndNameColumn, scheduleColumn, progressColumn, statusColumn];
  }, [
    screenSize,
    ownerAndNameColumn,
    scheduleColumn,
    progressColumn,
    statusColumn,
  ]);

  return (
    <Table
      className={className}
      columns={sprintColumns}
      rowKey="id"
      dataSource={sortedSprints}
      expandable={{
        expandedRowRender: (sprint: ProjectSprint) => (
          <TaskTable
            className="backlog-table"
            project={project}
            issues={sprint.stories
              .map(({ tasks, ...story }) =>
                tasks.map((task) => ({ ...task, parentIssue: story }))
              )
              .flat()}
            setIsLoading={setIsLoading}
            editable={editable}
          />
        ),
        indentSize: 0,
        defaultExpandedRowKeys: [sortedSprints[0].id],
      }}
      onRow={(record, rowIndex) => {
        return {
          onClick: (event) => {}, // click row
          onDoubleClick: (event) => {}, // double click row
          onContextMenu: (event) => {
            event.preventDefault();
            console.log(
              'in containers.project.components.ProjectExecution.onContextMenu:',
              event
            );
          },
        };
      }}
      pagination={false}
    />
  );
}
