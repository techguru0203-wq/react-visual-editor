import { useEffect, useRef, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { DOCTYPE } from '@prisma/client';
import {
  Button,
  Divider,
  Flex,
  Popover,
  Space,
  Tag,
  Tree,
  TreeDataNode,
} from 'antd';

import { ProjectOutput } from '../../../../../shared/types';
import { useAppModal } from '../../../common/components/AppModal';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { useUserDocuments } from '../../documents/hooks/useUserDocuments';
import { DocumentTypeNameMapping } from '../../documents/types/documentTypes';

type DevPlanDocumentProps = Readonly<{
  project?: ProjectOutput | null | undefined;
  value: ReadonlyArray<string>;
  onChange?: (value: ReadonlyArray<string>) => void;
  disabled?: boolean;
}>;

export function DevPlanDocument({
  project,
  onChange,
  value,
  disabled = false,
}: DevPlanDocumentProps) {
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const { data: documents } = useUserDocuments(user.id);
  const { showAppModal } = useAppModal();
  const [isOpen, setIsOpen] = useState(false);
  const [docTreeData, setDocTreeData] = useState<TreeDataNode[]>([]);
  const initialSelectionMade = useRef(false);

  useEffect(() => {
    // Set up tree data
    const treeData: TreeDataNode[] = [];
    documents
      ?.filter(
        (item) =>
          (item.type === DOCTYPE.PRD || item.type === DOCTYPE.TECH_DESIGN) &&
          item.name
      )
      .forEach((doc) => {
        treeData.push({
          key: String(doc.id),
          title: `${DocumentTypeNameMapping(t)[doc.type].name}: ${doc.name}`,
        });
      });
    setDocTreeData(treeData);

    // Set initial value if not already set and we have documents
    if (
      !initialSelectionMade.current &&
      documents?.length &&
      project?.id &&
      onChange
    ) {
      const defaultDocId = documents.find(
        (doc) => doc.projectId === project.id && doc.type === DOCTYPE.PRD
      )?.id;

      if (defaultDocId && !value.includes(defaultDocId)) {
        onChange([defaultDocId]);
        initialSelectionMade.current = true;
      }
    }
  }, [documents, project, onChange, value]);

  const onDocumentChange = (selectedDocumentIds: ReadonlyArray<string>) => {
    if (onChange) {
      onChange(selectedDocumentIds);
    }
  };

  useEffect(() => {
    const clickBody = () => {
      setIsOpen(false);
    };

    window.document.body.addEventListener('click', clickBody);
    return () => {
      window.document.body.removeEventListener('click', clickBody);
    };
  }, []);

  const selectedDocNames = documents
    ?.filter((doc) => value?.includes(doc.id))
    ?.map((doc) => doc.name);

  return (
    <Popover
      open={isOpen}
      content={
        <Flex vertical>
          <Flex
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Tree
              style={{ maxHeight: '500px', overflow: 'auto' }}
              checkable
              checkedKeys={value as string[]}
              treeData={docTreeData}
              onCheck={(checkedKeys) => {
                onDocumentChange(checkedKeys as string[]);
              }}
              disabled={disabled}
            />
          </Flex>
          <Divider style={{ margin: '8px 0' }} />
          <Space style={{ padding: '0 8px 4px', paddingLeft: '18px' }}>
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                showAppModal({ type: 'addDocument' });
              }}
              disabled={disabled}
            >
              {t('devplan.addNewDocument')}
            </Button>
          </Space>
        </Flex>
      }
      title="Documents"
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="custom-input"
      >
        {selectedDocNames?.length ? (
          <>
            <div className="input-content">{selectedDocNames[0]}</div>
            {selectedDocNames.length > 1 ? (
              <Tag
                style={{
                  alignItems: 'center',
                  display: 'flex',
                  marginRight: 0,
                }}
              >
                +{selectedDocNames.length - 1}
              </Tag>
            ) : (
              ''
            )}
          </>
        ) : (
          <div className="placeholder text-ellipsis">
            {t('devplan.selectDocumentOrAdd')}
          </div>
        )}
      </div>
    </Popover>
  );
}
