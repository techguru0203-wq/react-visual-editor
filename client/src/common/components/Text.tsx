import React from 'react';

import COLORS from '../util/color';

interface ComponentProps {
  text: string;
  className?: string;
  fontSize?: number;
  color?: string;
  fontWeight?: number;
}

function Text({
  text,
  className = '',
  fontSize,
  color = COLORS.black,
  fontWeight = 400,
}: ComponentProps) {
  return (
    <div
      className={`Text ${className}`}
      style={{ fontSize, color, fontWeight }}
    >
      {text}
    </div>
  );
}

export default Text;
