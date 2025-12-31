import { useOrganizationUsers } from '../../containers/organization/hooks/useOrganizationUsers';
import { useLanguage } from '../contexts/languageContext';
import { SelectUser, SelectUserProps } from './SelectUser';

type SelectOrganizationUserProps = SelectUserProps &
  Readonly<{ excludeTeamId?: string }>;

// Use this component to select a use from within an organization
// You can specify a team to exclude
export function SelectOrganizationUser({
  excludeTeamId,
  disabled,
  placeholder,
  ...selectUserProps
}: SelectOrganizationUserProps) {
  const { t } = useLanguage();
  const {
    data: availableUsers,
    isLoading,
    isError,
    error,
  } = useOrganizationUsers({ excludeTeamId });

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
