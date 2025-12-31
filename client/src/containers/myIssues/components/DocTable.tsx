import { useCallback } from 'react';
import { DOCTYPE } from '@prisma/client';
import { Flex, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router';

import { useLanguage } from '../../../common/contexts/languageContext';
import { ReactComponent as DocumentIcon } from '../../../common/icons/document-icon.svg';
import { ReactComponent as EmptyIcon } from '../../../common/icons/empty-icon.svg';
import { COLORS } from '../../../lib/constants';
import {
  DocumentOutput,
  DocumentTypeNameMapping,
} from '../../documents/types/documentTypes';
import { DevPlansPath, DocumentsPath } from '../../nav/paths';

export function DocTable({ docs }: { docs: DocumentOutput[] }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

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

  return docs
    .sort((a, b) => {
      return dayjs(b.updatedAt).unix() - dayjs(a.updatedAt).unix();
    })
    .slice(0, Math.min(6, docs.length))
    .map((doc, index) => (
      <Flex className="doc-item" key={index}>
        <div>
          <DocumentIcon style={{ fontSize: '20px', color: COLORS.PRIMARY }} />
        </div>
        <div
          className="link-button"
          style={{
            marginLeft: '6px',
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
          onClick={() => {
            if (doc.type !== DOCTYPE.DEVELOPMENT_PLAN) {
              navigate(`/${DocumentsPath}/${doc.id}`);
            } else {
              navigate(`/${DevPlansPath}/${doc.id}`);
            }
          }}
        >
          {translateDocumentName(doc.name, doc.type)} &nbsp;
          <Tag>
            {Object.values(DocumentTypeNameMapping(t)).find(
              (item) => item.type === doc.type
            )?.name || t('document.label')}
          </Tag>
        </div>
      </Flex>
    ));
}

export function EmptyDoc() {
  const { t } = useLanguage();
  return (
    <Flex
      style={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        border: `solid 1px ${COLORS.LIGHT_GRAY}`,
        borderRadius: '15px',
        marginBottom: '10px',
      }}
    >
      <Flex
        vertical
        style={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '15px',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            color: COLORS.GRAY,
            marginBottom: '20px',
          }}
        >
          <EmptyIcon />
          <div style={{ marginTop: '10px' }}>
            {t('layout.noDocumentsAvailable')}
          </div>
        </div>
        {/* <Button
          id="add-project-btn"
          type="primary"
          icon={<PlusOutlined />}
          size={'middle'}
          onClick={() => showAppModal({ type: 'addDocument' })}
        >
          New document
        </Button> */}
      </Flex>
    </Flex>
  );
}
