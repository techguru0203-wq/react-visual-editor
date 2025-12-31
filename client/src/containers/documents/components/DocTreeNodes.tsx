import { useCallback, useEffect, useState } from 'react';
import { PaperClipOutlined } from '@ant-design/icons';
import { DOCTYPE } from '@prisma/client';
import {
  Flex,
  Input,
  Popover,
  Space,
  Tag,
  Tooltip,
  Tree,
  TreeDataNode,
  Typography,
} from 'antd';
import debounce from 'lodash/debounce';

import { useLanguage } from '../../../common/contexts/languageContext';
import { COLORS } from '../../../lib/constants';
import { DevPlanOutput } from '../../devPlans/types/devPlanTypes';
import {
  DocumentOutput,
  DocumentTypeNameMapping,
} from '../types/documentTypes';

type DocTreeNodesProps = Readonly<{
  docTreeData?: TreeDataNode[];
  docs?: DocumentOutput[];
  selectedDocNodes?: TreeDataNode[];
  currentDoc?: DocumentOutput | DevPlanOutput;
  setSelectedDocNodes?: (nodes: TreeDataNode[]) => void;
  linkIcon?: boolean;
}>;

export default function DocTreeNodes({
  docs,
  selectedDocNodes = [],
  currentDoc,
  setSelectedDocNodes,
  linkIcon = false,
}: DocTreeNodesProps) {
  const { t } = useLanguage();
  const [docTreeData, setDocTreeData] = useState<TreeDataNode[]>([]);
  const [latestChosenDocumentIds, setLatestChosenDocumentIds] = useState('');
  const [defaultSelectedKeys, setDefaultSelectedKeys] = useState(['']);
  const [isMobile, setIsMobile] = useState(false);
  const [isInitialSelectionSet, setIsInitialSelectionSet] = useState(false);

  const [keyword, setKeyword] = useState('');

  const onSearch = (e: any) => {
    console.log(e, e.target.value);
    setKeyword(e.target.value);
  };

  const debounceSearch = debounce(onSearch, 800);

  // Helper function to translate document name with type prefix
  const translateDocumentName = useCallback(
    (docName: string, docType?: string) => {
      // Common document type prefixes that might appear in document names
      const typePrefixMap: Record<string, string> = {
        PRD: t('document.prd'),
        Prototype: t('document.prototype'),
        'UI Design': t('document.uiDesign'),
        'UI/UX Design': t('document.uiDesign'),
        'Technical Design': t('document.techDesign'),
        'Tech Design': t('document.techDesign'),
        'Development Plan': t('document.developmentPlan'),
        'QA Plan': t('document.qaPlan'),
        'QA & Test Plan': t('document.qaPlan'),
        'Release Plan': t('document.releasePlan'),
        Product: t('document.product'),
        Marketing: t('document.marketing'),
      };

      // Try to find and replace type prefix
      for (const [englishPrefix, translatedPrefix] of Object.entries(
        typePrefixMap
      )) {
        // Handle different separator patterns: "PRD - Name", "PRD: Name", "PRD Name"
        const patterns = [
          new RegExp(`^${englishPrefix}\\s*-\\s*(.+)$`, 'i'),
          new RegExp(`^${englishPrefix}\\s*:\\s*(.+)$`, 'i'),
          new RegExp(`^${englishPrefix}\\s+(.+)$`, 'i'),
        ];

        for (const pattern of patterns) {
          const match = docName.match(pattern);
          if (match) {
            return `${translatedPrefix} - ${match[1]}`;
          }
        }
      }

      // If no pattern matches, return original name
      return docName;
    },
    [t]
  );

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 575);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  useEffect(() => {
    const treeData: TreeDataNode[] = [];
    docs
      ?.filter(
        (doc) =>
          doc.id !== currentDoc?.id &&
          !!doc.name &&
          doc.type === DOCTYPE.PRD && // only keep PRD
          doc.name.toLowerCase().includes(keyword.toLowerCase())
      )
      .forEach((doc) => {
        const existingNode = treeData.find(
          (node) => node.key === doc.projectId || node.key === doc.project?.id
        );
        if (!existingNode) {
          if (doc.project) {
            treeData.push({
              key: String(doc.project.id),
              title: `${t('project.label')}: ${doc.project.name}`,
              disableCheckbox: true,
              children: [
                {
                  key: doc.id,
                  title: (
                    <span>
                      <a
                        target="_blank"
                        href={
                          doc.type === DOCTYPE.DEVELOPMENT_PLAN
                            ? `/devplan/${doc.id}`
                            : `/docs/${doc.id}`
                        }
                        rel="noreferrer"
                      >
                        {translateDocumentName(doc.name, doc.type)}
                      </a>
                    </span>
                  ),
                },
              ],
            });
          } else {
            treeData.push({
              key: String(doc.id),
              title: (
                <span>
                  {doc.type
                    ? Object.values(DocumentTypeNameMapping(t)).find(
                        (item) => item.type === doc.type
                      )?.name || t('document.label')
                    : t('document.label')}
                  :&nbsp;
                  <a
                    target="_blank"
                    href={
                      doc.type === DOCTYPE.DEVELOPMENT_PLAN
                        ? `/devplan/${doc.id}`
                        : `/docs/${doc.id}`
                    }
                    rel="noreferrer"
                  >
                    {translateDocumentName(doc.name, doc.type)}
                  </a>
                </span>
              ),
            });
          }
        } else {
          const node = {
            key: String(doc.id),
            title: (
              <span>
                <a
                  target="_blank"
                  href={
                    doc.type === DOCTYPE.DEVELOPMENT_PLAN
                      ? `/devplan/${doc.id}`
                      : `/docs/${doc.id}`
                  }
                  rel="noreferrer"
                >
                  {translateDocumentName(doc.name, doc.type)}
                </a>
              </span>
            ),
          };
          existingNode?.children?.push(node);
        }
        if (
          doc.type === DOCTYPE.PRD &&
          ((doc.projectId &&
            currentDoc?.projectId === doc.projectId &&
            currentDoc?.type !== DOCTYPE.PRD &&
            !latestChosenDocumentIds) ||
            latestChosenDocumentIds.includes(doc.id))
        ) {
          setDefaultSelectedKeys([String(doc.id)]);
          if (!isInitialSelectionSet && setSelectedDocNodes) {
            setSelectedDocNodes([
              {
                key: String(doc.id),
                title: translateDocumentName(doc.name, doc.type),
              },
            ]);
            setIsInitialSelectionSet(true);
          }
        }
      });
    setDocTreeData(treeData);
  }, [
    docs,
    setSelectedDocNodes,
    currentDoc,
    latestChosenDocumentIds,
    keyword,
    isInitialSelectionSet,
    t,
    translateDocumentName,
  ]);

  return (
    <Flex wrap>
      <Popover
        content={
          docTreeData.length ? (
            <Tree
              style={{
                height: '200px',
                width: '400px',
                overflow: 'auto',
              }}
              checkable
              defaultExpandedKeys={docTreeData.map((node) => node.key)}
              defaultCheckedKeys={defaultSelectedKeys}
              checkedKeys={selectedDocNodes.map((node) => node.key)}
              treeData={docTreeData}
              onCheck={(checkedKeys) => {
                setSelectedDocNodes &&
                  setSelectedDocNodes(
                    docs
                      ?.filter((doc) =>
                        (checkedKeys as React.Key[]).includes(doc.id)
                      )
                      .map((doc) => ({
                        key: String(doc.id),
                        title: translateDocumentName(doc.name, doc.type),
                      })) || []
                  );
                setIsInitialSelectionSet(true);
              }}
            />
          ) : (
            <Space
              style={{
                height: '400px',
                width: '400px',
              }}
            >
              {t('document.noDocumentFound')}
            </Space>
          )
        }
        title={
          <Flex justify="center" gap={20}>
            {t('document.documents')}
            <Input
              placeholder={t('document.searchByFileName')}
              onChange={debounceSearch}
              size="small"
            />
          </Flex>
        }
      >
        <Tag
          className="file-tag prd-tag"
          style={{
            backgroundColor:
              isMobile && linkIcon ? 'transparent' : COLORS.LIGHT_PINK,
            border:
              isMobile && linkIcon ? 'none' : `solid 1px ${COLORS.PURPLE}`,
            borderRadius: '6px',
            margin: isMobile && linkIcon ? '0' : '0 0 5px 5px',
          }}
          closeIcon
        >
          <Tooltip>
            {isMobile && linkIcon ? (
              <Typography.Text
                ellipsis
                style={{
                  padding: '0px',
                  fontSize: '12px',
                }}
              >
                <>
                  {selectedDocNodes?.length ? (
                    selectedDocNodes[0].title
                  ) : (
                    <PaperClipOutlined style={{ fontSize: '16px' }} />
                  )}
                </>
              </Typography.Text>
            ) : (
              <Typography.Text
                ellipsis
                className="file-label"
                style={{
                  color: COLORS.PURPLE,
                  padding: '0px',
                  fontSize: '12px',
                }}
              >
                <>
                  {selectedDocNodes?.length
                    ? selectedDocNodes[0].title
                    : t('document.linkDocument')}
                </>
              </Typography.Text>
            )}
          </Tooltip>
        </Tag>
      </Popover>
      {selectedDocNodes.length > 1 && (
        <Tag
          className="plus-tag"
          style={{
            backgroundColor: COLORS.LIGHT_PINK,
            border: `solid 1px ${COLORS.PURPLE}`,
            borderRadius: '6px',
            color: COLORS.PURPLE,
          }}
          closeIcon
        >
          +{selectedDocNodes.length - 1}
        </Tag>
      )}
    </Flex>
  );
}
