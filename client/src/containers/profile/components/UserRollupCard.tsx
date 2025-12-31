import { RecordStatus } from '@prisma/client';
import { Card } from 'antd';

import { UserAvatar } from '../../../common/components/UserAvatar';
import { useLanguage } from '../../../common/contexts/languageContext';
import { getSpecialtyDisplayName } from '../profileUtils';
import { UserProfile } from '../types/profileTypes';

type UserRollupCardProps = Readonly<{
  user: Pick<
    UserProfile,
    | 'id'
    | 'username'
    | 'email'
    | 'specialty'
    | 'status'
    | 'velocity'
    | 'firstname'
    | 'lastname'
  >;
  dateJoined: Date;
}>;

// This component is a Card for use on a Rollup page. This card will render a User object in a standard way
// You specify the dateJoined separate from the user since it may be different for different contexts (as in when the user joined a project, team, or organization)
export function UserRollupCard({ user, dateJoined }: UserRollupCardProps) {
  const { t } = useLanguage();
  return (
    <Card className="user-card">
      <Card.Meta
        avatar={<UserAvatar user={user} size="40" />}
        title={user.username}
        description={
          user.status === RecordStatus.PENDING
            ? 'Pending'
            : getSpecialtyDisplayName(user.specialty, t)
        }
      />
    </Card>
  );
}
