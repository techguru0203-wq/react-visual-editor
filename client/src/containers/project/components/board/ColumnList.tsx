import { useEffect, useState } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Col, List } from 'antd';

import { IssueOutput, ProjectOutput } from '../../../../../../shared/types';
import { getIssueStatusOptions } from '../../../../common/constants';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { issueStatusToEnum } from '../../../../lib/constants';
import { useUpdateIssueMutation } from '../../hooks/useIssueMutation';
import Column from './Column';

type ColumnListProps = Readonly<{
  project: ProjectOutput;
  issues?: IssueOutput[];
  editable?: boolean;
}>;

const emptyStatusMap: { [key: string]: IssueOutput[] } = {
  CREATED: [],
  STARTED: [],
  INREVIEW: [],
  APPROVED: [],
  COMPLETED: [],
  CANCELED: [],
};

export default function ColumnList({
  project,
  issues,
  editable = true,
}: ColumnListProps) {
  const [statusMap, setStatusMap] = useState(emptyStatusMap);
  const [idMap, setIdMap] = useState(new Map<string, IssueOutput>());
  const { t } = useLanguage();

  // when sprint prop changes, the current statusMap state will be outdate so reset it
  useEffect(() => {
    const sprintStatusMap: { [key: string]: IssueOutput[] } = {
      CREATED: [],
      STARTED: [],
      INREVIEW: [],
      APPROVED: [],
      COMPLETED: [],
      CANCELED: [],
    };

    const issuesIdMap = new Map<string, IssueOutput>();

    issues?.forEach((issue) => {
      issuesIdMap.set(issue.id, issue);

      const status = issue.status.toString();
      const issuesOfStatus = sprintStatusMap[status];
      if (issuesOfStatus) {
        issuesOfStatus.push(issue);
      }
    });

    setStatusMap(sprintStatusMap);
    setIdMap(issuesIdMap);
  }, [issues]);

  const updateIssueMutation = useUpdateIssueMutation({
    onSuccess: () => {
      console.log('updateIssueMutation.success');
    },
    onError: (e) => {
      console.error('updateIssueMutation.error:', e);
    },
  });

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) {
      return;
    }

    const sourceColumnId = source.droppableId;
    const destColumnId = destination.droppableId;
    const sourceOrderIndex = source.index;
    const destOrderIndex = destination.index;

    // was dropped in same column, same order
    if (
      sourceColumnId === destColumnId &&
      sourceOrderIndex === destOrderIndex
    ) {
      return;
    }

    const sourceColumn = statusMap[sourceColumnId];
    // reorder sourceColumn contents
    const updatedSourceColumn = Array.from(sourceColumn);
    updatedSourceColumn.splice(sourceOrderIndex, 1);

    // reorder destination contents
    if (sourceColumnId === destColumnId) {
      // if drag and drop was inside same column
      updatedSourceColumn.splice(destOrderIndex, 0, idMap.get(draggableId)!);

      setStatusMap({
        ...statusMap,
        [destColumnId]: updatedSourceColumn,
      });
    } else {
      // if dropped to a different column
      const destColumn = statusMap[destColumnId];
      const updatedDestColumn = Array.from(destColumn);
      updatedDestColumn.splice(destOrderIndex, 0, idMap.get(draggableId)!);

      setStatusMap({
        ...statusMap,
        [sourceColumnId]: updatedSourceColumn,
        [destColumnId]: updatedDestColumn,
      });

      const newStatus = destination.droppableId || '';

      updateIssueMutation.mutate({
        id: draggableId,
        status: issueStatusToEnum[newStatus],
      });
    }
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        {
          <List
            grid={{
              gutter: 16,
              column: 6,
              xs: 1,
              sm: 2,
              md: 3,
              lg: 4,
              xl: 5,
            }}
            dataSource={getIssueStatusOptions(t)}
            renderItem={(item) => (
              <List.Item
                style={{
                  backgroundColor: '#f8f8f8', // very very light gray
                }}
                key={item.value}
              >
                <Col
                  style={{
                    padding: '10px 15px',
                    fontWeight: 'bold',
                    borderBottom: '1px solid #ccc', // medium gray border
                  }}
                >
                  {item.label}
                </Col>
                <Column
                  project={project}
                  status={item}
                  tasks={statusMap[item.value]}
                  idMap={idMap}
                  editable={editable}
                />
              </List.Item>
            )}
          ></List>
        }
      </DragDropContext>
    </>
  );
}
