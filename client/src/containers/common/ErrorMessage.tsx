import { Typography } from 'antd';

type ErrorMessageProps = Readonly<{
  message: string;
}>;

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <Typography.Paragraph style={{ paddingBottom: '20px' }}>
      {message}
    </Typography.Paragraph>
  );
}
