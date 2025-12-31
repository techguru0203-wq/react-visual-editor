import { Droppable } from '@hello-pangea/dnd';

import { IssueOutput, ProjectOutput } from '../../../../../../shared/types';
import { useTeamOrOrganizationUsers } from '../../../team/hooks/useTeamOrOrganizationUsers';
import { MemoSprintViewCard } from './SprintViewCard';

type ColumnProps = Readonly<{
  project: ProjectOutput;
  status: {
    label: string;
    value: string;
  };
  tasks: IssueOutput[];
  idMap: Map<string, IssueOutput>;
  editable?: boolean;
}>;

export default function Column({
  project,
  status,
  tasks,
  idMap,
  editable = true,
}: ColumnProps) {
  const { data: availableOwners } = useTeamOrOrganizationUsers({
    source: 'team',
    teamId: project?.team?.id,
  });

  return (
    <Droppable droppableId={status.value}>
      {(provided) => (
        <div
          style={{
            padding: '5px',
            height: '800px',
            overflow: 'auto',
          }}
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          {tasks.map((task, i) => (
            <div
              style={{
                marginBottom: '0 5px',
              }}
              key={task.id}
            >
              <MemoSprintViewCard
                availableOwners={availableOwners}
                task={task}
                idMap={idMap}
                index={i}
                showDescription={true}
                editable={editable}
              ></MemoSprintViewCard>
            </div>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
