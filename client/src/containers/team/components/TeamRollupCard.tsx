import { Card } from 'antd';
import { Link } from 'react-router-dom';

import { TeamPath } from '../../nav/paths';
import { TeamOutput, TeamWithCounts } from '../types/teamTypes';

type TeamRollupCardProps = Readonly<{
  team: TeamOutput | TeamWithCounts;
}>;

// This component renders a team as a Card for use in a rollup-style page
export function TeamRollupCard({ team }: TeamRollupCardProps) {
  const projectCount =
    '_count' in team ? team._count.projects : team.projects.length;
  const memberCount =
    '_count' in team ? team._count.members : team.members.length;
  const childTeamCount =
    '_count' in team ? team._count.childTeams : team.childTeams.length;

  return (
    <Link className="link-card" to={`/${TeamPath}/${team.id}`}>
      <Card>
        <Card.Meta
          title={team.name}
          description={
            <>
              {Boolean(projectCount) && <div>{projectCount} Project(s)</div>}
              {Boolean(childTeamCount) && (
                <div>{childTeamCount} Sub-Team(s)</div>
              )}
              <div>{memberCount} Member(s)</div>
            </>
          }
        />
      </Card>
    </Link>
  );
}
