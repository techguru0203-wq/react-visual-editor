import { useTeamOrOrganizationUsers } from '../../containers/team/hooks/useTeamOrOrganizationUsers';
import { useLanguage } from '../contexts/languageContext';
import { SelectUser, SelectUserProps } from './SelectUser';

type SelectTeamUserProps = SelectUserProps &
  Readonly<{
    teamId?: string | null; // If this is not provided, we fall back to the organization users
  }>;

// Use this component to select a user from within a team.
// If the teamId is not specified, this will fall back to the whole organization
export function SelectTeamUser({
  teamId,
  disabled,
  placeholder,
  ...selectUserProps
}: SelectTeamUserProps) {
  const { t } = useLanguage();
  const {
    data: availableUsers,
    isLoading,
    isError,
    error,
  } = useTeamOrOrganizationUsers({ source: 'team', teamId });

  if (isError) {
    throw error;
  }

  return (
    <SelectUser
      {...selectUserProps}
      availableUsers={availableUsers || []}
      disabled={isLoading || disabled || !availableUsers.length}
      placeholder={isLoading ? t('common.loading') : placeholder}
    />
  );
}
