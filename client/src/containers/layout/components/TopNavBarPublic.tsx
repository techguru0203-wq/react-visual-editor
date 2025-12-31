import { Typography } from 'antd';
import { Link } from 'react-router-dom';

export default function TopNavBarPublic() {
  return (
    <Link to="/">
      <Typography.Text className="organization">Omniflow</Typography.Text>
    </Link>
  );
}
