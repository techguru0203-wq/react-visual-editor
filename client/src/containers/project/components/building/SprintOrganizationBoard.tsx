import { useEffect, useState } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Col, Row } from 'antd';
import dayjs from 'dayjs';

import {
  IssueOutput,
  ProjectOutput,
  Sprint,
} from '../../../../../../shared/types';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { useUpdateIssueMutation } from '../../hooks/useIssueMutation';
import { IssueTable } from './IssueTable';

type SprintOrganizationBoardProps = Readonly<{
  project: ProjectOutput;
  columnOrder: string[];
  columnMatrix: IssueOutput[][];
  phaseIdToInd: { [key: string]: number };
  issueMap: Map<string, IssueOutput>;
  sprintMap: { [key: string]: Sprint };
  filterMode: string;
  editable?: boolean;
}>;

export function SprintOrganizationBoard({
  project,
  columnOrder,
  columnMatrix,
  phaseIdToInd,
  issueMap,
  sprintMap,
  filterMode,
  editable = true,
}: SprintOrganizationBoardProps) {
  const [colMatrix, setColMatrix] = useState(columnMatrix);
  const [issueCount, setIssueCount] = useState(issueMap.size);
  const { t } = useLanguage();

  const updateIssueMutation = useUpdateIssueMutation({
    onSuccess: () => {
      console.log('updateIssueMutation.success');
    },
    onError: (e) => {
      console.error('updateIssueMutation.error:', e);
    },
  });

  useEffect(() => {
    if (issueMap.size !== issueCount) {
      setColMatrix(columnMatrix);
      setIssueCount(issueMap.size);
    }
  }, [issueMap, columnMatrix, issueCount]);

  /**
   * This is the onDragEnd handler that manages the visual re-construction when an item is dragged and dropped
   *
   * This function may seem complex, but it is actually quite simple:
   *
   * Visually, we use react state in colMatrix to represent the visual state organization of the board
   *
   *  [
   *    [issueA, issueB],     Backlog column
   *    [issueC, issueD],     Sprint1 column
   *    [issueE, issueF],     Sprint2 column
   *    [issueH, issueG],     Sprint3 column
   *    ...
   *  ]
   *
   *  When we drag from one column and drop in one column,
   *  the dnd library captures data about source and destination.
   *
   *  This handler takes the ids provided about the dragged item, source, and destination
   *  and then with the props passed to this Board, can locate which places in the matrix
   *  are to change.
   *
   *  It makes those array changes via copying, splicing into new locations, and then updates state
   */
  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination || filterMode === 'kanban') {
      return;
    }

    const sourcePhaseId = source.droppableId;
    const destPhaseId = destination.droppableId;
    const sourceOrderIndex = source.index;
    const destOrderIndex = destination.index;

    // was dropped in same section, same order
    if (sourcePhaseId === destPhaseId && sourceOrderIndex === destOrderIndex) {
      return;
    }

    const sourceMatrixIndex = phaseIdToInd[sourcePhaseId];
    const sourceColumn = colMatrix[sourceMatrixIndex] || [];
    // reorder sourceColumn contents
    const updatedSourceColumn = Array.from(sourceColumn);
    updatedSourceColumn.splice(sourceOrderIndex, 1);

    // reorder destination contents
    if (sourcePhaseId === destPhaseId) {
      // if drag and drop was inside same section
      updatedSourceColumn.splice(destOrderIndex, 0, issueMap.get(draggableId)!);

      const updatedMatrix = [...colMatrix];
      updatedMatrix[sourceMatrixIndex] = updatedSourceColumn;
      setColMatrix(updatedMatrix);
    } else {
      // if dropped to a different section

      const destMatrixIndex = phaseIdToInd[destPhaseId];
      const destColumn = colMatrix[destMatrixIndex] || [];

      const updatedDestColumn = Array.from(destColumn);
      updatedDestColumn.splice(destOrderIndex, 0, issueMap.get(draggableId)!);

      const updatedMatrix = [...colMatrix];
      updatedMatrix[sourceMatrixIndex] = updatedSourceColumn;
      updatedMatrix[destMatrixIndex] = updatedDestColumn;
      setColMatrix(updatedMatrix);

      updateIssueMutation.mutate({
        id: draggableId,
        workPlanId: destination.droppableId,
      });
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Row>
        {filterMode === 'kanban' ? (
          <Col
            style={{
              height: '670px',
              overflow: 'scroll',
              backgroundColor: '#e3efff', // light blue
              padding: '0 12px',
            }}
            span={24}
          >
            <IssueTable
              title={t('building.issues')}
              tableId={project.backlogId!}
              project={project}
              issues={Array.from(issueMap.values())}
              issueMap={issueMap}
              editable={editable}
            />
          </Col>
        ) : (
          <>
            <Col
              style={{
                padding: '0 12px',
                backgroundColor: '#f8f8f8', // light grey
                overflow: 'auto',
                height: '670px',
              }}
              lg={12}
              xs={24}
            >
              <IssueTable
                title={t('building.backlog')}
                tableId={project.backlogId!}
                project={project}
                issues={colMatrix[0] || []}
                issueMap={issueMap}
                editable={editable}
              />
            </Col>
            <Col
              style={{
                height: '670px',
                overflow: 'auto',
                backgroundColor: '#e3efff', // light blue
                padding: '0 12px',
              }}
              lg={12}
              xs={24}
            >
              {columnOrder.length > 1 ? (
                columnOrder.map((sprintId, i) => {
                  if (i === 0) return null; // ignore backlog

                  const sprintIssues = colMatrix[i];
                  const displayIssues = sprintIssues.filter(
                    (issue) =>
                      issue &&
                      (!issue.childIssues || issue.childIssues.length === 0)
                  );

                  const sprint = sprintMap[sprintId];

                  const sprintStartDate =
                    sprint.actualStartDate || sprint.plannedStartDate;
                  const sprintEndDate =
                    sprint.actualEndDate || sprint.plannedEndDate;
                  const displayStartDate =
                    dayjs(sprintStartDate).format('MM/DD/YYYY');
                  const displayEndDate =
                    dayjs(sprintEndDate).format('MM/DD/YYYY');

                  const sprintDisplayName = `${displayStartDate} - ${displayEndDate}: ${sprint.name}`;

                  return (
                    <IssueTable
                      title={sprintDisplayName}
                      tableId={sprint.id}
                      project={project}
                      issues={displayIssues || []}
                      key={i}
                      issueMap={issueMap}
                      editable={editable}
                    />
                  );
                })
              ) : (
                /* display text if no sprints below with antd typography.italic  */
                <div style={{ textAlign: 'center', paddingTop: '20px' }}>
                  <p
                    style={{
                      fontSize: '18px',
                      fontStyle: 'italic',
                      color: 'gray',
                    }}
                  >
                    {t('building.noSprintsAvailable')}
                  </p>
                </div>
              )}
            </Col>
          </>
        )}
      </Row>
    </DragDropContext>
  );
}
