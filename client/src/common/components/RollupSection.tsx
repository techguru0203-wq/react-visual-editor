import { Flex, Typography } from 'antd';

type RollupSectionProps = Readonly<{
  title: string;
  children: ReadonlyArray<React.ReactElement>;
  actions: ReadonlyArray<{
    label: string;
    onClick: () => void;
  }>;
}>;

// This component is a section in one of the Rollup pages - either an Organization or a Team.
// In future it may be used in other rollup-style pages as well.
export function RollupSection({
  title,
  children,
  actions,
}: RollupSectionProps) {
  return (
    <>
      <div className="section-heading">
        <Flex align="center">
          <Typography.Title
            id="current-proj"
            level={4}
            className="main-heading"
          >
            {title}
          </Typography.Title>
          <div className="actions">
            {actions.map((action) => (
              <Typography.Link
                key={action.label}
                className="subtitle-link"
                onClick={action.onClick}
              >
                {action.label}
              </Typography.Link>
            ))}
          </div>
        </Flex>
      </div>
      {Boolean(children.length) && (
        <Flex gap={10} wrap="wrap">
          {children}
        </Flex>
      )}
      {/* <Divider /> */}
    </>
  );
}
