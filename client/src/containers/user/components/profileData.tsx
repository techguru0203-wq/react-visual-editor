import { Flex } from 'antd';

import EditProfile from '../../profile/components/EditProfile';

type ConfirmUserInvitationProps = Readonly<{
  onSuccess: () => void;
}>;

type FormValues = Readonly<{
  inviterEmail?: string;
}>;

export function ProfileData({ onSuccess }: ConfirmUserInvitationProps) {
  return (
    <Flex justify="center" vertical>
      <EditProfile requireCompanyData={false} requireProfileData={true} />
    </Flex>
  );
}
