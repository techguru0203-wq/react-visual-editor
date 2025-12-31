import { FC, PropsWithChildren } from 'react';
import { Typography } from 'antd';

import './StatusBadge.css';

export interface StatusBadgeProps {
  backgroundColor?: string;
  color?: string;
  text?: string;
}

export const StatusBadge: FC<PropsWithChildren<StatusBadgeProps>> = (props) => {
  const { backgroundColor, color, text, children } = props;
  // TODO parse color and maintain a11y contrast, or use variants instead of allowing for any color
  return (
    <div className="status-badge" style={{ backgroundColor: backgroundColor }}>
      {text != null ? <Typography.Text color={color}>{text}</Typography.Text> : null}
      {children}
    </div>
  );
}
