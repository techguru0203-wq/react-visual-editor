import { useState } from 'react';
import { Empty, Spin } from 'antd';

import { useProject } from '../Project';
import { TaskTable } from './TaskTable';

export function ProjectBacklog() {
  const { project } = useProject();
  const [isLoading, setIsLoading] = useState(false);
  if (!project.backlog) {
    return (
      <Empty description="You may add backlog issues through clicking on the + action button" />
    );
  }

  // TODO: In future, we also need to show stories in the backlog.

  return (
    <Spin spinning={isLoading}>
      <TaskTable
        className="backlog-table"
        project={project}
        issues={project.backlog.tasks}
        setIsLoading={setIsLoading}
      />
    </Spin>
  );
}
