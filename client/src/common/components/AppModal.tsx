import {
  createContext,
  PropsWithChildren,
  ReactElement,
  useCallback,
  useContext,
  useState,
} from 'react';
import { Access, ChatSession } from '@prisma/client';
import { Divider, Modal } from 'antd';

import { ProjectOutput } from '../../../../shared/types';
import AddChat from '../../containers/chats/components/AddChat';
import { DeleteChat } from '../../containers/chats/components/DeleteChat';
import { FeedbackForm } from '../../containers/common/components/FeedbackForm';
import ErrorMessage from '../../containers/common/ErrorMessage';
import AddDocument from '../../containers/documents/components/addDocument';
import { TutorialVideo } from '../../containers/myIssues/components/TutorialVideo';
import AddProject from '../../containers/project/components/AddProject';
import { DeleteDocument } from '../../containers/project/components/DeleteDocument';
import { DeleteDocumentImage } from '../../containers/project/components/DeleteDocumentImage';
import { DeleteProject } from '../../containers/project/components/DeleteProject';
import EditProject from '../../containers/project/components/EditProject';
import { EditProjectWorkflow } from '../../containers/project/components/planning/ProjectBuilder';
import BuildableEditor from '../../containers/project/components/projectBuilder/BuildableEditor';
import IssueEditor from '../../containers/project/components/projectBuilder/IssueEditor';
import { DatabaseModal } from '../../containers/project/components/prototype/DatabaseModal';
import { TableInfo } from '../../containers/project/components/prototype/PrototypeDataBaseHandler';
import { StripeConfigModal } from '../../containers/project/components/prototype/StripeConfigModal';
import {
  IssueBuildableTypes,
  LegacyDocumentOutput,
} from '../../containers/project/types/projectType';
import { AddTeam } from '../../containers/team/components/AddTeam';
import {
  AddTeamMember,
  InviteNewUser,
} from '../../containers/team/components/AddTeamMember';
import DeleteTeam from '../../containers/team/components/DeleteTeam';
import EditTeam from '../../containers/team/components/EditTeam';
import { TeamOutput } from '../../containers/team/types/teamTypes';
import AddTemplateDocument from '../../containers/templateDocument/components/AddTemplateDocument';
import { AddVirtualUser } from '../../containers/user/components/addVirtualUser';
import trackEvent from '../../trackingClient';
import { useCurrentUser } from '../contexts/currentUserContext';
import { useLanguageWithFallback } from '../contexts/languageContext';
import { DocSharingModal } from './DocSharingModal/DocSharingModal';
import { ProjectSharingModal } from './DocSharingModal/ProjectSharingModal';
import {
  UpdateSubscription,
  UpdateSubscriptionProps,
} from './PricingPlansModal/PricingPlans';
import { ReferralModal } from './ReferralModal';

import './AppModal.scss';

type ModalPayload =
  | Readonly<{ type: 'addProject'; teamId?: string }>
  | Readonly<{
      type: 'addDocument';
      docType?: string;
      teamId?: string;
      chatSessionId?: string;
    }>
  | Readonly<{ type: 'addChat' }>
  | Readonly<{ type: 'addIssue'; workPlanId?: string }>
  | Readonly<{ type: 'addTeam'; parentTeamid?: string }>
  | Readonly<{ type: 'addTeamMember'; teamId?: string }>
  | Readonly<{ type: 'inviteUser' }>
  | Readonly<{ type: 'addVirtualUser' }>
  | Readonly<{ type: 'editDocument'; document: LegacyDocumentOutput }>
  | Readonly<{ type: 'deleteDocument'; document: LegacyDocumentOutput }>
  | Readonly<{ type: 'editChat'; chat: ChatSession }>
  | Readonly<{ type: 'deleteChat'; chat: ChatSession }>
  | Readonly<{ type: 'viewTutorial' }>
  | Readonly<{ type: 'deleteProject'; projectId: string }>
  | Readonly<{ type: 'editProject'; project: ProjectOutput }>
  | Readonly<{
      type: 'shareProject';
      projectId: string;
      title: string;
      projectAccess: Access;
      shareLink?: string;
    }>
  | Readonly<{ type: 'editTeam'; team: TeamOutput }>
  | Readonly<{ type: 'deleteTeam'; teamId: string }>
  | Readonly<{ type: 'deleteTeamInvalid'; message: string }>
  | Readonly<{ type: IssueBuildableTypes; issueShortName: string }>
  | Readonly<{ type: 'updateSubscription'; payload: UpdateSubscriptionProps }>
  | Readonly<{ type: 'purchaseCredits'; payload: UpdateSubscriptionProps }>
  | Readonly<{ type: 'editWorkflow'; project: ProjectOutput }>
  | Readonly<{
      type: 'docSharing';
      docId: string;
      title: string;
      documentAccess: Access;
    }>
  | Readonly<{
      type: 'deleteDocumentImage';
      id: string;
      deleteImage: () => void;
    }>
  | Readonly<{
      type: 'addTemplateDocument';
      templateCreated: () => void;
    }>
  | Readonly<{
      type: 'fillDatabaseSettings';
      tables: TableInfo[];
      documentId: string;
      settings: {
        DATABASE_URL?: string;
        JWT_SECRET?: string;
      } | null;
      onSaveSettings: (settings: {
        DATABASE_URL: string;
        JWT_SECRET: string;
      }) => Promise<void>;
    }>
  | Readonly<{
      type: 'stripeConfig';
      projectId: string;
      deployDocId: string;
      title: string;
      stripeSecretKey?: string;
      stripePublishableKey?: string;
      userDomain: string;
    }>
  | Readonly<{ type: 'referralModal' }>
  | Readonly<{ type: 'feedback' }>;

type ModalType = ModalPayload['type'];

export type ShowModalMethod = (payload: ModalPayload) => void;
type ModalContextType = Readonly<{
  showAppModal: ShowModalMethod;
}>;

const getModalConfig = (
  t: (key: string) => string
): Record<ModalType, [string, number]> => ({
  addProject: [t('modal.addProject'), 510],
  addDocument: [t('modal.addDocument'), 510],
  addChat: [t('modal.addChat'), 510],
  editDocument: [t('modal.editDocument'), 510],
  deleteDocument: [t('modal.deleteDocument'), 500],
  editChat: [t('modal.editChat'), 510],
  deleteChat: [t('modal.deleteChat'), 500],
  viewTutorial: [t('modal.viewTutorial'), 1100],
  addIssue: [t('modal.addIssue'), 850],
  addTeam: [t('modal.addTeam'), 600],
  addTeamMember: [t('modal.addTeamMember'), 600],
  inviteUser: [t('modal.inviteUser'), 500],
  addVirtualUser: [t('modal.addVirtualUser'), 500],
  deleteProject: [t('modal.deleteProject'), 500],
  editProject: [t('modal.editProject'), 500],
  shareProject: [t('modal.shareProject'), 500],
  editTeam: [t('modal.editTeam'), 500],
  deleteTeam: [t('modal.deleteTeam'), 500],
  deleteTeamInvalid: [t('modal.deleteTeamInvalid'), 500],
  [IssueBuildableTypes.PRD]: [t('modal.createPrd'), 500],
  [IssueBuildableTypes.UIDESIGN]: [t('modal.createUiDesign'), 500],
  [IssueBuildableTypes.PROTOTYPE]: [t('modal.createUiDesign'), 500],
  [IssueBuildableTypes.TECHDESIGN]: [t('modal.createTechDesign'), 500],
  [IssueBuildableTypes.DEVELOPMENT]: [t('modal.createDevelopmentPlan'), 500],
  [IssueBuildableTypes.QA]: [t('modal.createQaPlan'), 500],
  [IssueBuildableTypes.RELEASE]: [t('modal.createReleasePlan'), 500],
  [IssueBuildableTypes.PROPOSAL]: [t('modal.createBusinessProposal'), 500],
  updateSubscription: [t('modal.updateSubscription'), 1200],
  purchaseCredits: [t('modal.purchaseCredits'), 1200],
  editWorkflow: [t('modal.editWorkflow'), 500],
  docSharing: ['', 500],
  deleteDocumentImage: [t('modal.deleteDocumentImage'), 500],
  addTemplateDocument: [t('modal.addTemplateDocument'), 1100],
  fillDatabaseSettings: [t('modal.fillDatabaseSettings'), 800],
  stripeConfig: [t('modal.stripeConfig'), 600],
  referralModal: [t('modal.referralModal'), 500],
  feedback: [t('modal.feedback'), 600],
});
const DefaultModalConfig = ['', 500];

function ModalContents({
  payload,
  onSuccess,
}: Readonly<{ payload: ModalPayload; onSuccess: () => void }>): ReactElement {
  const { user } = useCurrentUser();

  trackEvent(payload.type, {
    distinct_id: user.email,
    payload: JSON.stringify(payload),
  });

  switch (payload.type) {
    case 'addProject':
      return <AddProject teamId={payload.teamId} onSuccess={onSuccess} />;
    case 'addDocument':
      return (
        <AddDocument
          onSuccess={onSuccess}
          chatSessionId={payload.chatSessionId}
          docType={payload.docType}
        />
      );
    case 'editDocument':
      return <AddDocument document={payload.document} onSuccess={onSuccess} />;
    case 'deleteDocument':
      return (
        <DeleteDocument document={payload.document} onSuccess={onSuccess} />
      );
    case 'addChat':
      return <AddChat onSuccess={onSuccess} />;
    case 'editChat':
      return <AddChat chatSession={payload.chat} onSuccess={onSuccess} />;
    case 'deleteChat':
      return <DeleteChat chat={payload.chat} onSuccess={onSuccess} />;
    case 'viewTutorial':
      return <TutorialVideo />;
    case 'addIssue':
      return (
        <IssueEditor workPlanId={payload.workPlanId} onSuccess={onSuccess} />
      );
    case 'addTeam':
      return (
        <AddTeam parentTeamId={payload.parentTeamid} onSuccess={onSuccess} />
      );
    case 'addTeamMember':
      return (
        <AddTeamMember teamId={payload.teamId || ''} onSuccess={onSuccess} />
      );
    case 'inviteUser':
      return <InviteNewUser onSuccess={onSuccess} />;
    case 'addVirtualUser':
      return <AddVirtualUser onSuccess={onSuccess} />;
    case 'deleteProject':
      return (
        <DeleteProject projectId={payload.projectId} onSuccess={onSuccess} />
      );
    case 'deleteDocumentImage':
      return (
        <DeleteDocumentImage
          deleteImage={payload.deleteImage}
          documentId={payload.id}
          onSuccess={onSuccess}
        />
      );
    case 'editProject':
      return <EditProject project={payload.project} onSuccess={onSuccess} />;
    case 'editTeam':
      return <EditTeam team={payload.team} onSuccess={onSuccess} />;
    case 'deleteTeam':
      return <DeleteTeam teamId={payload.teamId} onSuccess={onSuccess} />;
    case 'deleteTeamInvalid':
      return <ErrorMessage message={payload.message} />;
    case 'updateSubscription':
    case 'purchaseCredits':
      return <UpdateSubscription payload={payload.payload} />;
    case 'editWorkflow':
      return (
        <EditProjectWorkflow project={payload.project} onSuccess={onSuccess} />
      );
    case IssueBuildableTypes.PRD:
    case IssueBuildableTypes.UIDESIGN:
    case IssueBuildableTypes.TECHDESIGN:
    case IssueBuildableTypes.DEVELOPMENT:
    case IssueBuildableTypes.QA:
    case IssueBuildableTypes.RELEASE:
    case IssueBuildableTypes.PROPOSAL:
      return (
        <BuildableEditor
          issueShortName={payload.issueShortName}
          onSuccess={onSuccess}
        />
      );
    case 'docSharing':
      return (
        <DocSharingModal
          docId={payload.docId}
          title={payload.title}
          documentAccess={payload.documentAccess}
          onSuccess={onSuccess}
        />
      );
    case 'shareProject':
      return (
        <ProjectSharingModal
          projectId={payload.projectId}
          title={payload.title}
          projectAccess={payload.projectAccess}
          onSuccess={onSuccess}
          shareLink={payload.shareLink}
        />
      );
    case 'addTemplateDocument':
      return (
        <AddTemplateDocument
          templateCreated={payload.templateCreated}
          onSuccess={onSuccess}
        />
      );
    case 'fillDatabaseSettings':
      return (
        <DatabaseModal
          tables={payload.tables}
          documentId={payload.documentId}
          settings={payload.settings}
          onClose={onSuccess}
          onSaveSettings={payload.onSaveSettings}
        />
      );
    case 'stripeConfig':
      return (
        <StripeConfigModal
          projectId={payload.projectId}
          title={payload.title}
          deployDocId={payload.deployDocId}
          stripeSecretKey={payload.stripeSecretKey}
          stripePublishableKey={payload.stripePublishableKey}
          userDomain={payload.userDomain}
          onClose={onSuccess}
        />
      );
    case 'referralModal':
      return <ReferralModal onSuccess={onSuccess} />;
    case 'feedback':
      return <FeedbackForm onSuccess={onSuccess} onCancel={onSuccess} />;

    default:
      return <></>;
  }
}

const ModalContext = createContext<ModalContextType>({
  showAppModal: () => {},
});

export function useAppModal(): ModalContextType {
  return useContext(ModalContext);
}

export function ModalProvider({ children }: PropsWithChildren) {
  // Use fallback version for public/shared routes that may not have LanguageContext
  const { t } = useLanguageWithFallback();
  const [payload, setPayload] = useState<ModalPayload | undefined>();
  const hideModal = useCallback(() => {
    setPayload(undefined);
  }, []);

  const ModalConfig = getModalConfig(t);
  let [title, width] =
    payload && payload.type ? ModalConfig[payload.type] : DefaultModalConfig;

  if (payload?.type === 'docSharing' && payload?.title) {
    title = payload.title;
  }

  // Only center align header for referralModal
  const modalStyles =
    payload?.type === 'referralModal'
      ? { body: { minHeight: 100 }, header: { textAlign: 'center' as const } }
      : { body: { minHeight: 100 } };
  return (
    <ModalContext.Provider value={{ showAppModal: setPayload }}>
      <Modal
        title={title}
        open={Boolean(payload)}
        destroyOnClose={true}
        onCancel={hideModal}
        styles={modalStyles}
        width={width}
        maskClosable={false}
        centered
        className="custom-modal"
      >
        <Divider />
        {payload && <ModalContents payload={payload} onSuccess={hideModal} />}
      </Modal>
      {children}
    </ModalContext.Provider>
  );
}
