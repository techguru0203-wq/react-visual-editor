import { IssueOutput, Sprint } from '../../../../../../shared/types';
import { useProject } from '../Project';
import { SprintOrganizationBoard } from './SprintOrganizationBoard';

export function ProjectOrganizationBoard() {
  const { project, filterMode, access } = useProject();

  console.log(
    'in containers.project.components.building.ProjectOrganizationBoard'
  );

  /*
    Here we assemble the necessary data to pass down to the 
    drag and drop board components themselves.

    issueMap: maps issueId to the Issue itself. 
      -- This is needed by the SprintViewCard.
    columnOrder: an array for the order in which sprints are displayed
      -- Note that the Backlog is treated as a special sprint and always in the 0 index position here
    columnMatrix: a matrix that follows the columnOrder, where each member is an array of Issues
      -- Note that the Backlog is always first, occupying the 0 index
    phaseIdToInd: maps sprintId to its position in the above columnOrder/columnMatrix index positions
      -- This map is necessary for the drag and drop onDragEnd handler, 
         which works to re-order the columns (each a list of Issues), when a drag/drop operation is performed.
    sprintMap: maps sprintId to Sprint itself. 
      -- This is used by SprintOrganizationBoard to obtain and display Sprint information for each Sprint's sections.
  */
  const issueMap = new Map<string, IssueOutput>();

  project?.issues?.forEach((issue) => {
    issueMap.set(issue.id, issue);
  });

  const columnOrder = [project.backlogId!];
  const phaseIdToInd: { [key: string]: number } = {};
  phaseIdToInd[project.backlogId!] = 0;
  const columnMatrix: IssueOutput[][] = [];
  const sprintMap: { [key: string]: Sprint } = {};

  columnMatrix.push(project.backlogIssues);

  // Note that because the Backlog already occupies the 0th index in columnOrder and columnMatrix,
  //  we need to +1 to i when storing the actual "real" sprints at their correct position
  project.sprints.forEach((sprint, i) => {
    columnOrder.push(sprint.id);
    sprintMap[sprint.id] = sprint;
    columnMatrix.push([]);
    columnMatrix[i + 1] = sprint.issues || [];
    phaseIdToInd[sprint.id] = i + 1;
  });

  return (
    <SprintOrganizationBoard
      columnMatrix={columnMatrix}
      columnOrder={columnOrder}
      project={project}
      phaseIdToInd={phaseIdToInd}
      issueMap={issueMap}
      sprintMap={sprintMap}
      filterMode={filterMode}
      editable={access?.projectPermission === 'EDIT'}
    />
  );
}
