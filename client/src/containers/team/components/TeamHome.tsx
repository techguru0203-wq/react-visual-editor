import { useCallback } from 'react';
import { Flex, Space, Typography } from 'antd';
import { useParams } from 'react-router';

import { useAppModal } from '../../../common/components/AppModal';
import { RollupSection } from '../../../common/components/RollupSection';
import { LoadingScreen } from '../../layout/components/LoadingScreen';
import { UserRollupCard } from '../../profile/components/UserRollupCard';
import ProjectsList from '../../project/components/ProjectsList';
import { useGetTeamApi } from '../hooks/useGetTeamApi';
import TeamDropDownMenu from './TeamDropdownMenu';

function useTeamIdParam() {
  const { id } = useParams();
  if (!id) {
    throw new Error('Please select a team');
  }
  return id;
}

export function TeamHome() {
  const { showAppModal } = useAppModal();
  const teamId = useTeamIdParam();
  const { data: team, isLoading, isError, error } = useGetTeamApi(teamId);

  const addMember = useCallback(() => {
    showAppModal({ type: 'addTeamMember', teamId });
  }, [showAppModal, teamId]);
  const createProject = useCallback(() => {
    showAppModal({ type: 'addProject', teamId });
  }, [showAppModal, teamId]);

  if (isError) {
    throw error;
  }

  if (isLoading || !team) {
    return <LoadingScreen />;
  }

  return (
    <Flex className="page-container" vertical>
      <div className="section-heading">
        <Space
          align="center"
          style={{
            marginBottom: '0.5em',
          }}
        >
          <Typography.Text style={{ fontSize: 16 }}>
            Team Space: {team.name.toUpperCase()}
          </Typography.Text>
          <TeamDropDownMenu team={team} />
        </Space>
      </div>
      <RollupSection
        title="Current Projects"
        actions={[{ label: '+Add Project', onClick: createProject }]}
      >
        <ProjectsList projects={team.projects} />
        <></>
      </RollupSection>

      <RollupSection
        title="Members"
        actions={[{ label: '+Add Member', onClick: addMember }]}
      >
        {team.members.map((member) => (
          <UserRollupCard
            key={member.userId}
            user={member.user}
            dateJoined={member.createdAt}
          />
        ))}
      </RollupSection>
    </Flex>
  );
}
