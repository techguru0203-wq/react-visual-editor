import {
  DOCTYPE,
  Document,
  DocumentPermissionTypes,
  Organization,
  Project,
  TemplateDocument,
} from '@prisma/client';

export type TemplateDocumentOutput = Readonly<
  Pick<TemplateDocument, 'id' | 'name' | 'description' | 'type'>
>;

// Copied from /server/routes/types/documentTypes.ts
export type DocumentOutput = Readonly<
  Omit<Document, 'content'> & {
    // type: Exclude<DOCTYPE, typeof DOCTYPE.DEVELOPMENT_PLAN>;
    contents?: string;
    templateDocument?: TemplateDocument | null;
    project: Project | null;
    organization: Organization | null;
    documentPermission?: DocumentPermissionTypes;
    meta?: {
      history?: string;
      sourceUrl?: string;
      builtFileUrl?: string;
      features?: {
        hasAuth?: boolean;
        hasAI?: boolean;
        hasDomain?: boolean;
      };
    };
  }
>;

// copied from /server/lib/constant.ts
export const DocumentTypeNameMapping = (
  t: (key: string) => string
): Record<string, Record<string, string>> => ({
  PRD: {
    type: DOCTYPE.PRD,
    name: t('document.prd'),
    subTitle: t('document.prdSubtitle'),
  },
  UI_DESIGN: {
    type: DOCTYPE.UI_DESIGN,
    name: t('document.uiDesign'),
    subTitle: t('document.uiDesignSubtitle'),
  },
  PROTOTYPE: {
    type: DOCTYPE.PROTOTYPE,
    name: t('document.prototype'),
    nameForProject: t('document.prototype'),
    subTitle: t('document.prototypeSubtitle'),
  },
  TECH_DESIGN: {
    type: DOCTYPE.TECH_DESIGN,
    name: t('document.techDesign'),
    subTitle: t('document.techDesignSubtitle'),
  },
  DEVELOPMENT_PLAN: {
    type: DOCTYPE.DEVELOPMENT_PLAN,
    name: t('document.developmentPlan'),
    subTitle: t('document.developmentPlanSubtitle'),
  },
  QA_PLAN: {
    type: DOCTYPE.QA_PLAN,
    name: t('document.qaPlan'),
    subTitle: t('document.qaPlanSubtitle'),
  },
  RELEASE_PLAN: {
    type: DOCTYPE.RELEASE_PLAN,
    name: t('document.releasePlan'),
    subTitle: t('document.releasePlanSubtitle'),
  },
  // PROPOSAL: {
  //   type: DOCTYPE.PROPOSAL,
  //   name: 'Business Proposal',
  // },
  // BUSINESS: {
  //   type: DOCTYPE.BUSINESS,
  //   name: 'Business',
  // },
  PRODUCT: {
    type: DOCTYPE.PRODUCT,
    name: t('document.product'),
  },
  // ENGINEERING: {
  //   type: DOCTYPE.ENGINEERING,
  //   name: 'Engineering',
  // },
  MARKETING: {
    type: DOCTYPE.MARKETING,
    name: t('document.marketing'),
  },
  // SALES: {
  //   type: DOCTYPE.SALES,
  //   name: 'Sales',
  // },
  // SUPPORT: {
  //   type: DOCTYPE.SUPPORT,
  //   name: 'Customer Support',
  // },
  // OTHER: {
  //   type: DOCTYPE.OTHER,
  //   name: 'Other',
  // },
  // CHAT: {
  //   type: ChatSessionTargetEntityType.CHAT,
  //   name: 'Chat',
  // },
});

export const DocTypeOptionsSelection = [{ value: '', label: 'All' }].concat(
  Object.values(DocumentTypeNameMapping).map((value) => {
    return {
      value: value.type,
      label: value.name,
    };
  })
);
