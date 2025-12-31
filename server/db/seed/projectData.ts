import { TemplateAccess, DOCTYPE, IssueType } from '@prisma/client';
import { OrganizationID } from './organizationsData';

export const projectTemplateData = [
  {
    id: 'general_software_app',
    name: 'General Softare Application development',
    tags: 'software, general',
    description: 'Workflow for general software application development',
    access: TemplateAccess.PUBLIC,
    organizationId: OrganizationID.SuperAdmin,
    creatorUserId: 'superAdmin',
  },
  {
    id: 'general_data_eng',
    name: 'Data engineering development',
    tags: 'software, data, big data',
    description: 'Workflow for data engineering, big data development',
    access: TemplateAccess.PUBLIC,
    organizationId: OrganizationID.SuperAdmin,
    creatorUserId: 'superAdmin',
  },
  {
    id: 'general_ml_app',
    name: 'Machine Learning Softare Application development',
    tags: 'software, ML, AI',
    description:
      'Workflow for machine learning or AI related product development',
    access: TemplateAccess.PUBLIC,
    organizationId: OrganizationID.SuperAdmin,
    creatorUserId: 'superAdmin',
  },
  {
    id: 'willy_app',
    name: 'Software Product Development',
    tags: 'software, general',
    description: 'General software development workflow for willy Co',
    access: TemplateAccess.ORGANIZATION,
    organizationId: OrganizationID.Willy,
    creatorUserId: 'willyAdmin',
  },
];

export const projectTemplateIssueData = [
  // sample project issue template for general software dev
  {
    id: 'general_prd',
    name: 'PRD',
    type: IssueType.BUILDABLE,
    description: 'Product Requirement Document',
    fields: {},
    templateProjectId: 'general_software_app',
    creatorUserId: 'superAdmin',
  },
  {
    id: 'general_visual_design',
    name: 'Visual Design',
    type: IssueType.BUILDABLE,
    description:
      'The visual design including wireframe, mock up and final design',
    fields: {},
    templateProjectId: 'general_software_app',
    creatorUserId: 'superAdmin',
  },
  {
    id: 'general_rfc',
    name: 'Software Design RFC document',
    type: IssueType.BUILDABLE,
    description:
      'The software engineering design document for software architecture/timeline etc',
    fields: {},
    templateProjectId: 'general_software_app',
    creatorUserId: 'superAdmin',
  },
  {
    id: 'general_eng_implementation',
    name: 'Software Implementation',
    type: IssueType.BUILDABLE,
    description: 'The software implemention of the product',
    fields: {},
    templateProjectId: 'general_software_app',
    creatorUserId: 'superAdmin',
  },
  {
    id: 'general_release',
    name: 'Software Release',
    type: IssueType.BUILDABLE,
    description: 'The release process of the product to users',
    fields: {},
    templateProjectId: 'general_software_app',
    creatorUserId: 'superAdmin',
  },
  {
    id: 'general_reporting',
    name: 'Analytics & Tracking',
    type: IssueType.BUILDABLE,
    description: 'Tracking and measuring of the success of the project',
    fields: {},
    templateProjectId: 'general_software_app',
    creatorUserId: 'superAdmin',
  },
  // sample project issue template for willy co
  {
    id: 'willy_prd',
    name: 'Willy PRD',
    type: IssueType.BUILDABLE,
    description: 'Willy Product Requirement Document',
    fields: {},
    templateProjectId: 'willy_app',
    creatorUserId: 'willyAdmin',
  },
  {
    id: 'willy_visual_design',
    name: 'Willy Product Visual Design ',
    type: IssueType.BUILDABLE,
    description: 'The visual design for Willy',
    fields: {},
    templateProjectId: 'willy_app',
    creatorUserId: 'willyAdmin',
  },
  {
    id: 'willy_rfc',
    name: 'Willy Software Design RFC',
    type: IssueType.BUILDABLE,
    description: 'The engineering RFC for software architecture/timeline etc',
    fields: {},
    templateProjectId: 'willy_app',
    creatorUserId: 'willyAdmin',
  },
  {
    id: 'willy_eng_implementation',
    name: 'Software Implementation',
    type: IssueType.BUILDABLE,
    description: 'The software implementation of the product',
    fields: {},
    templateProjectId: 'willy_app',
    creatorUserId: 'willyAdmin',
  },
  {
    id: 'willy_marketing',
    name: 'Marketing',
    type: IssueType.BUILDABLE,
    description: 'Marketing announcement, campaign execution',
    fields: {},
    templateProjectId: 'willy_app',
    creatorUserId: 'willyAdmin',
  },
  // generic template issues
  {
    id: 'general_qa',
    name: 'Quality Assurance',
    type: IssueType.BUILDABLE,
    description: 'Perform QA tests before product release',
    fields: {},
    templateProjectId: 'general_software_app',
    creatorUserId: 'superAdmin',
  },
  {
    id: 'general_experimentation',
    name: 'Experimentation',
    type: IssueType.BUILDABLE,
    description:
      'Perform experimentation to measure performance before general availability',
    fields: {},
    templateProjectId: 'general_software_app',
    creatorUserId: 'superAdmin',
  },
  {
    id: 'general_marketing',
    name: 'Marketing',
    type: IssueType.BUILDABLE,
    description: 'Marketing announcement, campaign execution etc',
    fields: {},
    templateProjectId: 'general_software_app',
    creatorUserId: 'superAdmin',
  },
];

export const templateIssueDependencyData = [
  // sample project issue template for general software dev dependency
  {
    dependsOnTemplateIssueId: 'general_visual_design',
    dependedByTemplateIssueId: 'general_prd',
  },
  {
    dependsOnTemplateIssueId: 'general_rfc',
    dependedByTemplateIssueId: 'general_prd',
  },
  {
    dependsOnTemplateIssueId: 'general_rfc',
    dependedByTemplateIssueId: 'general_visual_design',
  },
  {
    dependsOnTemplateIssueId: 'general_eng_implementation',
    dependedByTemplateIssueId: 'general_rfc',
  },
  {
    dependsOnTemplateIssueId: 'general_release',
    dependedByTemplateIssueId: 'general_eng_implementation',
  },
  {
    dependsOnTemplateIssueId: 'general_reporting',
    dependedByTemplateIssueId: 'general_release',
  },
  // sample project issue template for willy co dev dependency
  {
    dependsOnTemplateIssueId: 'willy_visual_design',
    dependedByTemplateIssueId: 'willy_prd',
  },
  {
    dependsOnTemplateIssueId: 'willy_rfc',
    dependedByTemplateIssueId: 'willy_prd',
  },
  {
    dependsOnTemplateIssueId: 'willy_rfc',
    dependedByTemplateIssueId: 'willy_visual_design',
  },
  {
    dependsOnTemplateIssueId: 'willy_eng_implementation',
    dependedByTemplateIssueId: 'willy_rfc',
  },
  {
    dependsOnTemplateIssueId: 'willy_marketing',
    dependedByTemplateIssueId: 'willy_eng_implementation',
  },
];

export const templateDocumentData = [
  {
    id: 'general_prd_doc',
    name: 'PRD Template',
    description: 'A template for creating Product Requirement Document',
    type: <DOCTYPE>'PRD',
    url: 'https://docs.google.com/document/d/1aPPLbi-PaGSkjmJ80XmgOzAgtgbV9gd2gvG1nbGXp8w/edit#heading=h.628phil8unj9',
    access: TemplateAccess.PUBLIC,
    organizationId: OrganizationID.SuperAdmin,
    creatorUserId: 'superAdmin',
    templateIssueId: 'general_prd',
  },
  {
    id: 'general_rfc_doc',
    name: 'RFC Template',
    description: 'A template for creating Engieering RFC Documents',
    type: <DOCTYPE>'TECH_DESIGN',
    url: 'https://docs.google.com/document/d/1sYlJiTU6xh207nr6fcphS--UOKNL2r0Bejki9QerHtA/edit',
    access: TemplateAccess.PUBLIC,
    organizationId: OrganizationID.SuperAdmin,
    creatorUserId: 'superAdmin',
    templateIssueId: 'general_rfc',
  },
  {
    id: 'willy_prd_doc',
    name: 'Willy PRD Template',
    description:
      'A template for creating Product Requirement Document at Willy Co',
    type: <DOCTYPE>'PRD',
    url: 'https://docs.google.com/document/d/1aPPLbi-PaGSkjmJ80XmgOzAgtgbV9gd2gvG1nbGXp8w/edit#heading=h.628phil8unj9',
    access: TemplateAccess.ORGANIZATION,
    organizationId: OrganizationID.Willy,
    creatorUserId: 'willyAdmin',
    templateIssueId: 'willy_prd',
  },
  {
    id: 'willy_rfc_doc',
    name: 'Willy RFC Template',
    description: 'A template for creating Engieering RFC Documents at Willy',
    type: <DOCTYPE>'TECH_DESIGN',
    url: 'https://docs.google.com/document/d/1sYlJiTU6xh207nr6fcphS--UOKNL2r0Bejki9QerHtA/edit',
    access: TemplateAccess.ORGANIZATION,
    organizationId: OrganizationID.Willy,
    creatorUserId: 'willyAdmin',
    templateIssueId: 'willy_rfc',
  },
];
