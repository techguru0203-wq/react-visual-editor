import { Droppable } from '@hello-pangea/dnd';
import { Button, Divider, Typography } from 'antd';

import {
  IssueOutput,
  ProjectOutput,
  ProjectTask,
} from '../../../../../../shared/types';
import { useAppModal } from '../../../../common/components/AppModal';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { useTeamOrOrganizationUsers } from '../../../team/hooks/useTeamOrOrganizationUsers';
import { MemoSprintViewCard } from '../board/SprintViewCard';

type IssueTableProps = Readonly<{
  project: ProjectOutput;
  issues: ReadonlyArray<ProjectTask & { rowindex?: number }>;
  title?: string;
  tableId: string;
  issueMap: Map<string, IssueOutput>;
  editable?: boolean;
}>;

export function IssueTable({
  project,
  issues,
  title,
  tableId,
  issueMap,
  editable = true,
}: IssueTableProps) {
  const { data: availableOwners } = useTeamOrOrganizationUsers({
    source: 'team',
    teamId: project?.team?.id,
  });

  const { showAppModal } = useAppModal();
  const { t } = useLanguage();

  return (
    <div>
      <Typography.Paragraph
        style={{
          fontWeight: 'bold',
          paddingTop: '10px',
          marginBottom: '10px',
        }}
      >
        {title}
        <Button
          size="small"
          style={{
            float: 'right',
            fontSize: '12px',
          }}
          onClick={() => {
            showAppModal({
              type: 'addIssue',
              workPlanId: tableId,
            });
          }}
          disabled={!editable}
        >
          {' '}
          {t('building.addIssueButton')}
        </Button>
        <div
          style={{
            clear: 'both',
          }}
        ></div>
      </Typography.Paragraph>
      <Divider
        style={{
          margin: 0,
          border: '0.5px solid grey',
        }}
      />
      <Droppable droppableId={tableId}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            style={{
              minHeight: '100px',
              paddingBottom: '25px',
              paddingTop: '10px',
            }}
          >
            {issues.map((issue, i) => {
              return (
                <MemoSprintViewCard
                  availableOwners={availableOwners}
                  task={issue}
                  idMap={issueMap}
                  index={i}
                  showStatus={true}
                  key={issue.id}
                  editable={editable}
                ></MemoSprintViewCard>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
