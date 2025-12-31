import { useEffect } from 'react';
import { Config, driver, PopoverDOM } from 'driver.js';

import { UserInfo } from '../../../common/types/common';
import { DocumentOutput } from '../../documents/types/documentTypes';

import './Tutorials.scss';

const getCloseStyles = (popover: PopoverDOM) => {
  popover.closeButton.textContent = 'Skip tour';
  popover.closeButton.style.width = 'fit-content';
  popover.closeButton.style.padding = '4px';
  popover.closeButton.style.margin = '8px';
  popover.closeButton.style.alignSelf = 'center';
  popover.closeButton.style.justifySelf = 'center';
  popover.closeButton.style.color = 'rgba(83, 69, 243)';
  popover.closeButton.style.backgroundColor = 'transparent';
  popover.closeButton.style.border = '0px';
};

const baseOpts: Config = {
  overlayColor: 'black',
  overlayOpacity: 0.5,
  allowClose: true,
  animate: true,
  showProgress: true,
  showButtons: ['next', 'previous', 'close'],
  popoverClass: 'driverjs-theme',
  disableActiveInteraction: true,
};

export const useProjectTutorial = () => {
  useEffect(() => {
    const getProjectTutorial = () => {
      const hasCanceledTutorial = JSON.parse(
        localStorage.getItem('no-tutorial-project') ?? 'false'
      );

      if (hasCanceledTutorial) return undefined;

      const driverObj = driver({
        ...baseOpts,
        onCloseClick: () => {
          driverObj.destroy();
          localStorage.setItem('no-tutorial-project', JSON.stringify(true));
        },
        onPopoverRender: getCloseStyles,
        onNextClick: (_element, step) => {
          if (step.popover?.progressText?.includes('6 of 6')) {
            driverObj.destroy();
            localStorage.setItem('no-tutorial-project', JSON.stringify(true));
          } else {
            driverObj.moveNext();
          }
        },
        steps: [
          {
            element: '#PRD',
            popover: {
              title: 'Create PRD',
              description:
                'First create a PRD which is used by all other subsequent steps.',
              side: 'left',
              align: 'start',
            },
          },
          {
            element: '#customize-view',
            popover: {
              title: 'Customize Workflow',
              description:
                'You may customize the full workflow for the project',
              side: 'left',
              align: 'start',
            },
          },
          {
            element: '#project-tabs',
            popover: {
              title: 'Project navigation',
              description:
                'Switch between key features: Planner for creating project plan, Builder for development, Reporter for insights and analytics',
              side: 'left',
              align: 'start',
            },
          },
        ],
      });

      return driverObj;
    };

    const driverObj = getProjectTutorial();

    driverObj?.drive();

    return () => {
      driverObj?.destroy();
    };
  }, []);
};

export const useIssuesTutorial = (user: UserInfo) => {
  useEffect(() => {
    const getIssuesTutorial = () => {
      const hasCanceledTutorial = JSON.parse(
        localStorage.getItem('no-tutorial-issues') ?? 'false'
      );

      // If user hasn't yet even registered we show a form to fill in their personal info
      // on the next run if they've filled in their personal info we show the tutorial
      if (
        hasCanceledTutorial ||
        (user.firstname === '' && user.lastname === '')
      )
        return undefined;

      const driverObj = driver({
        ...baseOpts,
        onCloseClick: () => {
          driverObj.destroy();
          localStorage.setItem('no-tutorial-issues', JSON.stringify(true));
        },
        onPopoverRender: getCloseStyles,
        onNextClick: (_element, step) => {
          if (step.popover?.progressText?.includes('5 of 5')) {
            driverObj.destroy();
            localStorage.setItem('no-tutorial-issues', JSON.stringify(true));
          } else {
            driverObj.moveNext();
          }
        },

        steps: [
          {
            popover: {
              title: 'Welcome to Omniflow!🎉',
              description: `Let’s take a quick tour of the key features to help you get started. As you explore, more tours will pop up to guide you along the way.
<br/><br/>
During the tour, the page will be paused, but don’t worry—you can exit anytime by clicking outside this box. Need to restart the tour? Just refresh the page!
<br/><br/>
Ready? Let’s go! 🚀`,
              side: 'left',
              align: 'start',
            },
          },
          {
            element: '#add-project-btn',
            popover: {
              title: 'Project creation',
              description:
                'You may start by clicking on "Add Project" to create a project',
              side: 'left',
              align: 'start',
            },
          },
          {
            element: '.user-profile',
            popover: {
              title: 'Profile settings',
              description:
                'Manage your personal and organization info, including development velocity, team, billing, 3rd party app integration etc',
              side: 'left',
              align: 'start',
            },
          },
          {
            element: '.my-tasks',
            popover: {
              title: 'Your Tasks',
              description:
                'Manage all your assigned project tasks in one simple view',
              side: 'left',
              align: 'start',
            },
          },
          {
            element: '.org-proj .ant-menu-submenu-title',
            popover: {
              title: 'Organization',
              description:
                "Manage your organization's project, teams, and users. Your projects will show up here after creation",
              side: 'left',
              align: 'start',
            },
          },
        ],
      });

      return driverObj;
    };

    const driverObj = getIssuesTutorial();

    driverObj?.drive();

    return () => {
      driverObj?.destroy();
    };
  }, []);
};

export const usePRDTutorial = (documentData?: DocumentOutput) => {
  useEffect(() => {
    if (documentData?.type === 'PRD' || documentData?.type === 'UI_DESIGN') {
      const getPrdTutorial = () => {
        const hasCanceledTutorial = JSON.parse(
          localStorage.getItem('no-prd-tutorial') ?? 'false'
        );

        const isNotFirstPRDPage =
          !documentData.description && !documentData.contents;
        if (hasCanceledTutorial || isNotFirstPRDPage) return undefined;

        const driverObj = driver({
          ...baseOpts,
          onPopoverRender: getCloseStyles,
          onCloseClick: () => {
            driverObj.destroy();
            localStorage.setItem('no-prd-tutorial', JSON.stringify(true));
          },
          onNextClick: (_element, step) => {
            if (step.popover?.progressText?.includes('5 of 5')) {
              driverObj.destroy();
              localStorage.setItem('no-prd-tutorial', JSON.stringify(true));
            } else {
              driverObj.moveNext();
            }
          },
          steps: [
            {
              element: '.document-input',
              popover: {
                title: 'Enter project description',
                description:
                  'Add a few sentences of description for your project.',
                side: 'top',
                align: 'center',
              },
            },
            {
              element: '.doc-action-btn',
              popover: {
                title: 'Generate PRD',
                description:
                  'Click on button to generate content. Generation may be disabled if content is already generated or input has not changed.',
                side: 'top',
                align: 'center',
              },
            },
            {
              element: '#docx-upload',
              popover: {
                title: 'Upload .docx file',
                description:
                  'You can also choose to upload a .docx file, the contents of which will be used for generation.',
                side: 'top',
                align: 'center',
              },
            },
            {
              element: '#editor-sidebar-panel',
              popover: {
                title: 'Version History',
                description:
                  'Past input and generated content are accessible through the history panel',
                side: 'left',
                align: 'start',
              },
            },
            {
              element: '#doc-actions',
              popover: {
                title: 'Document Actions',
                description: 'You may publish, export or share your documents',
                side: 'left',
                align: 'start',
              },
            },
          ],
        });

        return driverObj;
      };

      const getUITutorial = () => {
        const hasCanceledTutorial = JSON.parse(
          localStorage.getItem('no-uidesign-tutorial') ?? 'false'
        );

        if (hasCanceledTutorial) return undefined;

        const driverObj = driver({
          ...baseOpts,
          onPopoverRender: getCloseStyles,
          onCloseClick: () => {
            driverObj.destroy();
            localStorage.setItem('no-uidesign-tutorial', JSON.stringify(true));
          },
          onNextClick: (_element, step) => {
            if (step.popover?.progressText?.includes('2 of 2')) {
              driverObj.destroy();
              localStorage.setItem(
                'no-uidesign-tutorial',
                JSON.stringify(true)
              );
            } else {
              driverObj.moveNext();
            }
          },
          steps: [
            {
              element: '.document-input',
              popover: {
                title: 'Enter instruction',
                description:
                  'The PRD document for the project will always be used for this generation by default, and you can enter more instructions.',
                side: 'top',
                align: 'center',
              },
            },
            {
              element: '#image-upload',
              popover: {
                title: 'Upload an image file',
                description:
                  'You can also choose to upload an image file, the contents of which will be used for generation along with the PRD content.',
                side: 'top',
                align: 'center',
              },
            },
          ],
        });

        return driverObj;
      };

      const driverObj =
        documentData?.type === 'PRD' ? getPrdTutorial() : getUITutorial();

      driverObj?.drive();

      return () => {
        driverObj?.destroy();
      };
    }

    return undefined;
  }, [documentData?.type]);
};
