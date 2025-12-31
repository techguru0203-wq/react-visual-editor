import {
  createBrowserRouter,
  redirect,
  RouterProvider,
} from 'react-router-dom';

import { UserProvider } from '../../../common/contexts/currentUserContext';
import { Chat } from '../../chats/components/Chat';
import ChatHome from '../../chats/components/ChatHome';
import Redirect from '../../common/Redirect';
import { DevPlanEditor } from '../../devPlans/components/DevPlanEditor';
import AppHome from '../../documents/components/AppHome';
import { DocumentEditor } from '../../documents/components/DocumentEditor';
import DocumentHome from '../../documents/components/DocumentHome';
import { DocumentShare } from '../../documents/components/DocumentShare';
import { Home } from '../../home/components/Home';
import IssueDetailEditor from '../../issues/components/IssueDetailEditor';
import { AppLayout } from '../../layout/components/AppLayout';
import { ErrorScreen } from '../../layout/components/ErrorScreen';
import { PublicLayout } from '../../layout/components/PublicLayout';
import MyIssues from '../../myIssues/components/MyIssues';
import AdminHome from '../../organization/components/AdminHome';
import BitbucketIntegration from '../../organization/components/BitbucketIntegration';
import Customization from '../../organization/components/Customization';
import GitHubIntegration from '../../organization/components/GitHubIntegration';
import { OrganizationHome } from '../../organization/components/OrganizationHome';
import EditProfile from '../../profile/components/EditProfile';
import EditUsers from '../../profile/components/EditUsers';
import {
  ProjectBuilding,
  ProjectBuildingIndex,
} from '../../project/components/building/ProjectBuilding';
import { ProjectExecution } from '../../project/components/building/ProjectExecution';
import { ProjectIssuesBoard } from '../../project/components/building/ProjectIssuesBoard';
import { ProjectOrganizationBoard } from '../../project/components/building/ProjectOrganizationBoard';
import { ProjectBuilder } from '../../project/components/planning/ProjectBuilder';
import {
  ProjectPlanning,
  ProjectPlanningIndex,
} from '../../project/components/planning/ProjectPlanning';
import { ProjectInfo } from '../../project/components/planning/ProjectPlanningInfo';
import { Project, ProjectIndex } from '../../project/components/Project';
import PrototypePreview from '../../project/components/prototype/PrototypePreview';
import {
  ProjectReporting,
  ProjectReportingIndex,
} from '../../project/components/reporting/ProjectReporting';
import { ProjectSnapshot } from '../../project/components/reporting/ProjectSnapshot';
import { ProjectWeeklyReports } from '../../project/components/reporting/ProjectWeeklyReports';
import { Billing } from '../../setting/components/Billing';
import DevVelocity from '../../setting/components/GenerationSetting';
import Integration from '../../setting/components/Integration';
import Referral from '../../setting/components/Referral';
import { Setting, SettingIndex } from '../../setting/components/Setting';
import UserTemplateDocuments from '../../setting/components/UserTemplateDocuments';
import { TeamHome } from '../../team/components/TeamHome';
import AddTemplateDocument from '../../templateDocument/components/AddTemplateDocument';
import { TemplateDetailPage } from '../../templateDocument/components/TemplateDetailPage';
import * as Path from '../paths';
import { RedirectPath, SharedDocumentPath, KnowledgeBasePath } from '../paths';
import { KnowledgeBaseList } from '../../knowledgeBase/components/KnowledgeBaseList';
import { KnowledgeBaseDetail } from '../../knowledgeBase/components/KnowledgeBaseDetail';

function RedirectToHome() {
  return redirect('../' + Path.HomePath);
}

export default function AppRouter() {
  // console.log('in AppRoutes');

  const router = createBrowserRouter([
    {
      path: '/',
      element: (
        <UserProvider>
          <AppLayout />
        </UserProvider>
      ),
      errorElement: <ErrorScreen />,
      children: [
        {
          index: true,
          loader: RedirectToHome,
        },
        {
          path: Path.SignupPath,
          element: null,
        },
        {
          path: Path.SigninPath,
          element: null,
        },
        {
          path: Path.DashboardPath,
          element: <MyIssues />,
        },
        {
          path: `${Path.DashboardPath}/:shortName`,
          element: <IssueDetailEditor />,
        },
        {
          path: Path.OrganizationPath,
          element: <OrganizationHome />,
        },
        {
          path: Path.DocumentsPath,
          element: <DocumentHome />,
        },
        {
          path: Path.AppsPath,
          element: <AppHome />,
        },
        {
          path: Path.IdeasPath,
          element: <ChatHome />,
        },
        {
          path: `${Path.TeamPath}/:id`,
          element: <TeamHome />,
        },
        {
          path: Path.HomePath,
          element: <Home />,
        },
        {
          path: `${Path.IdeasPath}/:chatSessionId`,
          element: <Chat />,
        },
        {
          path: Path.KnowledgeBasePath,
          element: <KnowledgeBaseList />,
        },
        {
          path: `${Path.KnowledgeBasePath}/:id`,
          element: <KnowledgeBaseDetail />,
        },
        {
          path: `${Path.ProjectsPath}/:id`,
          element: <Project />,
          errorElement: <ErrorScreen />,
          children: [
            {
              index: true,
              loader: ProjectIndex,
            },
            {
              path: Path.PlanningPath,
              element: <ProjectPlanning />,
              children: [
                {
                  index: true,
                  loader: ProjectPlanningIndex,
                },
                {
                  path: Path.BuilderPath,
                  element: <ProjectBuilder />,
                },
                {
                  path: Path.InfoPath,
                  element: <ProjectInfo />,
                },
              ],
            },
            {
              path: Path.BuildingPath,
              element: <ProjectBuilding />,
              children: [
                {
                  index: true,
                  loader: ProjectBuildingIndex,
                },
                {
                  path: Path.MilestonesPath,
                  element: <ProjectExecution />,
                },
                {
                  path: Path.ProjectOrganizationPath,
                  element: <ProjectOrganizationBoard />,
                },
                {
                  path: Path.IssueBoardPath,
                  element: <ProjectIssuesBoard />,
                },
              ],
            },
            {
              path: Path.ReportingPath,
              element: <ProjectReporting />,
              children: [
                {
                  index: true,
                  loader: ProjectReportingIndex,
                },
                {
                  path: Path.SnapshotPath,
                  element: <ProjectSnapshot />,
                },
                {
                  path: Path.WeeklyPath,
                  element: <ProjectWeeklyReports />,
                },
              ],
            },
          ],
        },
        {
          path: `${Path.DocumentsPath}/:docId`,
          element: <DocumentEditor />,
        },
        {
          path: `${Path.DevPlansPath}/:docId`,
          element: <DevPlanEditor />,
        },
        {
          path: `${Path.ProfilePath}/:id?`,
          element: (
            <EditProfile requireCompanyData={true} requireProfileData={true} />
          ),
        },
        {
          path: Path.BillingPath,
          element: <Billing />,
        },
        {
          path: Path.UserTemplateDocumentsPath,
          element: <UserTemplateDocuments />,
        },
        {
          path: `${Path.CreateNewTemplateDocumentsPath}`,
          element: <AddTemplateDocument />,
        },
        {
          path: `${Path.UserTemplateDocumentsPath}/:id`,
          element: <TemplateDetailPage />,
        },
        {
          path: Path.SettingsPath,
          element: <Setting />,
          children: [
            {
              index: true,
              loader: SettingIndex,
            },
            {
              path: Path.IntegrationPath,
              element: <Integration />,
            },
            {
              path: Path.JiraAdminPath,
              element: <AdminHome />,
            },
            {
              path: Path.BitbucketConnectPath,
              element: <BitbucketIntegration />,
            },
            {
              path: Path.ReferralPath,
              element: <Referral />,
            },
            {
              path: Path.GithubConnectPath,
              element: <GitHubIntegration />,
            },
            {
              path: Path.UsersAdminPath,
              element: <EditUsers />,
            },
            {
              path: Path.DevVelocityPath,
              element: <DevVelocity />,
            },
            {
              path: Path.CustomizationPath,
              element: <Customization />,
            },
          ],
        },
      ],
    },
    {
      path: '/',
      element: <PublicLayout />,
      errorElement: <ErrorScreen />,
      children: [
        {
          path: `${SharedDocumentPath}/:docId`,
          element: <DocumentShare />,
        },
        {
          path: `${RedirectPath}`,
          element: (
            <UserProvider>
              <Redirect />
            </UserProvider>
          ),
        },
      ],
    },
    {
      path: '/preview-doc/:docId',
      element: <DocumentShare />,
      errorElement: <ErrorScreen />,
    },
    {
      path: '/preview/:docId',
      element: <PrototypePreview />,
      errorElement: <ErrorScreen />,
    },
  ]);

  return <RouterProvider router={router} />;
}
