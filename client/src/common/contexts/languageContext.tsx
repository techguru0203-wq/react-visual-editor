import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'en' | 'zh';

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, any>) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('Language context is not available');
  }
  return context;
}

// Safe version of useLanguage that doesn't throw error when context is not available
export function useLanguageSafe(): LanguageContextType | null {
  const context = useContext(LanguageContext);
  return context || null;
}

// Standalone function to get language from localStorage (for use outside React context)
export function getLanguageFromStorage(): Language {
  if (typeof window === 'undefined') {
    return 'en'; // Default for SSR
  }

  // Check for lang parameter in URL first (for reviewers)
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang') as Language;

  if (urlLang && (urlLang === 'en' || urlLang === 'zh')) {
    return urlLang;
  }

  // Otherwise, use localStorage preference
  const storedLanguage = localStorage.getItem('preferredLanguage') as Language;
  if (storedLanguage && (storedLanguage === 'en' || storedLanguage === 'zh')) {
    return storedLanguage;
  }
  return 'en'; // Default fallback
}

// Standalone translation function that works without React context
export function translateWithLanguage(
  key: string,
  language?: Language
): string {
  const lang = language || getLanguageFromStorage();
  return (
    translations[lang][key as keyof (typeof translations)[typeof lang]] || key
  );
}

// Hook for components that may not have LanguageContext (like login/signup pages)
export function useLanguageWithFallback(): LanguageContextType {
  const context = useLanguageSafe();
  const [fallbackLanguage, setFallbackLanguage] = useState<Language>(() =>
    getLanguageFromStorage()
  );

  // Listen for language changes from other tabs (always run this hook)
  useEffect(() => {
    if (context) return; // Don't set up listener if context is available

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'preferredLanguage' && e.newValue) {
        const newLanguage = e.newValue as Language;
        if (newLanguage === 'en' || newLanguage === 'zh') {
          setFallbackLanguage(newLanguage);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [context]);

  // If context is available, use it
  if (context) {
    return context;
  }

  // Otherwise, provide fallback implementation
  const setLanguage = (newLanguage: Language) => {
    setFallbackLanguage(newLanguage);
    localStorage.setItem('preferredLanguage', newLanguage);
    // Trigger storage event for other tabs/windows
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'preferredLanguage',
        newValue: newLanguage,
        oldValue: fallbackLanguage,
      })
    );
  };

  const t = (key: string, params?: Record<string, any>): string => {
    let translation = translateWithLanguage(key, fallbackLanguage);

    // Replace parameters in the translation string
    if (params) {
      Object.keys(params).forEach((paramKey) => {
        translation = translation.replace(`{${paramKey}}`, params[paramKey]);
      });
    }

    return translation;
  };

  return {
    language: fallbackLanguage,
    setLanguage,
    t,
  };
}

// Translation keys and their values
const translations = {
  en: {
    // Common
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.submit': 'Submit',
    'common.continue': 'Continue',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.close': 'Close',
    'common.open': 'Open',
    'common.view': 'View',
    'common.download': 'Download',
    'common.upload': 'Upload',
    'common.share': 'Share',
    'common.copy': 'Copy',
    'common.paste': 'Paste',
    'common.cut': 'Cut',
    'common.undo': 'Undo',
    'common.redo': 'Redo',
    'common.configuration': 'Configuration',
    'common.action': 'Action',
    'common.total': 'Total',

    // Buttons
    'button.makePrototype': 'Make Prototype',
    'button.newProject': 'New Project',
    'button.createProject': 'Create Project',
    'button.newDocument': 'New Document',
    'button.createDocument': 'Create Document',
    'button.addNew': 'Add New',
    'button.import': 'Import',
    'button.export': 'Export',
    'button.preview': 'Preview',
    'button.publish': 'Publish',
    'button.generate': 'Generate',
    'button.regenerate': 'Regenerate',
    'button.refresh': 'Refresh',
    'button.reset': 'Reset',
    'button.clear': 'Clear',
    'button.select': 'Select',
    'button.choose': 'Choose',
    'button.browse': 'Browse',
    'button.search': 'Search',
    'button.filter': 'Filter',
    'button.sort': 'Sort',

    // Document Toolbar Actions
    'toolbar.publish': 'Publish',
    'toolbar.export': 'Export',
    'toolbar.share': 'Share',
    'toolbar.convert': 'Convert',
    'toolbar.viewDatabase': 'View Database',
    'toolbar.codebase': 'Codebase',
    'toolbar.github': 'GitHub',
    'toolbar.bitbucket': 'Bitbucket',
    'toolbar.exportPdf': 'Export PDF',
    'toolbar.exportDocx': 'Export DOCX',
    'toolbar.connectDomain': 'Connect Domain',
    'toolbar.createDevPlan': 'Create dev plan',
    'toolbar.publishToProd': 'Publish to prod',
    'toolbar.publishing': 'Publishing...',
    'toolbar.publishApp': 'Publish App',
    'toolbar.publishingToProduction': 'Publishing to production...',
    'toolbar.publishedSuccessfully': 'Published successfully',
    'toolbar.publishFailed': 'Publish failed',
    'toolbar.makeProduct': 'Make Product',
    'toolbar.prototypeSettings': 'Prototype Settings',
    'toolbar.productSettings': 'Product Settings',
    'toolbar.visualEdit': 'Visual Edit',
    'toolbar.connectToCodeRepo': 'Code repo',
    'toolbar.publishDocument': 'Publish document',
    'toolbar.shareProject': 'Share & collaborate',
    'toolbar.waitForGeneration': 'Wait for current generation to finish',
    'toolbar.turnPrdToPrototype': 'Turn your PRD into design prototype',
    'toolbar.turnPrototypeToApp': 'Turn your prototype to full-stack app',

    // Publish Modal
    'publish.title': 'Publish App',
    'publish.notPublished': 'App is not published yet',
    'publish.notPublishedDesc': 'Choose how you want to proceed with your app',
    'publish.publishToWeb': 'Publish to Web',
    'publish.createDevPlan': 'Create Dev Plan',
    'publish.published': 'App is Published',
    'publish.publishedDesc': 'Your app is live and accessible',
    'publish.publishUrl': 'Publish URL',
    'publish.copyUrl': 'Copy URL',
    'publish.urlCopied': 'URL copied to clipboard',
    'publish.visitSite': 'Visit Site',
    'publish.addCustomDomain': 'Add Custom Domain',
    'publish.enterCustomDomain': 'Enter custom domain',
    'publish.invalidDomain': 'Invalid domain format',
    'publish.updateFailed': 'Failed to update domain',
    'publish.domainUpdated': 'Domain updated successfully',
    'publish.publishing': 'Publishing...',
    'publish.publishYourProject': 'Publish your project',
    'publish.publishedRecently': 'Published recently',
    'publish.customDomain': 'Custom domain',
    'publish.manageDomains': 'Manage Domains',
    'publish.republish': 'Publish',
    'publish.previewNewerNotice': 'New preview ready for publishing',
    'publish.publishNow': 'Publish now',
    'publish.lastPublishedAt': 'Last published at',
    'toolbar.configAndPublish': 'Config & publish your product',
    'toolbar.firstCreateProduct': 'First create product through chat with Joy',

    // Side Panel
    'sidePanel.myProfile': 'My Profile',
    'sidePanel.billing': 'Billing',
    'sidePanel.admin': 'Admin',
    'sidePanel.shareAndEarn': '🎉 Earn Credits & More',
    'sidePanel.refillNow': 'Refill Now',
    'sidePanel.joinSlackCommunity': 'Join our slack community',
    'sidePanel.newProject': 'New Project',
    'sidePanel.logout': 'Logout',

    // Project Tabs
    'project.planner': 'Workboard',
    'project.builder': 'Dev Plan',
    'project.reporter': 'Insights',

    // Project List & Management
    'project.label': 'Project',
    'project.noProjectFound': 'No Project found',
    'project.name': 'Name',
    'project.owner': 'Owner',
    'project.startDate': 'Start Date',
    'project.access': 'Access',
    'project.action': 'Action',
    'project.shared': 'Shared',
    'project.self': 'Self',
    'project.organization': 'Organization',
    'project.team': 'Team',
    'project.projectNameRequired': 'Please specify a project name',
    'project.enterProjectName': 'Enter project name',
    'project.accessRequired': 'Please select who can access the project',
    'project.selectOwner': 'Select an owner',
    'project.deliveryDate': 'Delivery Date',
    'project.enterProjectDescription': 'Enter project description',
    'project.updateProject': 'Update Project',
    'project.viewOnlyAccess': 'You have View Only access to this project',
    'project.workflow': 'Project Workflow',
    'project.info': 'Project Info',
    'project.projectName': 'Project name',
    'project.description': 'Description',
    'project.stakeholders': 'Stakeholders',
    'project.createDate': 'Create Date',
    'project.dueDate': 'Due Date',
    'project.progress': 'Progress',
    'project.insight': 'Insight',
    'project.timelineShowingDeliverables':
      'timeline showing deliverables towards milestones',
    'project.risksMitigationsActions':
      'risks, mitigations, actions needed to take',
    'project.customize': 'Customize Workflow',
    'project.ownerRequired': 'Owner must be set',
    'project.dueDateRequired': 'Due date must be set',
    'project.documents': 'Documents',
    'project.createDocument': 'Create a {name} Document',
    'project.save': 'Save',
    'project.delete': 'Delete',
    'project.deleteStepTooltip': 'Delete this step',
    'project.cannotDeleteTooltip':
      'This step cannot be deleted because either it or the project has already started',
    'project.clone': 'Clone',
    'project.share': 'Share',
    'project.cloneProject': 'Clone Project',
    'project.shareProject': 'Share Project',
    'project.projectSettings': 'Project Settings',
    'project.buildableDescriptionPrd':
      'for product manager/owner to create requirements',
    'project.buildableDescriptionUiDesign':
      'for designers to create UI/UX Design',
    'project.buildableDescriptionPrototype':
      'for product owners to create a design prototype',
    'project.buildableDescriptionTechDesign':
      'for engineers to create technical design',
    'project.buildableDescriptionDevelopment':
      'for product owners to create dev plan',
    'project.buildableDescriptionQa': 'for QA Engineers to create QA Plan',
    'project.buildableDescriptionRelease':
      'for project owners to create Release checklist',
    'project.upgradeToScale':
      'Please upgrade to Scale Plan to access this feature.',
    'project.scalePlan': 'Scale Plan',
    'project.upgradeToTeams':
      'Please upgrade to Teams Plan to access this feature.',
    'project.teamsPlan': 'Teams Plan',
    'project.addIssue': 'Add Issue',
    'project.addIssueTooltip': 'add issue',
    'project.syncToJira': 'Sync To Jira',
    'project.submitChanges': 'Submit Changes',
    'project.buildablePrd': 'PRD',
    'project.buildableUiDesign': 'UI Design',
    'project.buildablePrototype': 'Prototype',
    'project.buildableTechDesign': 'Technical Design',
    'project.buildableDevelopment': 'Development Plan',
    'project.buildableQa': 'QA',
    'project.buildableRelease': 'Release',
    'project.buildableProposal': 'Business Proposal',
    'project.buildableProduct': 'Product',

    // Issues
    'issues.enterDescription': 'Enter description...',
    'issues.issueChangeHistory': 'Issue Change History',
    'issues.comments': 'Comments:',
    'issues.noComments': 'No comments',
    'issues.leaveComment': 'Leave a comment...',
    'issues.comment': 'Comment',
    'issues.back': 'Back',

    // Team Management
    'team.teamName': 'Team Name',
    'team.teamNameRequired': 'Please specify a team name',
    'team.teamDescription': 'Team Description',
    'team.members': 'Members',
    'team.membersRequired': 'Please add at least one team member',
    'team.selectUsers': 'Select users',
    'team.addTeam': 'Add Team',
    'team.accessFeature': 'For access to this feature, please',
    'team.upgradeToScale': 'upgrade to Scale Plan',
    'team.addFromOrganization': 'Add someone from your organization',
    'team.user': 'User',
    'team.selectUser': 'Select a user',
    'team.addTeamMember': 'Add Team Member',
    'team.email': 'Email',
    'team.emailInvalid': 'Not a valid email',
    'team.enterEmailInvite': 'Enter an email to invite',
    'team.add': 'Add',
    'team.usersToInvite': 'Users to invite',
    'team.sendInvitation': 'Send Invitation',
    'team.name': 'Name',
    'team.enterTeamName': 'Enter team name',
    'team.description': 'Description',
    'team.enterTeamDescription': 'Enter team description',
    'team.updateTeam': 'Update Team',

    // Building/Task Management
    'building.points': 'Points',
    'building.error': 'Error',
    'building.synced': 'Synced',
    'building.syncProjectToJira': 'Sync Project To Jira',
    'building.projectSyncedToJira': 'Project synced To Jira',
    'building.taskGenerationFailed': 'Task Generation Failed. Please Try Again',

    // User Management
    'user.firstName': 'First Name',
    'user.firstNameRequired': 'Please add first name',
    'user.lastName': 'Last Name',
    'user.lastNameRequired': 'Please add last name',
    'user.specialty': 'Specialty',
    'user.specialtyTooltip': 'Main job function for the user',
    'user.specialtyRequired': 'Please specify a specialty',
    'user.velocity': 'Velocity',
    'user.velocityTooltip':
      'Story points a user can complete every 2 weeks, usually between 5-10',
    'user.submit': 'Submit',
    'user.invitationOnly':
      'Omniflow is currently by invitation only. Please enter your inviter email.',
    'user.inviterEmail': 'Inviter Email',
    'user.inviterEmailRequired': 'Please enter your inviter email',
    'user.inviterEmailPlaceholder': 'please enter your inviter email',
    'user.confirmInvitation': 'Confirm invitation',
    'user.noInviterEmail': "If you don't have an inviter email, please",
    'user.requestAccess': 'request access',

    // Reporting
    'reporting.overallProject': 'Overall Project',
    'reporting.planning': 'Planning',
    'reporting.building': 'Building',
    'reporting.timeUsed': 'Time Used',
    'reporting.workProgress': 'Work Progress',
    'reporting.velocity': 'Velocity',
    'reporting.devVelocity': 'Dev Velocity',
    'reporting.milestonesCompleted': 'Milestones completed',
    'reporting.goodJobCompleted':
      'Good job. You have completed all tasks for milestones in Builder.',
    'reporting.publishPrdFirst':
      'Please first publish PRD and Development Plan from Planning',
    'reporting.riskScore': 'Risk Score - {name}',
    'reporting.timeTooltip':
      '{pastTime} out of {totalTime} days, due by {dueDate}',
    'reporting.velocityTooltip': '{velocity}% of expected velocity',
    'reporting.insights': 'Insights',

    // Project Management
    'project.scrum': 'Scrum',
    'project.kanban': 'Kanban',
    'project.projects': 'Projects',
    'project.view': 'VIEW',
    'project.edit': 'Edit',
    'project.cloneConfirmTitle': 'Clone Project',
    'project.cloneConfirmContent':
      'Are you sure you want to clone "{name}"? This will create a new project with the same data.',
    'project.cloneSuccess':
      'Project "{name}" has been cloned successfully as "{clonedName}"',
    'project.cloneError': 'Failed to clone project. Please try again.',

    // Issue Editor
    'issue.issueName': 'Issue Name',
    'issue.issueNameRequired': 'Please input issue name',
    'issue.enterIssueName': 'Enter name of issue',
    'issue.parentEpic': 'Parent Epic',
    'issue.parentEpicRequired': 'Please select parent epic',
    'issue.pleaseSelect': 'Please select',
    'issue.sprintSelection': 'Sprint Selection',
    'issue.preSelect': 'Pre-select',
    'issue.backlog': 'Backlog',
    'issue.sprint': 'Sprint',
    'issue.insights': 'Insights',
    'issue.newTasks': 'New Tasks',
    'issue.milestoneImpacts': 'Milestone Impacts',
    'issue.publish': 'Publish',
    'issue.other': 'Other',

    // Sharing
    'sharing.enterEmailToShare': 'Please enter email to share the doc with',

    // Issue Details
    'issue.type': 'Type:',
    'issue.assignee': 'Assignee:',
    'issue.storyPoint': 'Story Point:',
    'issue.status': 'Status:',
    'issue.plannedDate': 'Planned Date:',
    'issue.parent': 'Parent:',
    'issue.modified': 'modified',
    'issue.to': 'to',
    'issue.at': 'at',

    // Building Tables & Columns
    'building.sprint': 'Sprint',
    'building.task': 'Task',
    'building.milestone': 'Milestone',
    'building.milestones': 'Milestones',
    'building.workPlan': 'Work Plan',
    'building.taskBoard': 'Task Board',
    'building.status': 'Status',
    'building.schedule': 'Schedule',
    'building.progress': 'Progress',
    'building.goals': 'Goals',
    'building.addIssueButton': '+ Add Issue',
    'building.issues': 'Issues',
    'building.backlog': 'Backlog',
    'building.noSprintsAvailable': 'No sprints available',
    'building.progressFormat': 'Progress: {completed}/{total}',
    'building.publishPrdAndDevPlan':
      'Please first publish the PRD and Development Plan from Planner',
    'building.publishDevPlan':
      'Please first publish the Development Plan from Planner',

    // Settings
    'settings.generationSettings': 'Generation Settings',
    'settings.userManagement': 'User Management',
    'settings.integrations': 'Integrations',
    'settings.referral': 'Referral',
    'settings.designCustomization': 'Design Customization',
    'settings.upgradePlanForAccess': 'Upgrade plan for access',
    'settings.email': 'Email',
    'settings.users': 'Users',
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Projects',
    'nav.myProjects': 'My Projects',
    'nav.knowledgeBase': 'Knowledge Base',
    'nav.templates': 'Templates',
    'nav.templateDocuments': 'Template Documents',
    'nav.templateShowcase': 'Template Showcase',
    'nav.inviteTeam': 'Invite Team',

    // Knowledge Base
    'knowledgeBase.title': 'Knowledge Base',
    'knowledgeBase.description': 'Manage your knowledge bases',
    'knowledgeBase.create': 'Create Knowledge Base',
    'knowledgeBase.createFirst': 'Create your first knowledge base',
    'knowledgeBase.createSuccess': 'Knowledge base created successfully',
    'knowledgeBase.createError': 'Failed to create knowledge base',
    'knowledgeBase.name': 'Name',
    'knowledgeBase.namePlaceholder': 'Enter knowledge base name',
    'knowledgeBase.nameRequired': 'Name is required',
    'knowledgeBase.descriptionField': 'Description',
    'knowledgeBase.descriptionPlaceholder': 'Enter description (optional)',
    'knowledgeBase.searchPlaceholder': 'Search knowledge bases...',
    'knowledgeBase.noKnowledgeBases': 'No knowledge bases yet',
    'knowledgeBase.noSearchResults': 'No matching knowledge bases found',
    'knowledgeBase.files': 'Files included: ',
    'knowledgeBase.by': 'By',
    'knowledgeBase.createdBy': 'Created by',
    'knowledgeBase.createdAt': 'Created at',
    'knowledgeBase.notFound': 'Knowledge base not found',
    'knowledgeBase.delete': 'Delete Knowledge Base',
    'knowledgeBase.confirmDelete': 'Delete Knowledge Base',
    'knowledgeBase.confirmDeleteMessage':
      'Are you sure you want to delete this knowledge base? All files and vectors will be permanently deleted.',
    'knowledgeBase.deleteSuccess': 'Knowledge base deleted successfully',
    'knowledgeBase.deleteError': 'Failed to delete knowledge base',
    'knowledgeBase.updateSuccess': 'Knowledge base updated successfully',
    'knowledgeBase.updateError': 'Failed to update knowledge base',
    'knowledgeBase.assignToProject': 'Assign to Project',
    'knowledgeBase.assignSuccess': 'Projects assigned successfully',
    'knowledgeBase.assignError': 'Failed to assign projects',
    'knowledgeBase.selectProjects': 'Select Projects',
    'knowledgeBase.noProjectsAvailable': 'No projects available',
    'knowledgeBase.test': 'Test',
    'knowledgeBase.chat': 'Chat',
    'knowledgeBase.settings': 'Settings',
    'knowledgeBase.basicInfo': 'Basic Information',
    'knowledgeBase.dangerZone': 'Danger Zone',
    'knowledgeBase.deleteKnowledgeBase': 'Delete Knowledge Base',
    'knowledgeBase.deleteWarning':
      'This action cannot be undone. All data will be permanently deleted.',
    'knowledgeBase.information': 'Information',
    'knowledgeBase.totalFiles': 'Total Files',

    // File Management
    'knowledgeBase.fileName': 'File Name',
    'knowledgeBase.fileSize': 'Size',
    'knowledgeBase.status': 'Status',
    'knowledgeBase.chunks': 'Chunks',
    'knowledgeBase.uploadedBy': 'Uploaded By',
    'knowledgeBase.uploadedAt': 'Uploaded At',
    'knowledgeBase.selectFiles': 'Select Files',
    'knowledgeBase.uploadFiles': 'Upload Files',
    'knowledgeBase.selectFileFirst': 'Please select files first',
    'knowledgeBase.uploadSuccess': 'Files uploaded successfully',
    'knowledgeBase.uploadError': 'Failed to upload files',
    'knowledgeBase.supportedFormats':
      'Supported: txt, md, pdf, docx, csv, xlsx, xls, images, code files (max 50MB)',
    'knowledgeBase.statusPending': 'Pending',
    'knowledgeBase.statusProcessing': 'Processing',
    'knowledgeBase.statusCompleted': 'Completed',
    'knowledgeBase.statusFailed': 'Failed',
    'knowledgeBase.confirmDeleteFile': 'Delete File',
    'knowledgeBase.confirmDeleteFileMessage':
      'Are you sure you want to delete this file',
    'knowledgeBase.deleteFileSuccess': 'File deleted successfully',
    'knowledgeBase.deleteFileError': 'Failed to delete file',
    'knowledgeBase.reprocess': 'Reprocess',
    'knowledgeBase.reprocessStarted': 'File reprocessing started',
    'knowledgeBase.reprocessError': 'Failed to reprocess file',
    'knowledgeBase.download': 'Download',
    'knowledgeBase.downloadError': 'Failed to download file',
    'knowledgeBase.downloadStarted': 'Download started',
    'knowledgeBase.dragUpload': 'Click or drag file to this area to upload',
    'knowledgeBase.uploading': 'Uploading',
    'knowledgeBase.processing': 'Processing',
    'knowledgeBase.uploadComplete': 'Upload Complete',

    // Knowledge Test
    'knowledgeBase.testQuery': 'Test Query',
    'knowledgeBase.testQueryDescription':
      'Enter a question to test knowledge retrieval from your knowledge base',
    'knowledgeBase.enterTestQuery': 'Enter your test question here...',
    'knowledgeBase.search': 'Search',
    'knowledgeBase.searching': 'Searching knowledge base...',
    'knowledgeBase.searchResults': 'Search Results',
    'knowledgeBase.noResults': 'No relevant information found',
    'knowledgeBase.enterQueryToTest':
      'Enter a query above to test knowledge retrieval',
    'knowledgeBase.similarity': 'Similarity',
    'knowledgeBase.relevantChunks': 'Relevant Knowledge',
    'knowledgeBase.source': 'Source',
    'knowledgeBase.imageOCR': 'Image OCR',
    'knowledgeBase.ocrExtracted': 'OCR Extracted',
    'knowledgeBase.extractedText': 'Extracted Text',
    'knowledgeBase.noTextExtracted': 'No text was extracted from this image',

    // Knowledge Chat
    'knowledgeBase.startConversation':
      'Start a conversation with your knowledge base',
    'knowledgeBase.typeMessage': 'Type your message here...',
    'knowledgeBase.thinking': 'Thinking...',
    'knowledgeBase.chatError':
      'Sorry, I encountered an error. Please try again.',
    'knowledgeBase.loadError': 'Failed to load knowledge bases',
    'knowledgeBase.retry': 'Retry',

    // Billing
    'billing.title': 'Billing',
    'billing.subscriptionPlan': 'Subscription Plan',
    'billing.currentPlan': 'Current Plan',
    'billing.planWillStop': 'Your current plan will stop on',
    'billing.totalSeats': 'Total available seats',
    'billing.remainingSeats': 'Remaining available seats',
    'billing.changePlan': 'Change Plan',
    'billing.choosePlan': 'Choose a Plan',
    'billing.cancelPlan': 'Cancel Plan',
    'billing.cancelConfirm': 'Do you want to cancel the current subscription?',
    'billing.yes': 'Yes',
    'billing.no': 'No',
    'billing.choosePlanTitle': 'Choose a plan',
    'billing.freePlan': 'You are currently on the Free plan.',
    'billing.upgradePlan': 'Upgrade Plan',
    'billing.credits': 'Credits',
    'billing.currentBalance': 'Current credit balance',
    'billing.purchaseCredits': 'Purchase Credits',
    'billing.creditHistory': 'Credit History',
    'billing.subscriptionCancelled': 'The subscription has been cancelled.',
    'billing.cancellationFailed': 'Subscription cancellation failed:',

    // Profile
    'profile.updateProfile': 'Update your profile',
    'profile.completeProfile': 'Complete your profile',
    'profile.email': 'Email',
    'profile.name': 'Name',
    'profile.firstName': 'First Name',
    'profile.lastName': 'Last Name',
    'profile.role': 'Role',
    'profile.roleTooltip': 'Your main job function or title in your team',
    'profile.selectRole': 'Select a role',
    'profile.website': 'Website',
    'profile.websitePlaceholder': 'please enter your website',
    'profile.organizationName': 'Organization Name',
    'profile.organizationSize': 'Organization Size',
    'profile.industry': 'Industry',
    'profile.selectIndustry': 'Select an industry',
    'profile.save': 'Save',
    'profile.fillRequired': 'Please fill in all required values',
    'profile.updateSuccess': 'Your profile has been updated successfully',
    'profile.loadingError':
      'An error occurred while loading the existing profile:',

    // Referral
    'referral.loadingData': 'Loading referral data...',
    'referral.errorLoading': 'Error Loading Referral Data',
    'referral.failedToLoad':
      'Failed to load referral data. Please try again later.',
    'referral.dashboard': 'Referral Dashboard',
    'referral.adminView': '(Admin View - All Users)',
    'referral.trackAllUsers':
      "Track all users' referrals and commission earnings",
    'referral.trackYourReferrals':
      'Track your referrals and commission earnings',
    'referral.paidReferral': 'Paid Referral',
    'referral.canceledCommissions': 'Canceled Commissions',
    'referral.commissionEarned': 'Commission Earned',
    'referral.pendingCommissions': 'Pending Commissions',
    'referral.referralsByMonth': 'Referrals by Month',
    'referral.monthlySummary':
      'Monthly summary of your referrals with expandable details',
    'referral.noDataFound':
      'No referral data found. Start sharing your referral code!',
    'referral.referrer': 'Referrer',
    'referral.referredUser': 'Referred User',
    'referral.signupDate': 'Signup Date',
    'referral.subscriptionDate': 'Subscription Date',
    'referral.noSubscription': 'No subscription',
    'referral.amount': 'Amount',
    'referral.noPayment': 'No payment',
    'referral.commission': 'Commission',
    'referral.noCommission': 'No commission',
    'referral.status': 'Status',
    'referral.noPaymentStatus': 'No Payment',
    'referral.actions': 'Actions',
    'referral.markPaid': 'Mark Paid',
    'referral.cancel': 'Cancel',
    'referral.alreadyPaid': '✅ Already Paid',
    'referral.alreadyCanceled': '❌ Already Canceled',
    'referral.noPayments': 'No payments',
    'referral.noPaymentYet': 'No payment yet',
    'referral.getCredits':
      '🎁 Get 1,000 free credits when your referred user signs up',
    'referral.earnCommission':
      '💰 Earn 15% commission on their first 6 months of subscription',
    'referral.trackReferrals': 'Track your referals by visiting',
    'referral.referralPage': 'Referal page',
    'referral.code': 'Code',
    'referral.noCodeAvailable': 'No referral code available',
    'referral.copy': 'Copy',
    'referral.url': 'URL',
    'referral.codeCopied': 'Referral code copied to clipboard!',
    'referral.urlCopied': 'Referral URL copied to clipboard!',
    'referral.copyFailed': 'Failed to copy referral code',
    'referral.urlCopyFailed': 'Failed to copy URL',
    'referral.message': 'Message',
    'referral.defaultMessage':
      "Hey! I'm trying out Omniflow and loving it. It turns my idea to PRD, prototype and final product in one seamless workflow. Give it a try: {referralUrl}",
    'referral.messageCopied': 'Message copied to clipboard!',
    'referral.messageCopyFailed': 'Failed to copy message',

    // Integration
    'integration.jiraIntegration': 'Jira Integration',
    'integration.jiraDescription':
      'Connect your Jira instance to sync projects and issues',
    'integration.githubConnect': 'GitHub Connect',
    'integration.githubDescription':
      'Connect your GitHub account to manage repositories and code',
    'integration.bitbucketConnect': 'Bitbucket Connect',
    'integration.bitbucketDescription':
      'Connect your Bitbucket account to manage repositories and code',

    // Issues & Organization
    'issues.recentTasks':
      'Please see below for your recent project tasks, apps or prds.',
    'organization.currentProjects': 'Current Projects',

    // Streaming Editor
    'streaming.polishingCss': 'Polishing CSS...',
    'streaming.minifyingJs': 'Minifying JavaScript...',
    'streaming.optimizingAssets': 'Optimizing assets...',
    'streaming.refiningLayout': 'Refining layout...',
    'streaming.tuningPerformance': 'Tuning performance...',
    'streaming.aligningPixels': 'Aligning pixels...',
    'streaming.lintingFiles': 'Linting files...',
    'streaming.trimmingWhitespace': 'Trimming whitespace...',
    'streaming.polishingApp': 'Polishing app',
    'streaming.creatingDocument': 'Creating {documentName}...',
    'streaming.updatingDocument': 'Updating {documentName}...',
    'streaming.deployingDocument': 'Deploying {documentName}...',
    'streaming.planningFiles': 'Planning files...',

    // Modal Titles
    'modal.addProject': 'Add Project',
    'modal.addDocument': 'Add Document',
    'modal.addChat': 'Add Idea',
    'modal.editDocument': 'Edit Document',
    'modal.deleteDocument': 'Delete Document',
    'modal.editChat': 'Edit Idea',
    'modal.deleteChat': 'Delete Idea',
    'modal.viewTutorial': 'Omniflow Demo',
    'modal.addIssue': 'Create Issue',
    'modal.addTeam': 'Create Team',
    'modal.addTeamMember': 'Add a Team Member',
    'modal.inviteUser': 'Invite Team',
    'modal.addVirtualUser': 'Create Virtual Teammate',
    'modal.deleteProject': 'Delete Project',
    'modal.editProject': 'Edit Project',
    'modal.shareProject': 'Share Project',
    'modal.editTeam': 'Edit Team',
    'modal.deleteTeam': 'Delete Team',
    'modal.deleteTeamInvalid': 'Cannot Delete Team',
    'modal.createPrd': 'Create PRD',
    'modal.createUiDesign': 'Create UI/UX Design',
    'modal.createTechDesign': 'Create Technical Design',
    'modal.createDevelopmentPlan': 'Create Development Plan',
    'modal.createQaPlan': 'Create QA Plan',
    'modal.createReleasePlan': 'Create Release Plan',
    'modal.createBusinessProposal': 'Create Business Proposal',
    'modal.updateSubscription': 'Change Plan',
    'modal.purchaseCredits': 'Purchase Credits',
    'modal.editWorkflow': 'Customize Project Workflow',
    'modal.deleteDocumentImage': 'Delete Document Image',
    'modal.addTemplateDocument': 'Create Document Template',
    'modal.fillDatabaseSettings': 'Configure Database',
    'modal.stripeConfig': 'Configure Stripe',
    'modal.referralModal': '🎁 Share Omniflow & Earn Rewards!',
    'modal.feedback': 'Share Your Feedback',

    // Feedback Form
    'feedback.npsQuestion':
      'How likely are you to recommend Omniflow to your friends & colleagues?',
    'feedback.npsScale': 'Scale',
    'feedback.veryUnlikely': 'Very Unlikely',
    'feedback.veryLikely': 'Very Likely',
    'feedback.neutral': 'Neutral',
    'feedback.likely': 'Likely',
    'feedback.whatYouLike': 'What do you like about Omniflow?',
    'feedback.whatYouLikePlaceholder':
      'Tell us what you enjoy about Omniflow...',
    'feedback.whatYouDontLike': 'What do you hope to improve about Omniflow?',
    'feedback.whatYouDontLikePlaceholder':
      'We will make it better. Share your thoughts...',
    'feedback.slackMessage':
      'After submission, join #user-support channel to get 1000 free credits!',
    'feedback.submit': 'Submit',
    'feedback.submitSuccess': 'Thank you for your feedback!',
    'feedback.submitError': 'Failed to submit feedback. Please try again.',
    'feedback.pleaseRate': 'Please rate your likelihood to recommend.',
    'feedback.whatYouLikeRequired':
      'Please tell us what you like about Omniflow',
    'feedback.whatYouDontLikeRequired':
      'Please tell us what you do not like about Omniflow',
    'feedback.giveFeedback': 'Give Feedback',
    'feedback.feedbackForCredits': 'Feedback for Credits',

    // Free Projects Counter
    'freeProjects.limitReached': 'Your free projects have been used.',
    'freeProjects.used': 'You have used {used}/{limit} free projects.',
    'freeProjects.getUnlimited': 'Get unlimited & more',

    // Generation Settings
    'generation.estimateStoryPoints':
      'Please estimate how many story points it will take your team to deliver this sample task below. It is used for task estimation during development plan generation.',
    'generation.sampleTaskDescription': 'Sample Task Description',
    'generation.sampleTaskStoryPoint': 'Sample Task Story Point',
    'generation.baselineStoryPoint':
      'Baseline story point for the sample task.',
    'generation.enterStoryPoint':
      'Enter the estimated story point of your team for the sample task below',
    'generation.documentGenerateLanguage': 'Document Generate Language',
    'generation.selectLanguage':
      'Select the language of your team for the documents generate',
    'generation.stopped': 'Generation has been cancelled',

    // Document Actions
    'document.stopGeneration': 'Cancel generation',
    'document.stopping': 'Cancelling...',

    // Language Select
    'language.selectPlaceholder': 'Select a language',
    'language.switchTo': 'Switch to',
    'language.english': 'English',
    'language.chinese': '中文',

    // Home Page
    'home.mainTitle': 'Ideas to Real Products, in One Unified Workflow',
    'home.subtitle':
      'Turn requirement to full-stack, production-grade software',
    'home.appTemplates': 'App Templates',
    'home.projectDescriptionPlaceholder':
      'Enter project description or select a project category below',
    'home.noProjectsFound': 'No projects found for this category.',
    'home.preview': 'Preview',
    'home.clone': 'Clone',
    'home.addProjectDescription':
      'Please add a project below, and start experiencing the magic of Omniflow!',
    'home.addProject': 'Add Project',

    // Sharing Modals
    'sharing.peopleWithAccess': 'People with access',
    'sharing.generalAccess': 'General access',
    'sharing.shareableLink': 'Shareable Link',
    'sharing.share': 'Share',

    // Pricing Plans
    'pricing.runningOutOfCredits':
      "⚠️ You're running out of credits! Please upgrade your plan, Buy More Credits, or Share & Earn to continue.",
    'pricing.cashPayNotSupported':
      '⚠️ Cash App Pay is not currently supported. Please use other payment methods.',
    'pricing.buyMoreCredits': 'Buy More Credits:',
    'pricing.buyCredits': 'Buy Credits',
    'pricing.enterpriseContact':
      'For Enterprise customers, please contact us at',
    'pricing.everythingInPlus': 'Everything in {tier}, plus:',
    'pricing.popular': 'Popular',

    // Pricing Plans
    'pricing.performance': 'Performance',
    'pricing.teams': 'Teams',
    'pricing.scale': 'Scale',
    'pricing.forIndividualsToShip': 'For Individuals to Ship New Products',
    'pricing.forTeamsToBoost': 'For Teams to Boost Productivity',
    'pricing.forLargeTeamsToTransform':
      'For Large Teams to Transform Product Delivery',

    // Pricing Features
    'pricing.free': 'Free',
    'pricing.team': 'Team',
    'pricing.creditsPerMonth20k': '20,000 credits/mo',
    'pricing.creditsPerMonth75k': '75,000 credits/mo',
    'pricing.creditsPerMonth200k': '200,000 credits/mo',
    'pricing.creditsPerMonth4x': '4x credits/month',
    'pricing.creditsPerMonth15x': '15x credits/month',
    'pricing.creditsPerMonth40x': '40x credits/month',
    'pricing.everythingInFree': 'Free',
    'pricing.everythingInPerformance': 'Performance',
    'pricing.everythingInTeams': 'Teams',
    'pricing.unlimitedProjects': 'Unlimited Projects',
    'pricing.customDomain': 'Custom Domain',
    'pricing.liveCodeEditing': 'Live Code Editing',
    'pricing.fullStack': 'Full frontend, backend & database',
    'pricing.authFileStoragePaymentEmail':
      'Auth, File Storage, Payment & Email',
    'pricing.builtInAIGeneration': 'Built-in AI generation',
    'pricing.publishAndHost': 'Publish live apps',
    'pricing.teamInvitation': 'Team invitation',
    'pricing.customDesignLanguage': 'Custom Design language',
    'pricing.databaseSnapshot': 'Database snapshot, rollback & reset',
    'pricing.githubBitbucketSync': 'Github/Bitbucket code sync',
    'pricing.jiraIntegration': 'JIRA Integration',
    'pricing.roleBasedAccessControl': 'Role-based access control',
    'pricing.centralizedBilling': 'Centralized billing',
    'pricing.upTo20Users': 'Up to 20 users',
    'pricing.upTo100Users': 'Up to 100 users',
    'pricing.prioritySupport': 'Priority Support',
    'pricing.customIntegration': 'Custom integration',
    'pricing.knowledgeBase': 'Knowledge base',
    'pricing.customTechStack': 'Custom Tech stack',
    'pricing.viewBuildAndRuntimeLogs': 'Build and runtime logs',
    'prototypeEditor.upgradePlanToViewLogs': 'Upgrade plan to view logs',
    'nav.upgradePlanToAccessKnowledgeBase':
      'Upgrade plan to access knowledge base',

    // Pricing Sections
    'pricing.planner': 'Planner',
    'pricing.builder': 'Builder',
    'pricing.reporter': 'Reporter',

    // Pricing Plan Terms
    'pricing.monthly': 'Monthly',
    'pricing.annuallyDiscount': 'Annually (10% off)',
    'pricing.currentlySelected': 'Currently Selected',
    'pricing.currentPlan': 'Current Plan',
    'pricing.choosePlan': 'Choose {plan}',
    'pricing.period': '/mo/user',
    'pricing.periodPerformance': '/mo',
    'pricing.earlyBirdDiscount':
      '🎉 50% Early Bird Discount Applied - Valid until October 2025',

    // Direct Referrals
    'referral.directReferralsByMonth': 'Direct Referrals by Month',
    'referral.directMonthlySummary': 'Monthly summary of your direct referrals',
    'referral.monthsRangeOfTotal': '{range[0]}-{range[1]} of {total} months',
    'referral.noDirectReferralData':
      'No 1st degree referral data found. Start sharing your referral code!',

    // Profile & User Management (additional)
    'profile.specialty': 'Specialty',
    'profile.specialtyTooltip': 'Select your role or specialty',
    'profile.velocity': 'Velocity',
    'profile.noDepartment': 'No Department',
    'profile.jiraId': 'Jira Id',

    // Specialty Roles
    'specialty.productManagement': 'Product Management',
    'specialty.uiDesign': 'UI Design',
    'specialty.frontendEngineer': 'Frontend Engineer',
    'specialty.backendEngineer': 'Backend Engineer',
    'specialty.fullstackEngineer': 'Fullstack Engineer',
    'specialty.infraDevopsEngineer': 'Infra/DevOps Engineer',
    'specialty.dataEngineer': 'Data Engineer',
    'specialty.mlAiEngineer': 'ML/AI Engineer',
    'specialty.qaEngineer': 'QA Engineer',
    'specialty.releaseEngineer': 'Release Engineer',
    'specialty.mobileEngineerIos': 'Mobile Engineer - iOS',
    'specialty.mobileEngineerAndroid': 'Mobile Engineer - Android',
    'specialty.mobileEngineerWindows': 'Mobile Engineer - Windows',
    'specialty.securityEngineer': 'Security Engineer',
    'specialty.technicalWriter': 'Technical Writer',
    'specialty.engineeringManager': 'Engineering Manager',
    'specialty.technicalLead': 'Technical Lead',
    'specialty.architect': 'Architect',
    'specialty.cto': 'CTO',
    'specialty.ceo': 'CEO',
    'specialty.founder': 'Founder',
    'specialty.dataScientist': 'Data Scientist',
    'specialty.productManager': 'Product Manager',
    'specialty.uiDesigner': 'UI Designer',

    // Industries
    'industry.agriculture': 'Agriculture',
    'industry.automotive': 'Automotive',
    'industry.banking': 'Banking',
    'industry.construction': 'Construction',
    'industry.consumerGoods': 'Consumer Goods',
    'industry.education': 'Education',
    'industry.energy': 'Energy',
    'industry.entertainment': 'Entertainment',
    'industry.financialServices': 'Financial Services',
    'industry.foodBeverage': 'Food & Beverage',
    'industry.healthcare': 'Healthcare',
    'industry.hospitality': 'Hospitality',
    'industry.insurance': 'Insurance',
    'industry.manufacturing': 'Manufacturing',
    'industry.mediaAdvertising': 'Media & Advertising',
    'industry.realEstate': 'Real Estate',
    'industry.retail': 'Retail',
    'industry.technology': 'Technology',
    'industry.telecommunications': 'Telecommunications',
    'industry.transportationLogistics': 'Transportation & Logistics',

    // Company Sizes
    'companySize.under50': '<50 employees',
    'companySize.50to300': '50-300 employees',
    'companySize.300to500': '300-500 employees',
    'companySize.over500': '>500 employees',

    // Referral Sources
    'referral.searchEngine': 'Search Engine (e.g., Google)',
    'referral.socialMedia': 'Social Media (e.g., LinkedIn, Twitter)',
    'referral.friend': 'Friend or Colleague',
    'referral.advertisement': 'Advertisement',
    'referral.other': 'Other',
    'referral.howDidYouHear': 'How did you hear about us?',
    'referral.selectSource': 'Please select how you heard about us',

    // FTUE Help Categories
    'ftue.improveWorkflow': 'Improve product development workflow',
    'ftue.automateDocuments':
      'Automate documents creation (PRD,Tech Design etc)',
    'ftue.createPrd': 'Generate fully functional prototypes',
    'ftue.automateTasks': 'Automate Task Breakdown and scheduling',
    'ftue.trackTimeline': 'Track timeline and execution',
    'ftue.improveCommunication': 'Improve team communication and alignment',
    'ftue.gainVisibility': 'Gain visibility to project progress',
    'ftue.welcome': 'Hello, welcome to Omniflow!',
    'ftue.description1':
      'Turn your ideas into product specs, fully functional design prototypes, and final fullstack product with AI. Seamlessly integrated into your existing workflow.',
    'ftue.description2':
      "Let's begin with a few quick questions, so we can get to know you better.",
    'ftue.whatHelpNeeded': 'What help do you need the most?',
    'ftue.tellUsMore': 'Tell us more about you & your company',
    'ftue.otherHelpPlaceholder':
      "Please add anything else that's not mentioned above",

    // Forgot Password Flow
    'forgotPassword.title': 'Reset your password',
    'forgotPassword.subtitle': 'We will send a verification code to your email',
    'forgotPassword.sendCode': 'Send code',
    'forgotPassword.backToSignIn': 'Back to Sign In',
    'forgotPassword.enterEmail': 'Enter your email',
    'forgotPassword.checkEmail': 'Check your email',
    'forgotPassword.codeInstructions':
      'Your code is on the way. To log in, enter the code we emailed to',
    'forgotPassword.resendCode': 'Resend Code',
    'forgotPassword.confirm': 'Confirm',

    // Monthly Table Columns
    'monthlyTable.month': 'Month',
    'monthlyTable.paidReferral': 'Paid Referral',
    'monthlyTable.totalCommission': 'Total Commission',
    'monthlyTable.pending': 'Pending',
    'monthlyTable.paid': 'Paid',
    'monthlyTable.canceled': 'Canceled',
    'monthlyTable.status': 'Status',
    'monthlyTable.actions': 'Actions',
    'monthlyTable.complete': '✅ Complete',
    'monthlyTable.pendingStatus': '⏳ Pending',
    'monthlyTable.payAll': 'Pay All ({count})',

    // Credit List Table Columns
    'creditList.actionName': 'Action Name',
    'creditList.amount': 'Amount',
    'creditList.status': 'Status',
    'creditList.document': 'Document',
    'creditList.user': 'User',
    'creditList.createdAt': 'Created At',

    // Template Document
    'template.save': 'Save',
    'template.edit': 'Edit',
    'template.clone': 'Clone',
    'template.useTemplate': 'Use Template',
    'template.templatePrompt': 'Template Prompt',
    'template.templatePromptDescription':
      'This auto-generated prompt text will be used to create documents based on this template.',
    'template.noPermissionEdit':
      'You do not have permission to edit this template.',
    'template.clonedSuccessfully':
      'Template cloned successfully. You may edit it next',
    'template.updatedSuccessfully': 'Template updated successfully',
    'template.inUse': 'In Use',
    'template.access': '{access} access',

    // Template Access Types
    'templateAccess.self': 'Self',
    'templateAccess.organization': 'Organization',
    'templateAccess.public': 'Public',

    // Template Clone
    'template.cloneSuffix': 'Clone',
    'template.builtIn': 'Built-in',
    'template.cannotEditBuiltIn': 'Cannot edit built-in templates',

    'project.navigateToPrototype': 'Navigate to Prototype',
    'project.navigateToPrototypeContent':
      'Would you like to view the Prototype now? (it might be still deploying)',
    'project.navigateToPrototypeOk': 'OK',
    'project.navigateToPrototypeCancel': 'Cancel',

    'template.by': 'by',
    'template.documentTemplates': 'Document Templates',
    'template.templateCenter': 'Template Center',
    'template.back': 'Back',
    'template.searchPlaceholder': 'Search by template name or description',
    'template.newTemplate': 'New Template',
    'template.name': 'Name',
    'template.nameRequired': 'Please specify a template name',
    'template.namePlaceholder': 'Enter template name',
    'template.type': 'Type:',
    'template.typeRequired': 'Please choose a document type',
    'template.description': 'Description',
    'template.descriptionTooltip':
      'The purpose of the template and its intended use',
    'template.descriptionRequired':
      'Please describe the purpose of the template',
    'template.descriptionPlaceholder':
      'Please specify the purpose of the template, for example, a standard PRD template for new products development',
    'template.generateTemplatePrompt': 'Generate Template Prompt',
    'template.regenerateTemplatePrompt': 'Regenerate Template Prompt',
    'template.templatePromptLabel': 'Template Prompt',
    'template.templatePromptTooltip':
      'The instructions are used as the context for the AI to generate the output document',
    'template.templatePromptRequired': 'Please specify the user instructions',
    'template.checkTemplateOutput': 'Check Template Output',
    'template.saveTemplate': 'Save Template',
    'template.sampleInput': 'Sample Input',
    'template.sampleInputTooltip':
      'Enter a sample user input that will be used with the prompt to generate the output',
    'template.sampleInputRequired': 'Please provide a sample user input',
    'template.sampleInputPlaceholder':
      'Please include the context, problem, or user\'s requirements for the generation. Example below for Omniflow PRD input:\n- "we want to build an app that automate the entire product development lifecycle. Through a brief description of the product, Omniflow will generate a comprehensive PRD, UIUX design, technical design, development, and more."',
    'template.outputDoc': 'Output Doc',
    'template.outputDocTooltip':
      "After you enter the sample input, press the 'Generate Sample Output' button to get the output.",
    'template.outputDocRequired':
      'Please provide input above to generate this sample output',
    'template.generateSampleOutput': 'Generate Sample Output',
    'template.toolbarHelperText':
      'Want to make changes to the prompt? You can directly edit below OR modify the description above to generate.',
    'template.toolbarHelperTextOutput': 'You can directly edit content below.',
    'template.generatePromptFirst':
      'Please generate the template prompt first in the main screen',
    'template.create': 'Create',

    // User Guide & Welcome
    'userGuide.title': 'Omniflow User Guide',
    'userGuide.welcome':
      "Welcome to Omniflow. Let's start exploring more of it.",
    'userGuide.viewFaq': 'View FAQ',
    'userGuide.watchDemo': 'Watch Demo',
    'welcome.title': 'Welcome to Omniflow!',
    'welcome.description':
      'Please {addProjectLink}, to start experiencing the magic of Omniflow!',
    'welcome.addFirstProject': 'Add Your First Project',
    'welcome.newProject': 'New project',

    // Prototype Editor
    'prototypeEditor.preview': 'Preview',
    'prototypeEditor.status': 'Status: {status}',
    'prototypeEditor.sourceFiles': 'Source Files',
    'prototypeEditor.editor': 'Editor',
    'prototypeEditor.editorWithFile': 'Editor - {file}',
    'prototypeEditor.buildingAppPreview': 'Building app preview',
    'prototypeEditor.visualEditPreview': 'Please wait while we apply your changes',
    'prototypeEditor.startingLivePreview': 'We are starting live preview, please wait',
    'prototypeEditor.pleaseWaitPreview':
      'Please wait while we prepare your app for preview',
    'prototypeEditor.networkIssue': 'Network Issue',
    'prototypeEditor.somethingWentWrong':
      'Oops. Something has gone wrong. Please refresh your browser and retry.',
    'prototypeEditor.deploymentFailed':
      'Deployment failed with errors:\n\n{error}\n\nPlease analyze and fix the build errors.',
    'prototypeEditor.chatWithJoyToCreate':
      'Chat with Joy at the left-side chatbox to create the {documentName}',
    'prototypeEditor.noDocumentCreatedYet': 'No {documentName} created yet',
    'prototypeEditor.loadingAppPreview': 'Loading app preview...',
    'prototypeEditor.deploymentCompletedSuccessfully':
      'Deployment completed successfully!',
    'prototypeEditor.previewApp': 'Preview app',
    'prototypeEditor.viewCode': 'View code',
    'prototypeEditor.viewPrototype': 'View Prototype',
    'prototypeEditor.viewProduct': 'View Product',
    'prototypeEditor.viewApp': 'View App',
    'prototypeEditor.code': 'Code',
    'prototypeEditor.fixErrors': 'Fix Errors',
    'prototypeEditor.savingChanges': 'Saving changes...',
    'prototypeEditor.saveChanges': 'Save changes',
    'prototypeEditor.deployChange': 'Deploy change',
    'prototypeEditor.confirmDeployment': 'Confirm Deployment',
    'prototypeEditor.deploymentMayTakeTime':
      'This deployment may take several minutes. Do you want to continue?',
    'prototypeEditor.rememberToPublish':
      'Please note you still need to publish the app to production after deployment.',
    'prototypeEditor.mobilePreviewMode': 'Mobile',
    'prototypeEditor.desktopPreviewMode': 'Desktop',
    'prototypeEditor.noChangesToSave': 'Save Changes',

    // Code Diff Modal
    'codeDiff.title': 'Code Comparison',
    'codeDiff.lastSaved': 'Last Saved',
    'codeDiff.currentChanges': 'Current Changes',
    'codeDiff.noSavedVersion': 'No saved version found',
    'codeDiff.loadingHistory': 'Loading version history...',
    'codeDiff.errorLoadingHistory': 'Failed to load version history',
    'codeDiff.modified': 'Modified',
    'codeDiff.unchanged': 'Unchanged',
    'codeDiff.viewChanges': 'View Diff',
    'codeDiff.modifiedFiles': 'Modified Files',
    'codeDiff.allFiles': 'All Files',
    'codeDiff.noModifications': 'No modifications',
    'codeDiff.selectFile': 'Select a file to view changes',
    'codeDiff.comparisonMode': 'Comparison Mode',
    'codeDiff.currentVsSaved': 'Current Editor vs Saved Version',
    'codeDiff.historyComparison': 'V{version} vs V{prevVersion}',
    'codeDiff.selectVersion': 'Select Version to Compare',
    'codeDiff.noPreviousVersion': 'This is the first version, no previous version to compare',
    'codeDiff.version': 'Version {version}',

    // Vercel Logs Modal
    'prototype.vercelLogs.noBuildLogs': 'No build logs available',
    'prototype.vercelLogs.logsAvailableAfterDeployment':
      'Build logs will be available after deployment',
    'prototype.vercelLogs.download': 'Download',
    'prototype.vercelLogs.noLogsToDownload': 'No {type} logs to download',
    'prototype.vercelLogs.downloaded': 'Downloaded {filename}',

    // Status Values
    'status.loading': 'loading',
    'status.ready': 'ready',
    'status.error': 'error',
    'status.created': 'Created',
    'status.started': 'Started',
    'status.completed': 'Completed',
    'status.canceled': 'Canceled',
    'status.inreview': 'Code Review',
    'status.approved': 'QA',
    'status.generating': 'Generating',
    'status.overwritten': 'Overwritten',
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.notStarted': 'Not Started',
    'status.inProgress': 'In Progress',
    'status.published': 'Published',

    // Additional Messages & Alerts
    'message.buildingProjectDeploy': 'Building project...',
    'message.deploymentCompletedSuccess': 'Deployment completed successfully!',
    'message.documentIdRequiredSaving': 'Document ID is required for saving',
    'message.failedToSaveFileEditor': 'Failed to save file',
    'message.failedToLoadCommunityProjects':
      'Failed to load community projects',
    'message.projectLimitReached':
      "You've reached the project limit. Please {upgradeLink}",
    'message.upgradePlan': 'upgrade your plan',

    // Backend Status Messages (for frontend translation)
    'deploying.app': 'Deploying app...',
    'polishing.app': 'Polishing app...',
    'deploying.document.prototype': 'Deploying prototype...',
    'deploying.document.product': 'Deploying product...',
    'Deployment complete': 'Deployment complete',
    'Deployment failed. Please check the logs and try again.':
      'Deployment failed. Please check the logs and try again.',
    'Build error. Please retry.': 'Build error. Please retry.',

    // AI Agent Intro Messages
    'aiAgent.prd':
      "👋 I'm Joy, your AI assistant. To start, you may pick a sample prompt, upload local files, or link other documents to create a PRD below.",
    'aiAgent.prototype':
      "👋 I'm Joy, your AI assistant. To start, you may pick a sample prompt, link other PRDs or chat with me below to create a prototype.",
    'aiAgent.uiDesign':
      "👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.",
    'aiAgent.techDesign':
      "👋 I'm Joy, your AI assistant. I can help you craft technical design for your product.",
    'aiAgent.developmentPlan':
      "👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.",
    'aiAgent.qaPlan':
      "👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.",
    'aiAgent.releasePlan':
      "👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.",
    'aiAgent.business':
      "👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.",
    'aiAgent.product':
      "👋 I'm Joy, your AI assistant. I can help you create a full-stack product. You can start chatting with me in the chatbox below.",
    'aiAgent.engineering':
      "👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.",
    'aiAgent.marketing':
      "👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.",
    'aiAgent.sales':
      "👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.",
    'aiAgent.support':
      "👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions or create documents of your need.",
    'aiAgent.chat':
      "👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions or discuss anything of your interest.",

    // AI Agent Sample Prompts
    'samplePrompts.prd.buildWebApp': 'Build a web app that...',
    'samplePrompts.prd.addFeature': 'Add a feature that...',
    'samplePrompts.prototype.buildWebApp': 'Build a web app that...',
    'samplePrompts.prototype.addFeature': 'Add a feature that...',
    'samplePrompts.uiDesign.createWireframe':
      'We want to support all key feature requirements defined in the selected Omniflow PRD document. Please create a UI design wireframe for it.',
    'samplePrompts.techDesign.createTechnicalDesign':
      'We want to support all key feature requirements defined in the selected Omniflow PRD document. Please use microservices architecture, and modern stack such as ReactJS, NodeJS, and LLM models. Please help us write a technical design.',
    'samplePrompts.qaPlan.createTestPlan':
      'Please create a QA test plan for the selected product requirement document.',
    'samplePrompts.releasePlan.createReleasePlan':
      'Please create a release plan based on the selected product requirement document.',
    'samplePrompts.chat.buildAIApp':
      'I would like to build a new AI app to automate my product development life cycle. Can you share some tips on it?',
    'samplePrompts.chat.soc2Compliance':
      'I want to start a project to achieve SOC 2 Compliance for our product. How can I go about doing that?',

    // MyIssues Sections
    'myIssues.recentApps': 'Recent Apps',
    'myIssues.recentPrds': 'Recent PRDs',
    'myIssues.plannedSchedule': 'Planned Schedule',
    'myIssues.projectOrWorkPlanName': 'Project or work plan name',

    // Issue Types
    'issueType.buildable': 'Buildable',
    'issueType.epic': 'Epic',
    'issueType.story': 'Story',
    'issueType.task': 'Task',
    'issueType.subtask': 'Subtask',
    'issueType.bug': 'Bug',

    // Issue Status
    'issueStatus.created': 'Created',
    'issueStatus.started': 'Started',
    'issueStatus.generating': 'Generating',
    'issueStatus.inreview': 'In Review',
    'issueStatus.approved': 'Approved',
    'issueStatus.completed': 'Completed',
    'issueStatus.canceled': 'Canceled',
    'issueStatus.overwritten': 'Overwritten',

    // Common Components
    'common.uiPreview': 'UI Preview',
    'common.viewCode': 'View code',
    'common.previewApp': 'Preview app',
    'common.upgradePlanToViewCode': 'Upgrade your plan to view code',
    'common.uiEditor':
      'UI Editor (You may enter Design URL, or update html code to update UI preview)',
    'common.uploadImage': 'Upload Image',
    'common.preview': 'Preview',
    'common.owner': 'Owner',
    'common.progress': 'Progress',
    'common.templateInUse': 'Template In use: {name}',
    'common.pickTemplate': 'Pick a Template',
    'common.createRequirementSpec': 'Create requirement spec',
    'common.generatePrototype': 'Generate prototype',
    'common.buildFinalProduct': 'Build final product',
    'common.wait': 'wait',
    'common.process': 'process',
    'common.finish': 'finish',
    'common.productRequirement':
      'Product Requirement, Tech Design, Test/Release Plan',
    'common.prd': 'PRD',
    'common.prototype': 'Prototype',
    'common.prototypeDesc': 'Prototype, UI/UX Design',
    'common.product': 'Product',
    'common.productDesc': 'Full-stack Product, Deployment',
    'common.upgradeToPerformance': 'Upgrade to Performance plan for access',
    'common.upgradeToBusiness': 'Upgrade to Business plan for access',
    'common.aiGenerating': 'AI is generating a response...',
    'common.errorOccurred': 'Error occurred. Please try again.',
    'common.makeShorter': 'Make this shorter',
    'common.makeLonger': 'Make this longer',
    'common.simplify': 'Simplify this',
    'common.expand': 'Expand on this',
    'common.changeTone': 'Change the tone',
    'common.completeSentence': 'Complete sentence',
    'common.inviteUser': 'Invite User',
    'common.addVirtualTeammate': 'Add Virtual Teammate',
    'common.maxTeamCountReached':
      'Max team count reached. Please upgrade your plan.',
    'common.normalText': 'Normal text',
    'common.heading': 'Heading',
    'common.heading1': 'Heading 1',
    'common.heading2': 'Heading 2',
    'common.heading3': 'Heading 3',
    'common.prdGenerated':
      'Your PRD has been generated. You may continue to edit it below.',
    'common.docGenerated':
      'Your document has been generated. You may continue to edit it below.',
    'common.noContentAvailable': 'No content available',
    'common.selectOwner': 'Select an owner',
    'common.errorLoadingProfile': 'Error loading user profile: {error}',
    'common.notStarted': 'Not Started',
    'common.inProgress': 'In Progress',
    'common.published': 'Published',

    // Project Status
    'projectStatus.notStarted': 'Not Started',
    'projectStatus.inProgress': 'In Progress',
    'projectStatus.published': 'Published',

    // App Utilities
    'app.monthlyCreditsUsedUp':
      'You have used up your monthly credits. You may buy more credits, upgrade your account or Share & Earn.',
    'app.outOfCredits':
      'You are currently out of credits. You may buy more credits, upgrade your account or Share & Earn.',
    'app.databaseUrlRequired': 'Please fill in Database URL and JWT Secret.',
    'app.sampleTask':
      "Implement a feature to allow users to update their profile, like the page you are seeing.\n\nDescription: 1) Add a UI form to display user's current profile with firstname, lastname, username. 2) Build backend logic to save the updated info. 3) Redirect the page to home page when done.\nAcceptance Criteria: 1) Users can see their current profile information. 2) Users can successfully update their name, and username. 3) Changes are saved to the database.",
    'app.viewOnlyMode': 'You are currently in View Only mode',

    // Chat Components
    'chat.addNameRequired': 'Please add a name for this idea',
    'chat.enterNamePlaceholder': 'Enter a name for this idea',
    'chat.selectAccessRequired': 'Please select who can access this idea',
    'chat.save': 'Save',
    'chat.uploadFileTypeError': 'Please upload image, word, txt or pdf files.',
    'chat.contentEmpty': 'Chat content cannot be empty',
    'chat.loadingHistoryError': 'Loading chat history, please try again later.',
    'chat.samplePrompt': 'Sample Prompt',
    'chat.uploadFile': 'Add file/feature',
    'chat.uploadFileAction': 'Upload file',
    'chat.inputPlaceholder':
      'Please enter your questions or instructions. You may also upload or tag documents to provide additional context.',
    'chat.uploading': 'Uploading...',
    'chat.currentIdeas': 'Current Ideas',
    'chat.noIdeasAvailable': 'No Ideas available',
    'chat.newIdea': 'New Idea',
    'chat.deleteConfirm': 'Are you sure you want to delete this chat?',
    'chat.delete': 'Delete',

    // DevPlan Components
    'devplan.addNewDocument': 'Add new document',
    'devplan.selectDocumentOrAdd': 'Please select document or add new ones',
    'devplan.prefixNameWithTaskType':
      'please prefix the name with task type, for example "[Frontend]"',
    'devplan.pointsRequired': 'Points are required',
    'devplan.descriptionsRequired': 'descriptions are required',
    'devplan.taskDescriptionPlaceholder': 'Task description',
    'devplan.deleteConfirm': 'Are you sure you want to delete this {type}?',
    'devplan.addNewRole': 'Add New Role',
    'devplan.roles': 'Roles',
    'devplan.addRolesNeeded': 'Add the roles needed for the work',
    'devplan.inviteUser': 'Invite User',
    'devplan.maxTeamCountReached':
      'Max team count reached. Please upgrade your plan.',
    'devplan.addVirtualTeammate': 'Add Virtual Teammate',
    'devplan.upgradeToPerformance': 'Upgrade to Performance plan for access',
    'devplan.teamMembers': 'Team members',
    'devplan.inviteTeamOrAddVirtual': 'Invite team or Add virtual teammates',
    'devplan.rolesNeeded': 'Roles Needed',
    'devplan.selectRolesNeeded': 'Please select or add roles needed',
    'devplan.addRolesTooltip':
      'Add the roles needed in your team to complete this project',
    'devplan.teamMembersLabel': 'Team members:',
    'devplan.selectTeamMembers': 'You must select team members',
    'devplan.teamTooltip':
      'You may invite your team, OR create virtual teammates by selecting from the dropdown menu',
    'devplan.teamPlaceholder':
      'Invite team or Add virtual teammates by selecting from dropdown menu',
    'devplan.startDate': 'Start Date',
    'devplan.warning': 'Warning',
    'devplan.overwriteWarning':
      'This will overwrite the current dev plan, including any current work items and status',
    'devplan.continueQuestion': 'Do you want to continue?',
    'devplan.generateTask': 'Generate Task',
    'devplan.confirmSchedule': 'Confirm Schedule',
    'devplan.reviewWork': 'Review Work',
    'devplan.publishDevPlan': 'Publish Dev Plan',
    'devplan.taskBreakdown': 'Task Breakdown',
    'devplan.workSchedule': 'Work Schedule',
    'devplan.tasksNotGenerated': 'Tasks are not generated yet',
    'devplan.addRolesFirst':
      'Please first add the Roles Needed above before creating task breakdown.',
    'devplan.publishPrdFirst':
      'Please first Publish a PRD before creating task breakdown.',
    'devplan.addTeamAndDate':
      'Please add team members and project start date above.',
    'devplan.createTaskBreakdown':
      'Please first create the Task Breakdown and review the work items',
    'devplan.newTask': 'New Task',
    'devplan.newStory': 'New Story',
    'devplan.newEpic': 'New Epic',
    'devplan.reviewWorkTitle': 'Review the work',
    'devplan.reviewWorkDescription': 'Epics, Stories, Tasks',
    'devplan.confirmScheduleTitle': 'Confirm the schedule',
    'devplan.confirmScheduleDescription': 'Milestones, Sprints',
    'devplan.publishTitle': 'Dev Plan Publish',
    'devplan.publishMessage':
      'We currently only support Dev Plan Publish inside a project. Please first Add A Project before publishing dev plan.',
    'devplan.addProject': 'Add A Project',

    // Document Components
    'document.save': 'Save',
    'document.selectAccessRequired': 'Please select who can access the project',
    'document.chooseDocumentType': 'Please choose a document type',
    'document.enterDocumentName': 'Enter document name',
    'document.addDocumentNameRequired': 'Please add a document name',
    'document.name': 'Name',
    'document.type': 'Type:',
    'document.currentApps': 'Current Apps',
    'document.noAppsAvailable': 'No apps available',
    'document.newApp': 'New App',
    'document.domain': 'Domain',
    'document.auth': 'Auth',
    'document.uploading': 'Uploading...',
    'document.uploadFile': 'Add file/feature',
    'document.pickSamplePrompt': 'Pick sample prompt',
    'document.createPrototype': 'Create a prototype based on your requirement',
    'document.createProduct':
      'Create the product with full frontend, backend, database',
    'document.generationInProgress':
      'Document generation is in progress. Please try again later.',
    'document.waitForChatHistory': 'Please wait for chat history to load...',
    'document.loadingChatHistoryError':
      'Loading chat history, please try again later.',
    'document.chatContentEmpty': 'Chat content can not empty!',
    'document.failedToUploadLogo':
      'Failed to upload logo, please try again later.',
    'document.logoVerbs':
      'use,change,apply,update,replace,modify,switch,swap,redesign,使用,更改,应用,用,更新,替换,修改,切换,交换,重新设计',
    'document.thinking': 'Thinking...',
    'document.clearChat': 'Clear',
    'document.chatCleared': 'Chat cleared.',
    'document.chatClearFailed': 'Failed to reset chat. Please try again.',

    // Document Components Extended
    'document.copy': 'Copy',
    'document.edit': 'Edit',
    'document.generateDoc': 'Generate Doc',
    'document.noDocumentFound': 'no document found',
    'document.documents': 'Documents',
    'document.searchByFileName': 'Search by file name',
    'document.linkDocument': 'Link document',
    'document.publishedSuccessfully': '"{name}" published successfully.',
    'document.saveFirst': 'Please save the document first',
    'document.requestSentSuccessfully': 'Request sent successfully',
    'document.failedToCompleteAI':
      'Failed to complete the AI response. Please try again.',
    'document.sendMessage': 'Send a message',
    'document.addFeedbackOrQuestion':
      'Add your feedback or ask a question to Joy',
    'document.enterInstructions':
      'Please enter your instructions. You may also upload documents to provide additional context.',
    'document.fullScreen': 'Full screen',
    'document.chatWithJoyToCreate':
      'Chat with Joy at the left-side chatbox to create your',
    'document.orClickToEdit':
      'or click here to directly edit, copy/paste content',
    'document.versionNotFound':
      'Version {versionNumber} not found in document history.',
    'document.errorFetchingHistory': 'Error fetching history versions.',
    'document.viewDocumentHistory': 'View history',
    'document.hideSidepanel': 'Hide chat',
    'document.showSidepanel': 'Show chat',
    'document.documentHistory': 'Document History',
    'document.upgradePlanForFullHistory': 'Upgrade plan for full history',
    'document.upgradePlanForFullVersionHistory':
      'Upgrade plan for full version history',
    'document.currentRequirements': 'Current Requirements',
    'document.noDocumentsAvailable': 'No documents available',
    'document.owner': 'Owner',
    'document.access': 'Access',
    'document.createdAt': 'Created At',
    'document.action': 'Action',
    'document.enterYourEmail': 'Enter your email',
    'document.invalidEmailAddress': 'Invalid email address',
    'document.pleaseInputEmail': 'Please input your email.',
    'document.enterEmailToContinue': 'Enter Email to continue',
    'document.noPreviewAvailable': 'No preview available',
    'document.appNotDeployed': 'App has not been deployed yet',
    'document.devPlanNotExist':
      'A development plan for this project does not exist. Please create one first.',
    'document.failedToPrepareDevPlan':
      'Failed to prepare for development plan generation.',
    'document.failedToParseContents': 'Failed to parse document contents.',
    'document.noFilesToPublish': 'No files to publish.',
    'document.rateLatestGeneration': 'Rate latest generation:',
    'document.veryPoor': 'Very poor',
    'document.needsImprovement': 'Needs improvement',
    'document.acceptable': 'Acceptable',
    'document.good': 'Good',
    'document.excellent': 'Excellent',
    'document.thankYouForFeedback': 'Thank you for your feedback!',
    'document.submit': 'Submit',
    'document.selectRolesPlaceholder': 'Select roles (e.g. Frontend, Backend)',
    'document.selectTeamRolesLabel':
      'Select team roles needed to deliver this project',
    'document.selectTeamRolesTooltip':
      'Please keep it as Fullstack Engineer if you are unsure',
    'document.makeProduct': 'Make Product',
    'document.accessDenied': 'Access Denied',
    'document.noAccessToDocument':
      "You don't have access to this document. Please request access below.",
    'document.requestAccess': 'Request Access',
    'document.messageOptional': 'message (optional)',
    'document.imageUploadWarning':
      'Image upload to S3 failed, but you can still use it for generation.',
    'document.imageUploadFailed':
      'Failed to upload image to server. Please try again.',
    'document.imageCompressionFailed':
      'Failed to process image. Please try again.',
    'document.filesStillUploading':
      'Please wait for all files to finish uploading',
    'document.fileTooLarge': 'File size exceeds 10MB limit.',
    'document.unsupportedImageType': 'Unsupported image type.',
    'document.invalidFileType': 'Invalid file type.',
    'document.uploadError': 'File upload failed.',
    // Document Types
    'document.label': 'Document',
    'document.prd': 'PRD',
    'document.prdSubtitle': 'Collect, analyze product requirement',
    'document.uiDesign': 'UI/UX Design',
    'document.uiDesignSubtitle': 'Create UIUX Design with HTML/CSS',
    'document.prototype': 'Prototype',
    'document.designPrototype': 'Design Prototype',
    'document.product': 'Product',
    'document.prototypeSubtitle': 'Generate fully functional prototypes',
    'document.techDesign': 'Technical Design',
    'document.techDesignSubtitle': 'Create the technical architecture',
    'document.developmentPlan': 'Development Plan',
    'document.developmentPlanSubtitle':
      'Build execution plan for productization',
    'document.qaPlan': 'QA & Test Plan',
    'document.qaPlanSubtitle': 'Automate QA test cases and plan',
    'document.releasePlan': 'Release Plan',
    'document.releasePlanSubtitle': 'Create release process and plan',
    'document.marketing': 'Marketing',

    // Home Components
    'home.createDocument': 'Create a document',
    'home.newDocumentName': 'New document name',
    'home.documentType': 'Document type',
    'home.cancel': 'Cancel',
    'home.go': 'Go',
    'home.generateDocsDescription':
      'Generate PRDs, design docs, engineering diagrams etc.',
    'home.generateDevTasks': 'Generate dev tasks',
    'home.enterDevPlanName': 'Enter dev plan name',
    'home.generateDevTasksDescription':
      'Break down technical tasks, estimate and schedule dev plan.',
    'home.whatToBuildToday': 'What do you want Omniflow to build today?',
    'home.buildMobileApp': 'Build a mobile app with Expo',
    'home.startBlog': 'Start a blog with Astro',
    'home.scaffoldUI': 'Scaffold UI with shadcn',
    'home.craftRequirement': 'Craft Requirement',
    'home.enterRequirementName': 'Enter a name for the requirement doc',
    'home.craftRequirementDescription':
      'Turn ideas into high quality product requirement documents instantly',
    'home.buildProject': 'Build Project',
    'home.failedToReadFile': 'Failed to read uploaded file.',
    'home.createApp': 'Create an app',
    'home.enterAppName': 'Enter app name',
    'home.createAppDescription':
      'Transform requirements to simple apps such as websites, games or prototypes in minutes.',
    'home.createTechDesign': 'Create Tech Design',
    'home.createTechDesignDescription':
      'Create a tech architectural, engineering design.',
    'home.failedToLoadCommunityProjects': 'Failed to load community projects',
    'home.projectIdNotAvailable': 'Project ID not available for cloning',
    'home.projectClonedSuccessfully':
      'Project "{name}" has been cloned successfully as "{clonedName}"',
    'home.failedToCloneProject': 'Failed to clone project. Please try again.',
    'home.by': 'by',

    // Community Filter Labels
    'community.all': 'All',
    'community.aiNative': 'AI Native',
    'community.smbPortal': 'SMB Portal',
    'community.saas': 'SaaS',
    'community.internalTool': 'Internal Tool',

    // Layout
    'layout.lowCredits': "You're low in credits.",
    'layout.editProject': 'Edit Project',
    'layout.cloneProject': 'Clone Project',
    'layout.deleteProject': 'Delete Project',
    'layout.cloneProjectConfirm':
      'Are you sure you want to clone "{projectName}"? This will create a new project with the same data.',
    'layout.loading': 'Loading',
    'layout.pleaseWait': 'Please wait a moment...',
    'layout.maxSeatsReached':
      'You have reached the maximum number of seats. Please',
    'layout.upgradeAccount': 'upgrade your account',
    'layout.toAddMoreSeats': 'to add more seats.',
    'layout.noDocumentsAvailable': 'No documents available',

    // Organization
    'organization.unauthorized': 'Unauthorized',
    'organization.notAuthorized': 'You are not authorized to view this page.',
    'organization.jiraIntegration': 'JIRA Integration',
    'organization.accountAuthorization': 'Account Authorization:',
    'organization.connectWithJira': 'Connect with JIRA',
    'organization.jiraConnected': 'JIRA connected',
    'organization.jiraUserProfile': 'Jira User Profile:',
    'organization.jiraResources': 'Jira Resources:',
    'organization.accessToken': 'Access Token:',
    'organization.connectingToBitbucket': 'Connecting to Bitbucket...',
    'organization.disconnectGitHub': 'Disconnect GitHub',
    'organization.connectWithGitHub': 'Connect with GitHub',
    'organization.connectWithBitbucket': 'Connect with Bitbucket',
    'organization.disconnectBitbucket': 'Disconnect Bitbucket',
    'organization.linkJiraTooltip': 'Link your JIRA account to your profile.',
    'organization.name': 'Name',
    'organization.url': 'Url',
    'organization.noProjectsAvailable': 'No projects available',
    'organization.newProject': 'New project',
    'organization.cardView': 'Card View',
    'organization.listView': 'List View',
    'organization.searchProjects': 'Search projects...',
    'organization.noProjectsFound': 'No projects found',

    // Document Generation
    'generation.updatingDocument': 'Updating {docType}...',
    'generation.creatingDocument': 'Creating {docType}...',
    'generation.updatingForYou': 'Updating the {docType} for you...',
    'generation.creatingForYou': 'Creating the {docType} for you...',
    'generation.stopGeneration': 'Cancel Generation',
    'generation.stopping': 'Cancelling generation...',
    'generation.cancelled': 'Generation cancelled',

    // Login
    'login.title': 'Omniflow AI',
    'login.lastUsed': 'Last used',
    'login.signInWithGoogle': 'Sign in with Google',
    'login.signInWithEmail': 'Sign in with Email',
    'login.email': 'Email',
    'login.emailPlaceholder': 'Enter your email',
    'login.password': 'Password',
    'login.passwordPlaceholder': 'Use upper, lower, and special character',
    'login.confirmPassword': 'Confirm Password',
    'login.confirmPasswordPlaceholder': 'Please confirm your password',
    'login.forgotPassword': 'Forgot your password?',
    'login.createAccount': "Don't have an account? Create your account",
    'login.signIn': 'Sign In',
    'login.signUp': 'Sign Up',
    'login.welcomeBack': 'Welcome Back',
    'login.getStarted': 'Get Started',

    // Database
    'database.title': 'Database Settings',
    'database.url': 'Database URL',
    'database.jwtSecret': 'JWT Secret',
    'database.connect': 'Connect',
    'database.disconnect': 'Disconnect',
    'database.tables': 'Tables',
    'database.selectTable': 'Select a table',
    'database.loadData': 'Load Data',
    'database.deleteSettings': 'Delete Database Settings',
    'database.deleteConfirm':
      'Are you sure you want to delete the database and clear all database information? This action cannot be undone.',
    'database.configuration': 'Database Configuration',
    'database.jwtToken': 'JWT Token',
    'database.edit': 'Edit',
    'database.delete': 'Delete',
    'database.autoCreate': 'Auto Create',
    'database.autoCreateTooltip':
      'By default we will auto-generate PostgreSQL database and provision it.',
    'database.placeholder': 'Paste your database connection string',
    'database.jwtPlaceholder': 'Paste your JWT secret here',
    'database.jwtRequired': 'JWT token is required for Supabase',
    'database.saveSettings': 'Save Settings',
    'database.cancel': 'Cancel',
    'database.columns': 'columns',
    'database.selectTableData': 'Select a table to view its data',
    'database.noTables': 'No tables available',
    'database.noTablesDesc':
      'Tables will appear here once you connect to a database with existing tables.',
    'database.totalItems': 'Total {total} items',
    'database.passwordHidden': 'Password (hidden)',
    'database.searchPlaceholder': 'Search...',
    'database.search': 'Search',
    'database.reset': 'Reset',
    'database.items': 'items',
    'database.selectTableToView':
      'Select a table from the left to view its data',
    'database.editRecord': 'Edit Record',
    'database.primaryKeyNotEditable': 'Primary key (not editable)',
    'database.noDatabaseConfigured': 'No Database Configured',
    'database.pleaseConfigure':
      'Please configure your database in the Configuration tab first.',
    'database.saveFailed': 'Failed to save database settings',
    'database.deleteSuccess': 'Settings deleted successfully',
    'database.deleteFailed': 'Failed to delete settings',
    'database.createSuccess': 'Database created successfully',
    'database.exportSelected': 'Export Selected',
    'database.exportAll': 'Export All',
    'database.noDataToExport': 'No data to export',
    'database.newRecord': 'New Record',
    'database.selectSearchFields': 'Search in fields...',
    'database.recordInserted': 'Record inserted successfully',
    'database.recordUpdated': 'Record updated successfully',
    'database.recordInsertFailed': 'Failed to insert record',
    'database.recordUpdateFailed': 'Failed to update record',
    'database.systemFieldNotEditable': 'System field (not editable)',
    'database.importCsv': 'Import CSV',
    'database.importing': 'Importing...',
    'database.importSummary': 'Import finished',
    'database.importFailed': 'Import failed',

    // Document History
    'history.title': 'Version History',
    'history.current': 'CURRENT',
    'history.preview': 'PREVIEW',
    'history.restore': 'Restore',
    'history.restoring': 'Restoring...',
    'history.loading': 'Loading...',

    // Document Settings Modal
    'settings.title': 'Settings',
    'settings.prototypeTitle': 'Prototype Settings',
    'settings.productTitle': 'Product Settings',
    'settings.database': 'Database',
    'settings.files': 'Files',
    'settings.payment': 'Payment',
    'settings.aiModel': 'AI Model',
    'settings.apiKeys': 'API Keys',
    'settings.domain': 'Domain',
    'settings.resetApp': 'Reset App',
    'settings.cancel': 'Cancel',
    'settings.saveAll': 'Save All',
    'settings.unsavedChanges':
      'You have unsaved changes. Are you sure you want to close without saving?',
    'settings.environment.preview': 'Preview',
    'settings.environment.production': 'Production',
    'settings.knowledgeBase': 'Knowledge Base',

    // Knowledge Base Tab

    'knowledgeBase.selectKnowledgeBases': 'Select Knowledge Bases',
    'knowledgeBase.weight': 'Weight',
    'knowledgeBase.testConnection': 'Test Connection',
    'knowledgeBase.connectionSuccess': 'Connection successful',
    'knowledgeBase.connectionFailed': 'Connection failed',
    'knowledgeBase.saveSuccess': 'Knowledge base settings saved successfully',
    'knowledgeBase.saveFailed': 'Failed to save knowledge base settings',
    'knowledgeBase.weightDesc':
      'Higher weight gives more priority to this knowledge base in search results (1-10)',
    'knowledgeBase.loading': 'Loading knowledge bases...',
    'knowledgeBase.setting.description':
      'Select and configure knowledge bases for RAG-powered features in your application.',
    'knowledgeBase.selected': 'Selected',
    'knowledgeBase.fileCount': '{count} files',
    'knowledgeBase.lastUpdated': 'Last updated: {date}',
    'knowledgeBase.noDescription': 'No description',
    'knowledgeBase.testing': 'Testing...',
    'knowledgeBase.save': 'Save Configuration',

    // Files Tab
    'files.upload': 'Click or drag files to this area to upload',
    'files.listView': 'List',
    'files.gridView': 'Grid',
    'files.copyLink': 'Copy Link',
    'files.linkCopied': 'Link copied',
    'files.delete': 'Delete',
    'files.deleteConfirm': 'Are you sure you want to delete this file?',
    'files.quota': 'Storage',
    'files.overQuota': 'Upload exceeds storage quota (1GB per project)',
    'files.empty': 'No files yet',
    'files.preview': 'Preview',
    'files.loadFailed': 'Failed to load files',
    'files.loadQuotaFailed': 'Failed to load quota',
    'files.uploadSuccess': 'Uploaded successfully',
    'files.uploadFailed': 'Upload failed',
    'files.deleteSuccess': 'Deleted successfully',
    'files.deleteFailed': 'Delete failed',
    'files.name': 'Name',
    'files.size': 'Size',
    'files.updatedAt': 'Updated At',
    'files.actions': 'Actions',

    // Common
    'common.loadMore': 'Load more',

    // Stripe Tab
    'stripe.configuration': 'Stripe Configuration',
    'stripe.readOnlyDesc':
      'Stripe payment integration settings (read-only view).',
    'stripe.secretKey': 'Stripe Secret Key:',
    'stripe.secretKeyDesc':
      'Your Stripe secret key for server-side operations.',
    'stripe.publishedKey': 'Stripe Published Key:',
    'stripe.publishedKeyDesc':
      'Your Stripe published key for client-side operations.',
    'stripe.noPermission':
      "You don't have permission to modify these settings.",
    'stripe.settingsDesc': 'Your Stripe payment integration settings.',
    'stripe.settingsUpdated': 'Settings Updated',
    'stripe.settingsUpdatedDesc':
      'After changing your Stripe settings, please update the prefilled message in the chat box and send it to Joy to update your product with the new payment configuration.',
    'stripe.configureDesc':
      'Configure your Stripe payment integration by entering your API keys below.',
    'stripe.secretKeyPlaceholder': 'Enter your Stripe secret key (sk_...)',
    'stripe.secretKeyHelp':
      'Your Stripe secret key for server-side operations. Keep this secure.',
    'stripe.publishedKeyPlaceholder':
      'Enter your Stripe published key (pk_...)',
    'stripe.publishedKeyHelp':
      'Your Stripe published key for client-side operations.',
    'stripe.saving': 'Saving...',
    'stripe.configuring': 'Configuring...',
    'stripe.saveKeys': 'Save Stripe Keys',
    'stripe.unsavedChanges': '⚠️ You have unsaved changes',
    'stripe.products': 'Products',
    'stripe.productsDesc':
      'Select the products you want to display in your application.',
    'stripe.apiKeyRequired': 'Stripe API Key Required',
    'stripe.configureKeyFirst':
      'Please configure your Stripe Secret Key in the Configuration tab first.',
    'stripe.fetchProductsFailed': 'Failed to fetch Stripe products',
    'stripe.selectAtLeastOne': 'Please select at least one product',
    'stripe.updateProductsFailed': 'Failed to update products',
    'stripe.productsUpdated':
      'Products updated successfully. Please also tell Joy to integrate Stripe and trigger a redeployment.',
    'stripe.columnSelect': 'Select',
    'stripe.columnProductName': 'Product Name',
    'stripe.columnPrice': 'Price',
    'stripe.columnType': 'Type',
    'stripe.columnDescription': 'Description',
    'stripe.typeSubscription': 'Subscription',
    'stripe.typeOneTime': 'One-time',
    'stripe.saveSelectedProducts': 'Save Selected Products',
    'stripe.saveSelectedProductsCount': 'Save Selected Products ({count})',
    'stripe.fetchProducts': 'Fetch Products from Stripe',
    'stripe.loadingProducts': 'Loading Products...',
    'stripe.noProductsFound': 'No Products Found',
    'stripe.noProductsDesc':
      "Click 'Fetch Products from Stripe' to load your Stripe products.",

    // Email Configuration Tab
    'email.configuration': 'Email Configuration',
    'email.configDesc':
      'Configure a single email provider for your app. Environment variables will be saved to document settings and synced to Vercel.',
    'email.onlyOneProvider': 'Only one provider can be active at a time.',
    'email.provider': 'Provider',
    'email.selectProvider': 'Please select a provider',
    'email.fromEmail': 'From Email',
    'email.fromEmailRequired': 'EMAIL_FROM is required',
    'email.invalidEmail': 'Invalid email',
    'email.fromEmailPlaceholder': 'no-reply@example.com',
    'email.adminEmail': 'Admin Email',
    'email.adminEmailPlaceholder': 'admin@example.com',
    'email.saveSettings': 'Save Settings',
    'email.settingsSaved': 'Email settings saved',
    'email.settingsFailed': 'Failed to save email settings',
    'email.documentIdRequired': 'Document ID is required',
    // SMTP
    'email.smtpHost': 'SMTP Host',
    'email.smtpHostRequired': 'EMAIL_HOST is required',
    'email.smtpHostPlaceholder': 'smtp.example.com',
    'email.smtpPort': 'SMTP Port',
    'email.smtpPortRequired': 'EMAIL_PORT is required',
    'email.smtpPortPlaceholder': '465',
    'email.useTlsSsl': 'Use TLS/SSL',
    'email.smtpUser': 'SMTP User',
    'email.smtpUserRequired': 'EMAIL_USER is required',
    'email.smtpUserPlaceholder': 'user@example.com',
    'email.smtpPassword': 'SMTP Password',
    'email.smtpPasswordRequired': 'EMAIL_PASSWORD is required',
    'email.smtpPasswordPlaceholder': '••••••••',
    // SendGrid
    'email.sendgridApiKey': 'SendGrid API Key',
    'email.sendgridApiKeyRequired': 'SENDGRID_API_KEY is required',
    'email.sendgridApiKeyPlaceholder': 'SG.xxxxx',
    // Mailgun
    'email.mailgunApiKey': 'Mailgun API Key',
    'email.mailgunApiKeyRequired': 'MAILGUN_API_KEY is required',
    'email.mailgunApiKeyPlaceholder': 'key-xxxxx',
    'email.mailgunDomain': 'Mailgun Domain',
    'email.mailgunDomainRequired': 'MAILGUN_DOMAIN is required',
    'email.mailgunDomainPlaceholder': 'mg.example.com',
    // Resend
    'email.resendApiKey': 'Resend API Key',
    'email.resendApiKeyRequired': 'RESEND_API_KEY is required',
    'email.resendApiKeyPlaceholder': 're_xxxxx',
    // AWS SES
    'email.awsRegion': 'AWS Region',
    'email.awsRegionRequired': 'AWS_REGION is required',
    'email.awsRegionPlaceholder': 'us-east-1',
    'email.awsAccessKeyId': 'AWS Access Key Id',
    'email.awsAccessKeyIdRequired': 'AWS_ACCESS_KEY_ID is required',
    'email.awsSecretAccessKey': 'AWS Secret Access Key',
    'email.awsSecretAccessKeyRequired': 'AWS_SECRET_ACCESS_KEY is required',

    // API Keys Tab
    'apiKeys.settings': 'API Key Settings',
    'apiKeys.configDesc': 'Your API keys and LLM model configuration.',
    'apiKeys.manageDesc': 'Manage your API keys for external services.',
    'apiKeys.llmModelConfig': 'LLM Model Configuration',
    'apiKeys.llmModelName': 'LLM Model Name:',
    'apiKeys.omniflowApiKey': 'Omniflow API Key:',
    'apiKeys.apiKeyPlaceholder': 'Enter your Omniflow API key',
    'apiKeys.notConfigured': 'Not configured',
    'apiKeys.apiKeys': 'API Keys ({count})',
    'apiKeys.edit': 'Edit',
    'apiKeys.apiKeyName': 'API Key Name',
    'apiKeys.apiKey': 'API Key',
    'apiKeys.actions': 'Actions',
    'apiKeys.deleteConfirm': 'Are you sure you want to delete this API key?',
    'apiKeys.yes': 'Yes',
    'apiKeys.no': 'No',
    'apiKeys.addApiKey': 'Add API Key',
    'apiKeys.noKeys': 'No API keys configured.',
    'apiKeys.noKeysDesc':
      'No API keys configured. Click "Add API Key" to get started.',
    'apiKeys.saveAllChanges': 'Save All Changes',
    'apiKeys.fillAll': 'Please fill in all API key names and values',
    'apiKeys.duplicateRemoved': 'Duplicate API key names were removed',
    'apiKeys.documentIdRequired': 'Document ID is required to save settings',
    'apiKeys.saveSuccess': 'API keys saved successfully',
    'apiKeys.saveFailed': 'Failed to save API keys',
    'apiKeys.placeholder': 'e.g., OPENAI_API_KEY',
    'apiKeys.keyPlaceholder': 'Enter your API key',
    'apiKeys.modelPlaceholder': 'e.g., gpt-4o-mini, gpt-4, claude-3-sonnet',
    'apiKeys.changeWarningTitle': 'Warning: API Key Change',
    'apiKeys.changeWarningContent':
      'Please redeploy your app after switching the LLM model. Note:Changing your Omniflow API Key may affect your projects using this API key. You will need to re-deploy those projects to update the API key.',
    'apiKeys.redeploymentTitle': 'Redeploy Application',
    'apiKeys.redeploymentContent':
      'The changes have been saved. You need to re-deploy the app to apply these changes. Proceed?',
    'apiKeys.redeploying': 'Redeploying application...',
    'apiKeys.redeploymentSuccess': 'Application redeployed successfully',
    'apiKeys.redeploymentFailed': 'Redeployment failed',
    'apiKeys.redeploymentSkipped':
      'Redeployment skipped - no project files found',
    'sync.deployingUpdatedCode': 'Deploying updated code...',
    'sync.deploymentSuccessful': 'Deployment successful',
    'sync.deploymentFailed': 'Deployment failed: {error}',
    'common.ok': 'OK',
    'common.more': 'More...',
    'common.description': 'Description',

    // Connectors Tab
    'connectors.title': 'Connectors',
    'connectors.description':
      'Connect third-party services, custom APIs, and MCP servers',
    'connectors.apps': 'Apps',
    'connectors.customApi': 'Custom API',
    'connectors.customMcp': 'Custom MCP',
    'connectors.noConnectors': 'No connectors configured yet',
    'connectors.addConnector': 'Add Connector',
    'connectors.connected': 'Connected',
    'connectors.notConnected': 'Not Connected',
    'connectors.connect': 'Connect',
    'connectors.disconnect': 'Disconnect',
    'connectors.testConnection': 'Test Connection',
    'connectors.edit': 'Edit',
    'connectors.delete': 'Delete',
    'connectors.deleteConfirm':
      'Are you sure you want to delete this connector?',
    'connectors.saveSuccess': 'Connector saved successfully',
    'connectors.saveFailed': 'Failed to save connector',
    'connectors.deleteSuccess': 'Connector deleted successfully',
    'connectors.deleteFailed': 'Failed to delete connector',
    'connectors.testSuccess': 'Connection test successful',
    'connectors.testFailed': 'Connection test failed',

    // App Connectors
    'connectors.apps.title': 'OAuth Apps',
    'connectors.apps.description':
      'Connect OAuth-based third-party applications',
    'connectors.apps.gmail': 'Gmail',
    'connectors.apps.googleCalendar': 'Google Calendar',
    'connectors.apps.notion': 'Notion',
    'connectors.apps.github': 'GitHub',
    'connectors.apps.slack': 'Slack',
    'connectors.apps.outlook': 'Outlook Mail',
    'connectors.apps.asana': 'Asana',
    'connectors.apps.linear': 'Linear',
    'connectors.apps.clickup': 'ClickUp',
    'connectors.apps.connecting': 'Connecting...',
    'connectors.apps.oauthSuccess': 'OAuth connection successful',
    'connectors.apps.oauthFailed': 'OAuth connection failed',

    // Custom API Connectors
    'connectors.customApi.title': 'Custom API',
    'connectors.customApi.description':
      'Add custom API with environment variables',
    'connectors.customApi.addNew': 'Add Custom API',
    'connectors.customApi.name': 'Name',
    'connectors.customApi.namePlaceholder': 'My API Service',
    'connectors.customApi.descriptionPlaceholder':
      'Provide API docs or instructions to tell Omniflow how and when to use this API',
    'connectors.customApi.iconUrl': 'Icon URL (Optional)',
    'connectors.customApi.iconUrlPlaceholder': 'https://example.com/icon.png',
    'connectors.customApi.docsUrl': 'Documentation URL (Optional)',
    'connectors.customApi.docsUrlPlaceholder': 'https://api.example.com/docs',
    'connectors.customApi.envVars': 'Environment Variables',
    'connectors.customApi.envVarKey': 'Variable Name',
    'connectors.customApi.envVarValue': 'Value',
    'connectors.customApi.addEnvVar': 'Add Variable',
    'connectors.customApi.notes': 'Notes (Optional)',
    'connectors.customApi.notesPlaceholder':
      'Additional information for the LLM',
    'connectors.customApi.envVarsTooltip':
      'Environment variables set here will be synced to your deployment. Variable names cannot conflict with system reserved names (DATABASE_URL, JWT_SECRET, etc.).',
    'connectors.customApi.envVarRequired':
      'Please add at least one environment variable with both key and value',
    'connectors.customApi.configured': 'Configured',
    'connectors.customApi.notConfigured': 'Not Configured',
    'connectors.customApi.search': 'Search custom API',
    'connectors.customApi.connectInfo':
      'Connect Omniflow programmatically to any third-party service using your own API keys.',
    'connectors.customApi.addNewDescription':
      'Create a custom API connector with your own configuration',
    'connectors.customApi.secretNamePattern':
      'Only uppercase letters and underscores are allowed',
    'connectors.customApi.reservedName':
      'This variable name is reserved by the system. Please use a different name.',

    // MCP Connectors
    'connectors.mcp.title': 'MCP Server',
    'connectors.mcp.description':
      'Configure Model Context Protocol servers (HTTP only)',
    'connectors.mcp.addNew': 'Add MCP Server',
    'connectors.mcp.batchImport': 'Batch Import',
    'connectors.mcp.exportConfig': 'Export Configuration',
    'connectors.mcp.import': 'Import',
    'connectors.mcp.jsonFormatHelp':
      'Standard MCP configuration format - HTTP transport only (supports multiple servers):',
    'connectors.mcp.serverName': 'Server Name',
    'connectors.mcp.serverNamePlaceholder': 'My MCP Server',
    'connectors.mcp.serverUrl': 'Server URL',
    'connectors.mcp.serverUrlPlaceholder': 'https://mcp.example.com/mcp',
    'connectors.mcp.serverUrlHelp':
      'MCP server must support JSON-RPC 2.0 over HTTP (STDIO transport is not supported)',
    'connectors.mcp.customHeaders': 'Custom Headers (Optional)',
    'connectors.mcp.headerName': 'Header Name',
    'connectors.mcp.headerValue': 'Header Value',
    'connectors.mcp.addHeader': 'Add Header',
    'connectors.mcp.notes': 'Notes (Optional)',
    'connectors.mcp.notesPlaceholder': 'Additional configuration notes',
    'connectors.mcp.importJson': 'Import by JSON',
    'connectors.mcp.directConfig': 'Direct Configuration',
    'connectors.mcp.jsonConfig': 'JSON Configuration',
    'connectors.mcp.jsonPlaceholder':
      'Paste MCP configuration JSON (HTTP servers only)',
    'connectors.mcp.duplicateName':
      'An MCP server with this name already exists',

    // Reset Tab
    'reset.title': 'Reset App',
    'reset.warning': 'Warning',
    'reset.warningDesc':
      'This action will permanently clear all content from this app and cannot be undone. The app will be reset to an empty state.',
    'reset.whatWillHappen': 'What will happen:',
    'reset.resetProduct': 'The product and generated code will be reset',
    'reset.removeChat': 'Chat history will be removed',
    'reset.keepHistory': 'Previous generated history will be still available',
    'reset.resetting': 'Resetting...',
    'reset.resetApp': 'Reset App',
    'reset.confirmDesc':
      'Click the button above to reset this app. This action cannot be undone.',

    // Domain Management
    'domain.manageDesc': 'Manage the domains connected to your project.',
    'domain.addDomain': 'Add Domain',
    'domain.enterDomain': 'Enter your domain (e.g., example.com)',
    'domain.pleaseEnterDomain': 'Please enter a domain',
    'domain.validDomain': 'Please enter a valid domain',
    'domain.loadingDomains': 'Loading domains...',
    'domain.redirectsTo': 'redirects to',
    'domain.refresh': 'Refresh',
    'domain.remove': 'Remove',
    'domain.verifyOwnership':
      'First, verify domain ownership by adding this DNS record to your DNS provider:',
    'domain.setupDns':
      'Now that ownership is verified, set up this DNS record to configure your domain:',
    'domain.type': 'Type',
    'domain.name': 'Name',
    'domain.value': 'Value',
    'domain.verificationComplete':
      'Once the verification is completed and the domain is successfully configured, the TXT record can be removed.',
    'domain.dnsPropagate':
      'Depending on your provider, it might take some time for the DNS records to propagate globally.',
    // Common Messages
    'message.databaseSaved': 'Database settings saved successfully!',
    'message.databaseSaveFailed': 'Failed to save database settings',
    'message.databaseLoadFailed': 'Failed to load database settings:',
    'message.databaseUrlRequired': 'Please enter the database URL',
    'message.databaseConfigureFirst':
      'Please configure database settings first',
    'message.noTablesFound': 'No tables found in the database',
    'message.documentIdRequired': 'Document ID is required to save settings',
    'message.organizationIdRequired':
      'Organization ID is required to save settings',
    'message.stripeSaveFailed': 'Failed to save Stripe settings',
    'message.stripeSaveSuccess': 'Stripe settings saved successfully',
    'message.stripeError': 'An error occurred while saving Stripe settings',
    'message.generateFirst': 'Please generate your first product.',
    'message.productionNotDeployed':
      'Production environment has not been deployed yet. Please deploy to production first.',
    'message.projectNotFound': 'project not found. Please check deployDocId.',
    'message.maxWebhooks':
      'You have reached the maximum of 16 test webhook endpoints.',
    'message.vercelUpdateFailed': 'Failed to update Vercel env vars:',
    'message.stripeKeysFailed':
      'Failed to update Stripe keys. Please verify your Stripe keys are correct or contact our support team.',
    'message.resetSuccess': '{docType} reset successful. App reloading...',
    'message.resetFailed': 'Failed to reset {docType}',
    'message.resetError': 'An error occurred while resetting the {docType}',
    'message.appIdRequired': 'App ID is required to reset {docType}',
    'message.documentInfoRequired':
      'Document information is required for Stripe configuration',
    'message.domainUpgrade': 'Upgrade plan to connect custom domains',
    'message.domainConnectDesc':
      'Connect your application to a custom domain for a professional appearance.',
    'message.connectDomain': 'Connect Domain',
    'message.domainUpgradeDesc':
      'This feature requires a higher subscription plan. Click the info icon above to upgrade.',
    'user.add': 'Add User',
    'user.deleteConfirm': 'Are you sure to delete this user?',
    'user.saveSuccess': 'User saved successfully',
    'user.saveFailed': 'User save failed',
    'user.createSuccess': 'User created successfully',
    'user.createFailed': 'User create failed',
    'database.deleteSelected': 'Delete Selected',
    'database.deleteSelectedConfirm':
      'This will permanently delete the selected rows. Continue?',
    'database.clearTable': 'Clear Table',
    'database.clearTableConfirm':
      'This will delete all rows in this table. Continue?',
    'database.clearFailed': 'Failed to clear table',
    'database.tableCleared': 'Table cleared successfully',
    'database.noRowsSelected': 'No rows selected',
    'database.clear': 'Clear',
    'database.sqlEditor': 'SQL Editor',
    'database.executeSql': 'Execute SQL',
    'database.sqlQuery': 'SQL Query',
    'database.queryResults': 'Query Results',
    'database.queryHistory': 'Query History',
    'database.savedQueries': 'Saved Queries',
    'database.saveQuery': 'Save Query',
    'database.queryName': 'Query Name',
    'database.queryDescription': 'Query Description',
    'database.executeTime': 'Execution Time',
    'database.rowsAffected': 'Rows Affected',
    'database.noResults': 'No results to display',
    'database.sqlExecutionFailed': 'SQL execution failed',
    'database.sqlExecutionSuccess': 'SQL executed successfully',
    'database.querySaved': 'Query saved successfully',
    'database.queryDeleted': 'Query deleted successfully',
    'database.loadQuery': 'Load Query',
    'database.deleteQuery': 'Delete Query',
    'database.exportResults': 'Export Results',
    'database.onlyDmlAllowed':
      'Only SELECT, INSERT, UPDATE, DELETE statements are allowed',
    'database.caseSensitiveHint':
      'Note: Use double quotes for case-sensitive identifiers (e.g., "Users" not Users)',
    'database.sqlPlaceholder':
      'Enter your SQL query here...\nExample: SELECT * FROM users LIMIT 10;',
    'database.resultsTruncated': 'Results truncated to 1000 rows',
  },
  zh: {
    // Common
    'common.confirm': '确认',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.edit': '编辑',
    'common.delete': '删除',
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.submit': '提交',
    'common.continue': '继续',
    'common.back': '返回',
    'common.next': '下一步',
    'common.close': '关闭',
    'common.open': '打开',
    'common.view': '查看',
    'common.download': '下载',
    'common.upload': '上传',
    'common.share': '分享',
    'common.copy': '复制',
    'common.paste': '粘贴',
    'common.cut': '剪切',
    'common.undo': '撤销',
    'common.redo': '重做',
    'common.configuration': '配置',
    'common.action': '操作',
    'common.total': '共',

    // Buttons
    'button.makePrototype': '生成原型',
    'button.newProject': '新建项目',
    'button.createProject': '新建项目',
    'button.newDocument': '新建文档',
    'button.createDocument': '新建文档',
    'button.addNew': '添加新项',
    'button.import': '导入',
    'button.export': '导出',
    'button.preview': '预览',
    'button.publish': '发布',
    'button.generate': '生成',
    'button.regenerate': '重新生成',
    'button.refresh': '刷新',
    'button.reset': '重置',
    'button.clear': '清除',
    'button.select': '选择',
    'button.choose': '选择',
    'button.browse': '浏览',
    'button.search': '搜索',
    'button.filter': '筛选',
    'button.sort': '排序',

    // Document Toolbar Actions
    'toolbar.publish': '发布',
    'toolbar.export': '导出',
    'toolbar.share': '分享',
    'toolbar.convert': '转换',
    'toolbar.viewDatabase': '查看数据库',
    'toolbar.codebase': '代码库',
    'toolbar.github': 'GitHub',
    'toolbar.bitbucket': 'Bitbucket',
    'toolbar.exportPdf': '导出 PDF',
    'toolbar.exportDocx': '导出 DOCX',
    'toolbar.connectDomain': '连接域名',
    'toolbar.createDevPlan': '创建开发计划',
    'toolbar.publishToProd': '发布上线',
    'toolbar.publishing': '发布中...',
    'toolbar.publishApp': '发布应用',
    'toolbar.publishingToProduction': '正在发布到生产环境...',
    'toolbar.publishedSuccessfully': '发布成功',
    'toolbar.publishFailed': '发布失败',
    'toolbar.makeProduct': '生成产品',
    'toolbar.prototypeSettings': '原型设置',
    'toolbar.productSettings': '产品设置',
    'toolbar.visualEdit': '可视化编辑',
    'toolbar.connectToCodeRepo': '连接到代码仓库',
    'toolbar.publishDocument': '发布文档',
    'toolbar.shareProject': '分享项目',
    'toolbar.waitForGeneration': '请等待当前生成完成',
    'toolbar.turnPrdToPrototype': '将 PRD 生成为设计原型',
    'toolbar.turnPrototypeToApp': '将原型生成为全栈应用',

    // Publish Modal
    'publish.title': '发布应用',
    'publish.notPublished': '应用尚未发布',
    'publish.notPublishedDesc': '选择您想要如何处理您的应用',
    'publish.publishToWeb': '发布到 Web',
    'publish.createDevPlan': '创建开发计划',
    'publish.published': '应用已发布',
    'publish.publishedDesc': '您的应用已上线并可访问',
    'publish.publishUrl': '发布地址',
    'publish.copyUrl': '复制地址',
    'publish.urlCopied': '地址已复制到剪贴板',
    'publish.visitSite': '访问站点',
    'publish.addCustomDomain': '添加自定义域名',
    'publish.enterCustomDomain': '输入自定义域名',
    'publish.invalidDomain': '域名格式无效',
    'publish.updateFailed': '更新域名失败',
    'publish.domainUpdated': '域名更新成功',
    'publish.publishing': '发布中...',
    'publish.publishYourProject': '发布您的项目',
    'publish.publishedRecently': '最近发布',
    'publish.customDomain': '自定义域名',
    'publish.manageDomains': '管理域名',
    'publish.republish': '发布',
    'publish.previewNewerNotice': '您有新的Preview版本。',
    'publish.publishNow': '现在发布',
    'publish.lastPublishedAt': '上次发布时间',
    'toolbar.configAndPublish': '配置并发布产品',
    'toolbar.firstCreateProduct': '请先生成产品',

    // Side Panel
    'sidePanel.myProfile': '我的资料',
    'sidePanel.billing': '账单',
    'sidePanel.admin': '管理',
    'sidePanel.shareAndEarn': '🎉 免费获取积分奖励',
    'sidePanel.refillNow': '立即充值',
    'sidePanel.joinSlackCommunity': '加入我们的 Slack 社区',
    'sidePanel.newProject': '创建项目',
    'sidePanel.logout': '退出登录',

    // Project Tabs
    'project.planner': '规划',
    'project.builder': '开发',
    'project.reporter': '报告',

    // Project List & Management
    'project.label': '项目',
    'project.noProjectFound': '暂无项目',
    'project.name': '名称',
    'project.owner': '负责人',
    'project.startDate': '开始日期',
    'project.access': '访问权限',
    'project.action': '操作',
    'project.shared': '共享',
    'project.self': '仅自己',
    'project.organization': '组织内',
    'project.team': '团队内',
    'project.projectNameRequired': '请输入项目名称',
    'project.enterProjectName': '请输入项目名称',
    'project.accessRequired': '请选择访问权限',
    'project.selectOwner': '请选择负责人',
    'project.deliveryDate': '预计交付时间',
    'project.enterProjectDescription': '请输入项目描述',
    'project.updateProject': '保存修改',
    'project.viewOnlyAccess': '您只能查看此项目',
    'project.workflow': '项目工作流',
    'project.info': '项目信息',
    'project.projectName': '项目名称',
    'project.description': '描述',
    'project.stakeholders': '对接人',
    'project.createDate': '创建日期',
    'project.dueDate': '截止日期',
    'project.progress': '进度',
    'project.insight': '洞察',
    'project.timelineShowingDeliverables': '显示时间线',
    'project.risksMitigationsActions': '风险控制',
    'project.customize': '自定义',
    'project.ownerRequired': '必须设置负责人',
    'project.dueDateRequired': '必须设置截止日期',
    'project.documents': '文档',
    'project.createDocument': '创建 {name} 文档',
    'project.save': '保存',
    'project.delete': '删除',
    'project.deleteStepTooltip': '删除此步骤',
    'project.cannotDeleteTooltip': '此步骤无法删除，因为项目已经开始',
    'project.clone': '复制',
    'project.share': '分享',
    'project.cloneProject': '复制项目',
    'project.shareProject': '分享项目',
    'project.projectSettings': '项目设置',
    'project.buildableDescriptionPrd': '供产品经理/负责人创建需求',
    'project.buildableDescriptionUiDesign': '供设计师创建 UI/UX 设计',
    'project.buildableDescriptionPrototype': '供产品负责人创建设计原型',
    'project.buildableDescriptionTechDesign': '供工程师创建技术设计',
    'project.buildableDescriptionDevelopment': '供产品负责人创建开发计划',
    'project.buildableDescriptionQa': '供 QA 工程师创建 QA 计划',
    'project.buildableDescriptionRelease': '供项目负责人创建发布清单',
    'project.upgradeToScale': '请升级到企业套餐以访问此功能。',
    'project.scalePlan': '企业套餐',
    'project.upgradeToTeams': '请升级到团队套餐以访问此功能。',
    'project.teamsPlan': '团队套餐',
    'project.addIssue': '添加问题',
    'project.addIssueTooltip': '添加问题',
    'project.syncToJira': '同步到 Jira',
    'project.submitChanges': '提交更改',
    'project.buildablePrd': '需求文档',
    'project.buildableUiDesign': 'UI 设计',
    'project.buildablePrototype': '原型',
    'project.buildableTechDesign': '技术设计',
    'project.buildableDevelopment': '开发计划',
    'project.buildableQa': 'QA',
    'project.buildableRelease': '发布',
    'project.buildableProposal': '商业提案',
    'project.buildableProduct': '产品',

    // Issues
    'issues.enterDescription': '输入描述...',
    'issues.issueChangeHistory': '变更历史',
    'issues.comments': '评论：',
    'issues.noComments': '暂无评论',
    'issues.leaveComment': '留下评论...',
    'issues.comment': '评论',
    'issues.back': '返回',

    // Team Management
    'team.teamName': '团队名称',
    'team.teamNameRequired': '请指定团队名称',
    'team.teamDescription': '团队描述',
    'team.members': '成员',
    'team.membersRequired': '请至少添加一个团队成员',
    'team.selectUsers': '选择用户',
    'team.addTeam': '添加团队',
    'team.accessFeature': '要访问此功能，请',
    'team.upgradeToScale': '升级到企业套餐',
    'team.addFromOrganization': '从您的组织中添加某人',
    'team.user': '用户',
    'team.selectUser': '选择用户',
    'team.addTeamMember': '添加团队成员',
    'team.email': '邮箱',
    'team.emailInvalid': '邮箱地址无效',
    'team.enterEmailInvite': '输入要邀请的邮箱',
    'team.add': '添加',
    'team.usersToInvite': '要邀请的用户',
    'team.sendInvitation': '发送邀请',
    'team.name': '名称',
    'team.enterTeamName': '输入团队名称',
    'team.description': '描述',
    'team.enterTeamDescription': '输入团队描述',
    'team.updateTeam': '更新团队',

    // Building/Task Management
    'building.points': '积分',
    'building.error': '错误',
    'building.synced': '已同步',
    'building.syncProjectToJira': '同步项目到 Jira',
    'building.projectSyncedToJira': '项目已同步到 Jira',
    'building.taskGenerationFailed': '任务生成失败。请重试',

    // User Management
    'user.firstName': '名',
    'user.firstNameRequired': '请添加名',
    'user.lastName': '姓',
    'user.lastNameRequired': '请添加姓',
    'user.specialty': '专业',
    'user.specialtyTooltip': '用户的主要工作职能',
    'user.specialtyRequired': '请指定专业',
    'user.velocity': '速度',
    'user.velocityTooltip':
      '用户每两周可以完成的敏捷估算单位，通常在 5-10 之间',
    'user.submit': '提交',
    'user.invitationOnly':
      'Omniflow 目前仅通过邀请使用。请输入您的邀请人邮箱。',
    'user.inviterEmail': '邀请人邮箱',
    'user.inviterEmailRequired': '请输入您的邀请人邮箱',
    'user.inviterEmailPlaceholder': '请输入您的邀请人邮箱',
    'user.confirmInvitation': '确认邀请',
    'user.noInviterEmail': '如果您没有邀请人邮箱，请',
    'user.requestAccess': '申请访问权限',

    // Reporting
    'reporting.overallProject': '项目总览',
    'reporting.planning': '规划',
    'reporting.building': '构建',
    'reporting.timeUsed': '已用时间',
    'reporting.workProgress': '工作进度',
    'reporting.velocity': '速度',
    'reporting.devVelocity': '开发速度',
    'reporting.milestonesCompleted': '里程碑已完成',
    'reporting.goodJobCompleted': '做得好。您已完成构建中里程碑的所有任务。',
    'reporting.publishPrdFirst': '请先从规划中发布 PRD 和开发计划',
    'reporting.riskScore': '风险评分 - {name}',
    'reporting.timeTooltip':
      '{pastTime} 天，共 {totalTime} 天，截止日期 {dueDate}',
    'reporting.velocityTooltip': '预期速度的 {velocity}%',
    'reporting.insights': '洞察',

    // Project Management
    'project.scrum': 'Scrum',
    'project.kanban': 'Kanban',
    'project.projects': '项目',
    'project.view': '查看',
    'project.edit': '编辑',
    'project.cloneConfirmTitle': '复制项目',
    'project.cloneConfirmContent':
      '您确定要复制 "{name}" 吗？这将创建一个具有相同数据的新项目。',
    'project.cloneSuccess': '项目 "{name}" 已成功复制为 "{clonedName}"',
    'project.cloneError': '复制项目失败。请重试。',

    // Issue Editor
    'issue.issueName': 'issue 名称',
    'issue.issueNameRequired': '请输入 issue 名称',
    'issue.enterIssueName': '输入 issue 名称',
    'issue.parentEpic': '父级 epic',
    'issue.parentEpicRequired': '请选择父级 epic',
    'issue.pleaseSelect': '请选择',
    'issue.sprintSelection': ' 紧急事项选择',
    'issue.preSelect': '预选择',
    'issue.backlog': '待办事项',
    'issue.sprint': '紧急事项',
    'issue.insights': '洞察',
    'issue.newTasks': '新任务',
    'issue.milestoneImpacts': '里程碑',
    'issue.publish': '发布',
    'issue.other': '其他',

    // Sharing
    'sharing.enterEmailToShare': '请输入要分享文档的邮箱',

    // Issue Details
    'issue.type': '类型：',
    'issue.assignee': '负责人：',
    'issue.storyPoint': '敏捷估算单位：',
    'issue.status': '状态：',
    'issue.plannedDate': '计划日期：',
    'issue.parent': '父级：',
    'issue.modified': '修改',
    'issue.to': '为',
    'issue.at': '在',

    // Building Tables & Columns
    'building.sprint': '冲刺',
    'building.task': '任务',
    'building.milestone': '里程碑',
    'building.milestones': '里程碑',
    'building.workPlan': '工作计划',
    'building.taskBoard': '任务看板',
    'building.status': '状态',
    'building.schedule': '计划',
    'building.progress': '进度',
    'building.goals': '目标',
    'building.addIssueButton': '+ 添加问题',
    'building.issues': '问题',
    'building.backlog': '待办事项',
    'building.noSprintsAvailable': '暂无可用冲刺',
    'building.progressFormat': '进度：{completed}/{total}',
    'building.publishPrdAndDevPlan': '请先从规划面板发布 PRD 和开发计划',
    'building.publishDevPlan': '请先从规划面板发布开发计划',

    // Settings
    'settings.generationSettings': '生成设置',
    'settings.userManagement': '用户管理',
    'settings.integrations': '外部集成',
    'settings.referral': '推荐',
    'settings.designCustomization': '定制风格',
    'settings.upgradePlanForAccess': '升级',

    // Navigation
    'nav.dashboard': '面板',
    'nav.projects': '项目',
    'nav.myProjects': '我的项目',
    'nav.knowledgeBase': '知识库',
    'nav.templates': '模版',
    'nav.inviteTeam': '邀请团队成员',

    // Knowledge Base
    'knowledgeBase.title': '知识库',
    'knowledgeBase.description': '管理您的知识库',
    'knowledgeBase.create': '创建知识库',
    'knowledgeBase.createFirst': '创建您的第一个知识库',
    'knowledgeBase.createSuccess': '知识库创建成功',
    'knowledgeBase.createError': '创建知识库失败',
    'knowledgeBase.name': '名称',
    'knowledgeBase.namePlaceholder': '请输入知识库名称',
    'knowledgeBase.nameRequired': '名称为必填项',
    'knowledgeBase.descriptionField': '描述',
    'knowledgeBase.descriptionPlaceholder': '请输入描述（可选）',
    'knowledgeBase.searchPlaceholder': '搜索知识库...',
    'knowledgeBase.noKnowledgeBases': '暂无知识库',
    'knowledgeBase.noSearchResults': '未找到匹配的知识库',
    'knowledgeBase.files': '个文件',
    'knowledgeBase.by': '作者',
    'knowledgeBase.createdBy': '创建者',
    'knowledgeBase.createdAt': '创建时间',
    'knowledgeBase.notFound': '未找到知识库',
    'knowledgeBase.delete': '删除知识库',
    'knowledgeBase.confirmDelete': '删除知识库',
    'knowledgeBase.confirmDeleteMessage':
      '确定要删除此知识库吗？所有文件和向量数据将被永久删除。',
    'knowledgeBase.deleteSuccess': '知识库删除成功',
    'knowledgeBase.deleteError': '删除知识库失败',
    'knowledgeBase.updateSuccess': '知识库更新成功',
    'knowledgeBase.updateError': '更新知识库失败',
    'knowledgeBase.assignToProject': '分配给项目',
    'knowledgeBase.assignSuccess': '项目分配成功',
    'knowledgeBase.assignError': '分配项目失败',
    'knowledgeBase.selectProjects': '选择项目',
    'knowledgeBase.noProjectsAvailable': '没有可用的项目',
    'knowledgeBase.test': '测试',
    'knowledgeBase.chat': '对话',
    'knowledgeBase.settings': '设置',
    'knowledgeBase.basicInfo': '基本信息',
    'knowledgeBase.dangerZone': '危险区域',
    'knowledgeBase.deleteKnowledgeBase': '删除知识库',
    'knowledgeBase.deleteWarning': '此操作无法撤销，所有数据将被永久删除。',
    'knowledgeBase.information': '信息',
    'knowledgeBase.totalFiles': '文件总数',

    // File Management
    'knowledgeBase.fileName': '文件名',
    'knowledgeBase.fileSize': '大小',
    'knowledgeBase.status': '状态',
    'knowledgeBase.chunks': '分块数',
    'knowledgeBase.uploadedBy': '上传者',
    'knowledgeBase.uploadedAt': '上传时间',
    'knowledgeBase.selectFiles': '选择文件',
    'knowledgeBase.uploadFiles': '上传',
    'knowledgeBase.selectFileFirst': '请先选择文件',
    'knowledgeBase.uploadSuccess': '文件上传成功',
    'knowledgeBase.uploadError': '文件上传失败',
    'knowledgeBase.supportedFormats':
      '支持格式：txt, md, pdf, docx, csv, xlsx, xls, 图片, 代码文件（最大 50MB）',
    'knowledgeBase.statusPending': '待处理',
    'knowledgeBase.statusProcessing': '处理中',
    'knowledgeBase.statusCompleted': '已完成',
    'knowledgeBase.statusFailed': '失败',
    'knowledgeBase.confirmDeleteFile': '删除文件',
    'knowledgeBase.confirmDeleteFileMessage': '确定要删除此文件吗',
    'knowledgeBase.deleteFileSuccess': '文件删除成功',
    'knowledgeBase.deleteFileError': '删除文件失败',
    'knowledgeBase.reprocess': '重新处理',
    'knowledgeBase.reprocessStarted': '文件重新处理已开始',
    'knowledgeBase.reprocessError': '重新处理文件失败',
    'knowledgeBase.download': '下载',
    'knowledgeBase.downloadError': '下载文件失败',
    'knowledgeBase.downloadStarted': '开始下载',
    'knowledgeBase.dragUpload': '点击或拖拽文件到此区域上传',
    'knowledgeBase.uploading': '上传中',
    'knowledgeBase.processing': '处理中',
    'knowledgeBase.uploadComplete': '上传完成',

    // Knowledge Test
    'knowledgeBase.testQuery': '测试查询',
    'knowledgeBase.testQueryDescription': '输入问题来测试知识库的检索效果',
    'knowledgeBase.enterTestQuery': '在此输入您的测试问题...',
    'knowledgeBase.search': '搜索',
    'knowledgeBase.searching': '正在搜索知识库...',
    'knowledgeBase.searchResults': '搜索结果',
    'knowledgeBase.noResults': '未找到相关信息',
    'knowledgeBase.enterQueryToTest': '在上方输入查询来测试知识检索',
    'knowledgeBase.similarity': '相似度',
    'knowledgeBase.relevantChunks': '相关知识',
    'knowledgeBase.source': '来源',
    'knowledgeBase.imageOCR': '图片文字识别',
    'knowledgeBase.ocrExtracted': 'OCR 提取',
    'knowledgeBase.extractedText': '提取的文字',
    'knowledgeBase.noTextExtracted': '未能从此图片中提取文字',

    // Knowledge Chat
    'knowledgeBase.startConversation': '开始对话，询问关于知识库的问题',
    'knowledgeBase.typeMessage': '在此输入您的消息...',
    'knowledgeBase.thinking': '思考中...',
    'knowledgeBase.chatError': '抱歉，遇到错误，请重试。',
    'knowledgeBase.loadError': '加载知识库失败',
    'knowledgeBase.retry': '重试',

    // Billing
    'billing.title': '账单',
    'billing.subscriptionPlan': '订阅',
    'billing.currentPlan': '当前订阅',
    'billing.planWillStop': '您当前的计划将在以下日期停止',
    'billing.totalSeats': '总可用名额',
    'billing.remainingSeats': '剩余可用名额',
    'billing.changePlan': '更改套餐',
    'billing.choosePlan': '选择套餐',
    'billing.cancelPlan': '取消套餐',
    'billing.cancelConfirm': '您确定要取消当前订阅吗？',
    'billing.yes': '是',
    'billing.no': '否',
    'billing.choosePlanTitle': '选择套餐',
    'billing.freePlan': '您当前使用的是免费套餐。',
    'billing.upgradePlan': '升级套餐',
    'billing.credits': '积分',
    'billing.currentBalance': '当前积分余额',
    'billing.purchaseCredits': '购买积分',
    'billing.creditHistory': '积分历史',
    'billing.subscriptionCancelled': '订阅已取消。',
    'billing.cancellationFailed': '订阅取消失败：',

    // Profile
    'profile.updateProfile': '更新您的资料',
    'profile.completeProfile': '完善您的资料',
    'profile.email': '邮箱',
    'profile.name': '姓名',
    'profile.firstName': '名',
    'profile.lastName': '姓',
    'profile.role': '角色',
    'profile.roleTooltip': '您在团队中的主要工作职能或职位',
    'profile.selectRole': '选择角色',
    'profile.website': '网站',
    'profile.websitePlaceholder': '请输入您的网站',
    'profile.organizationName': '组织名称',
    'profile.organizationSize': '组织规模',
    'profile.industry': '行业',
    'profile.selectIndustry': '选择行业',
    'profile.save': '保存',
    'profile.fillRequired': '请填写所有必填项',
    'profile.updateSuccess': '您的资料已成功更新',
    'profile.loadingError': '加载现有资料时发生错误：',

    // Referral
    'referral.loadingData': '加载推荐数据中...',
    'referral.errorLoading': '加载推荐数据错误',
    'referral.failedToLoad': '加载推荐数据失败。请稍后重试。',
    'referral.dashboard': '推荐面板',
    'referral.adminView': '（管理员视图 - 所有用户）',
    'referral.trackAllUsers': '跟踪所有用户的推荐和佣金收入',
    'referral.trackYourReferrals': '跟踪您的推荐和佣金收入',
    'referral.paidReferral': '已付费推荐',
    'referral.canceledCommissions': '已取消佣金',
    'referral.commissionEarned': '已赚佣金',
    'referral.pendingCommissions': '待处理佣金',
    'referral.referralsByMonth': '按月推荐',
    'referral.monthlySummary': '您推荐的月度摘要，包含可展开的详细信息',
    'referral.noDataFound': '未找到推荐数据。开始分享您的推荐代码！',
    'referral.referrer': '推荐人',
    'referral.referredUser': '被推荐用户',
    'referral.signupDate': '注册日期',
    'referral.subscriptionDate': '订阅日期',
    'referral.noSubscription': '无订阅',
    'referral.amount': '金额',
    'referral.noPayment': '无付款',
    'referral.commission': '佣金',
    'referral.noCommission': '无佣金',
    'referral.status': '状态',
    'referral.noPaymentStatus': '无付款',
    'referral.actions': '操作',
    'referral.markPaid': '标记为已付款',
    'referral.cancel': '取消',
    'referral.alreadyPaid': '✅ 已付款',
    'referral.alreadyCanceled': '❌ 已取消',
    'referral.noPayments': '无付款',
    'referral.noPaymentYet': '尚未付款',
    'referral.getCredits': '🎁 当您推荐的用户注册时获得 1000 免费积分',
    'referral.earnCommission': '💰 在他们前 6 个月的订阅中获得 15% 佣金',
    'referral.trackReferrals': '实时跟踪您的推荐奖励',
    'referral.referralPage': '推荐页面',
    'referral.code': '推荐码',
    'referral.noCodeAvailable': '无推荐码可用',
    'referral.copy': '复制',
    'referral.url': '推荐链接',
    'referral.codeCopied': '推荐码已复制到剪贴板！',
    'referral.urlCopied': '推荐链接已复制到剪贴板！',
    'referral.copyFailed': '复制推荐码失败',
    'referral.urlCopyFailed': '复制链接失败',
    'referral.message': '消息',
    'referral.defaultMessage':
      '我正在试用一款软件叫Omniflow，感觉不错。它可以将我的想法转化为 PRD、原型和最终产品，形成无缝的工作流程。推荐给你试试：{referralUrl}',
    'referral.messageCopied': '消息已复制到剪贴板！',
    'referral.messageCopyFailed': '复制消息失败',

    // Integration
    'integration.jiraIntegration': 'Jira 集成',
    'integration.jiraDescription': '连接您的 Jira同步项目',
    'integration.githubConnect': 'GitHub 连接',
    'integration.githubDescription': '连接您的 GitHub',
    'integration.bitbucketConnect': 'Bitbucket 连接',
    'integration.bitbucketDescription': '连接您的 Bitbucket',

    // Issues & Organization
    'issues.recentTasks':
      '请查看下方您最近的项目任务、应用程序或产品需求文档。',
    'organization.currentProjects': '当前项目',

    // Streaming Editor
    'streaming.polishingCss': '优化 CSS...',
    'streaming.minifyingJs': '压缩 JavaScript...',
    'streaming.optimizingAssets': '优化资源...',
    'streaming.refiningLayout': '完善布局...',
    'streaming.tuningPerformance': '调优性能...',
    'streaming.aligningPixels': '对齐像素...',
    'streaming.lintingFiles': '检查文件...',
    'streaming.trimmingWhitespace': '清理代码...',
    'streaming.polishingApp': '优化应用',
    'streaming.creatingDocument': '创建 {documentName}...',
    'streaming.updatingDocument': '更新 {documentName}...',
    'streaming.deployingDocument': '部署 {documentName}...',
    'streaming.planningFiles': '规划文件...',

    // Modal Titles
    'modal.addProject': '添加项目',
    'modal.addDocument': '添加文档',
    'modal.addChat': '添加想法',
    'modal.editDocument': '编辑文档',
    'modal.deleteDocument': '删除文档',
    'modal.editChat': '编辑想法',
    'modal.deleteChat': '删除想法',
    'modal.viewTutorial': 'Omniflow 演示',
    'modal.addIssue': '创建问题',
    'modal.addTeam': '创建团队',
    'modal.addTeamMember': '添加团队成员',
    'modal.inviteUser': '邀请团队',
    'modal.addVirtualUser': '创建虚拟队友',
    'modal.deleteProject': '删除项目',
    'modal.editProject': '编辑项目',
    'modal.shareProject': '分享项目',
    'modal.editTeam': '编辑团队',
    'modal.deleteTeam': '删除团队',
    'modal.deleteTeamInvalid': '无法删除团队',
    'modal.createPrd': '创建产品需求文档',
    'modal.createUiDesign': '创建 UI/UX 设计',
    'modal.createTechDesign': '创建技术设计',
    'modal.createDevelopmentPlan': '创建开发计划',
    'modal.createQaPlan': '创建测试计划',
    'modal.createReleasePlan': '创建发布计划',
    'modal.createBusinessProposal': '创建商业提案',
    'modal.updateSubscription': '更改计划',
    'modal.purchaseCredits': '购买积分',
    'modal.editWorkflow': '自定义项目工作流',
    'modal.deleteDocumentImage': '删除文档图片',
    'modal.addTemplateDocument': '创建文档模板',
    'modal.fillDatabaseSettings': '配置数据库',
    'modal.stripeConfig': '配置 Stripe',
    'modal.referralModal': '🎁 分享 Omniflow 并获得奖励！',
    'modal.feedback': '分享您的反馈',

    // Feedback Form
    'feedback.npsQuestion': '您向朋友和同事推荐 Omniflow 的可能性有多大？',
    'feedback.npsScale': '评分',
    'feedback.veryUnlikely': '非常不可能',
    'feedback.veryLikely': '非常可能',
    'feedback.neutral': '中性',
    'feedback.likely': '可能',
    'feedback.whatYouLike': '您喜欢 Omniflow 的哪些方面？',
    'feedback.whatYouLikePlaceholder': '告诉我们您喜欢 Omniflow 的哪些方面...',
    'feedback.whatYouDontLike': '您不喜欢 Omniflow 的哪些方面？',
    'feedback.whatYouDontLikePlaceholder': '我们会改进。请分享您的想法...',
    'feedback.slackMessage':
      '💡 提交后，加入我们的 #user-support 频道可获得 1000 积分！',
    'feedback.submit': '提交',
    'feedback.submitSuccess': '感谢您的反馈！',
    'feedback.submitError': '提交反馈失败。请重试。',
    'feedback.pleaseRate': '请评价您推荐的可能性。',
    'feedback.whatYouLikeRequired': '请告诉我们您喜欢 Omniflow 的哪些方面',
    'feedback.whatYouDontLikeRequired':
      '请告诉我们您不喜欢 Omniflow 的哪些方面',
    'feedback.giveFeedback': '提供反馈',
    'feedback.feedbackForCredits': '反馈获取积分',

    // Free Projects Counter
    'freeProjects.limitReached': '您的免费项目已用完。',
    'freeProjects.used': '您已使用 {used}/{limit} 个免费项目。',
    'freeProjects.getUnlimited': '获取更多',

    // Generation Settings
    'generation.estimateStoryPoints':
      '请估算您的团队完成下面示例任务需要多少个敏捷估算单位。这用于开发计划生成期间的任务估算。',
    'generation.sampleTaskDescription': '示例任务描述',
    'generation.sampleTaskStoryPoint': '示例任务敏捷估算单位',
    'generation.baselineStoryPoint': '示例任务的基准敏捷估算单位。',
    'generation.enterStoryPoint':
      '输入您的团队对下面示例任务的估算敏捷估算单位',
    'generation.documentGenerateLanguage': '文档生成语言',
    'generation.selectLanguage': '选择您团队用于文档生成的语言',

    'generation.stopped': '生成已停止',
    'generation.stopping': '正在停止生成...',

    // Document Actions
    'document.stopGeneration': '停止生成',
    'document.stopping': '正在停止生成...',

    // Language Select
    'language.selectPlaceholder': '选择语言',
    'language.switchTo': '切换到',
    'language.english': 'English',
    'language.chinese': '中文',

    // Home Page
    'home.mainTitle': '让想法秒变产品',
    'home.subtitle': 'AI 驱动全栈开发，一站式从需求到上线',
    'home.appTemplates': '应用模板',
    'home.projectDescriptionPlaceholder': '输入产品需求描述或选择下面的模版',
    'home.noProjectsFound': '此类别下未找到项目。',
    'home.preview': '预览',
    'home.clone': '复制',
    'home.addProjectDescription':
      '请在下面添加项目，开始体验 Omniflow AI d 能力！',
    'home.addProject': '添加项目',

    // Sharing Modals
    'sharing.peopleWithAccess': '有访问权限的人员',
    'sharing.generalAccess': '通用访问',
    'sharing.shareableLink': '可分享链接',
    'sharing.share': '分享',

    // Pricing Plans
    'pricing.runningOutOfCredits':
      '⚠️ 您的积分即将用完！请升级您的计划、购买更多积分或分享赚取以继续使用。',
    'pricing.cashPayNotSupported':
      '⚠️ 现金支付目前不受支持。请使用其他支付方式，如信用卡、PayPal 或 Link。',
    'pricing.buyMoreCredits': '购买更多积分：',
    'pricing.buyCredits': '购买积分',
    'pricing.enterpriseContact': '定制化方案请联系我们',
    'pricing.everythingInPlus': '{tier} 中的所有内容，以及：',
    'pricing.popular': '热门',

    // Pricing Plans
    'pricing.performance': '专业套餐',
    'pricing.teams': '团队套餐',
    'pricing.scale': '旗舰套餐',
    'pricing.forIndividualsToShip': '适合个人用户快速发布产品',
    'pricing.forTeamsToBoost': '适合团队提升生产力',
    'pricing.forLargeTeamsToTransform': '适合大型团队转型产品交付',

    // Pricing Features
    'pricing.free': '免费套餐',
    'pricing.team': '团队套餐',
    'pricing.creditsPerMonth20k': '每月 20,000 积分',
    'pricing.creditsPerMonth75k': '每月 75,000 积分',
    'pricing.creditsPerMonth200k': '每月 200,000 积分',
    'pricing.creditsPerMonth4x': '每月 4 倍积分',
    'pricing.creditsPerMonth15x': '每月 15 倍积分',
    'pricing.creditsPerMonth40x': '每月 40 倍积分',
    'pricing.everythingInFree': '免费',
    'pricing.everythingInPerformance': '专业',
    'pricing.everythingInTeams': '团队',
    'pricing.unlimitedProjects': '无限项目',
    'pricing.customDomain': '自定义域名',
    'pricing.liveCodeEditing': '实时代码编辑',
    'pricing.fullStack': '完整前端、后端和数据库',
    'pricing.authFileStoragePaymentEmail': '认证、文件存储、支付和邮件',
    'pricing.builtInAIGeneration': '内置 AI 生成',
    'pricing.publishAndHost': '发布实时应用',
    'pricing.teamInvitation': '团队邀请',
    'pricing.customDesignLanguage': '自定义设计语言',
    'pricing.databaseSnapshot': '数据库快照、回滚和重置',
    'pricing.githubBitbucketSync': 'Github/Bitbucket 代码同步',
    'pricing.jiraIntegration': 'JIRA 集成',
    'pricing.roleBasedAccessControl': '基于角色的访问控制',
    'pricing.centralizedBilling': '集中计费',
    'pricing.upTo20Users': '最多 20 个用户',
    'pricing.upTo100Users': '最多 100 个用户',
    'pricing.prioritySupport': '优先支持',
    'pricing.customIntegration': '自定义集成',
    'pricing.knowledgeBase': '知识库',
    'pricing.customTechStack': '自定义技术栈',
    'pricing.viewBuildAndRuntimeLogs': '查看构建和运行时日志',
    'prototypeEditor.upgradePlanToViewLogs': '升级计划以查看日志',
    'nav.upgradePlanToAccessKnowledgeBase': '升级计划以访问知识库',
    'toolbar.upgradePlanToAccessProductSettings': '升级计划以访问产品设置',

    // Pricing Sections
    'pricing.planner': '规划',
    'pricing.builder': '构建',
    'pricing.reporter': '报告',

    // Pricing Plan Terms
    'pricing.monthly': '按月付费',
    'pricing.annuallyDiscount': '按年付费（优惠 $60）',
    'pricing.currentlySelected': '当前已选择',
    'pricing.currentPlan': '当前计划',
    'pricing.choosePlan': '选择 {plan}',
    'pricing.period': '/月/用户',
    'pricing.periodPerformance': '/月',
    'pricing.earlyBirdDiscount':
      '🎉 早鸟优惠 50% 折扣 - 有效期至 2025 年 10 月',

    // Direct Referrals
    'referral.directReferralsByMonth': '每月直接推荐',
    'referral.directMonthlySummary': '您的月度直接推荐',
    'referral.monthsRangeOfTotal': '{range[0]}-{range[1]} 共 {total} 个月',
    'referral.noDirectReferralData':
      '未找到一级推荐数据。开始分享您的推荐码吧！',

    // Profile & User Management (additional)
    'profile.specialty': '专业',
    'profile.specialtyTooltip': '选择您的职位',
    'profile.velocity': '速度',
    'profile.noDepartment': '无部门',
    'profile.jiraId': 'Jira ID',

    // Specialty Roles
    'specialty.productManagement': '产品管理',
    'specialty.uiDesign': 'UI 设计',
    'specialty.frontendEngineer': '前端工程师',
    'specialty.backendEngineer': '后端工程师',
    'specialty.fullstackEngineer': '全栈工程师',
    'specialty.infraDevopsEngineer': '基础设施/运维 工程师',
    'specialty.dataEngineer': '数据工程师',
    'specialty.mlAiEngineer': '机器学习/AI 工程师',
    'specialty.qaEngineer': '质量保证工程师',
    'specialty.releaseEngineer': '发布工程师',
    'specialty.mobileEngineerIos': '移动端工程师 - iOS',
    'specialty.mobileEngineerAndroid': '移动端工程师 - 安卓',
    'specialty.mobileEngineerWindows': '移动端工程师 - Windows',
    'specialty.securityEngineer': '安全工程师',
    'specialty.technicalWriter': '技术文档工程师',
    'specialty.engineeringManager': '工程经理',
    'specialty.technicalLead': '技术负责人',
    'specialty.architect': '架构师',
    'specialty.cto': '首席技术官',
    'specialty.ceo': '首席执行官',
    'specialty.founder': '创始人',
    'specialty.dataScientist': '数据科学家',
    'specialty.productManager': '产品经理',
    'specialty.uiDesigner': 'UI 设计师',

    // Industries
    'industry.agriculture': '农业',
    'industry.automotive': '汽车',
    'industry.banking': '银行业',
    'industry.construction': '建筑业',
    'industry.consumerGoods': '消费品',
    'industry.education': '教育',
    'industry.energy': '能源',
    'industry.entertainment': '娱乐',
    'industry.financialServices': '金融服务',
    'industry.foodBeverage': '食品饮料',
    'industry.healthcare': '医疗保健',
    'industry.hospitality': '酒店业',
    'industry.insurance': '保险',
    'industry.manufacturing': '制造业',
    'industry.mediaAdvertising': '媒体广告',
    'industry.realEstate': '房地产',
    'industry.retail': '零售',
    'industry.technology': '技术',
    'industry.telecommunications': '电信',
    'industry.transportationLogistics': '交通物流',

    // Company Sizes
    'companySize.under50': '<50 员工',
    'companySize.50to300': '50-300 员工',
    'companySize.300to500': '300-500 员工',
    'companySize.over500': '>500 员工',

    // Referral Sources
    'referral.searchEngine': '搜索引擎（如谷歌）',
    'referral.socialMedia': '社交媒体（如 LinkedIn、Twitter）',
    'referral.friend': '朋友或同事',
    'referral.advertisement': '广告',
    'referral.other': '其他',
    'referral.howDidYouHear': '您是如何了解我们的？',
    'referral.selectSource': '请选择您是如何了解我们的',

    // FTUE Help Categories
    'ftue.improveWorkflow': '改善产品开发工作流程',
    'ftue.automateDocuments': '自动化文档创建（PRD、技术设计等）',
    'ftue.createPrd': '生成完全功能的原型',
    'ftue.automateTasks': '自动化任务分解和调度',
    'ftue.trackTimeline': '跟踪时间线和执行',
    'ftue.improveCommunication': '改善团队沟通和协调',
    'ftue.gainVisibility': '获得项目进展的可见性',
    'ftue.welcome': '您好，欢迎来到 Omniflow！',
    'ftue.description1':
      '使用 AI 将您的想法转化为产品规格、完全功能的设计原型和最终的全栈产品。无缝集成到您现有的工作流程中。',
    'ftue.description2': '让我们从几个快速问题开始，这样我们就能更好地了解您。',
    'ftue.whatHelpNeeded': '您最需要什么帮助？',
    'ftue.tellUsMore': '告诉我们更多关于您和您公司的信息',
    'ftue.otherHelpPlaceholder': '请添加上述未提及的其他内容',

    // Forgot Password Flow
    'forgotPassword.title': '重置您的密码',
    'forgotPassword.subtitle': '我们将向您的邮箱发送验证码',
    'forgotPassword.sendCode': '发送验证码',
    'forgotPassword.backToSignIn': '返回登录',
    'forgotPassword.enterEmail': '请输入邮箱',
    'forgotPassword.checkEmail': '查看您的邮箱',
    'forgotPassword.codeInstructions':
      '验证码已发送。请输入我们发送到您邮箱的验证码',
    'forgotPassword.resendCode': '重新发送验证码',
    'forgotPassword.confirm': '确认',

    // Monthly Table Columns
    'monthlyTable.month': '月份',
    'monthlyTable.paidReferral': '已付费推荐',
    'monthlyTable.totalCommission': '总佣金',
    'monthlyTable.pending': '待处理',
    'monthlyTable.paid': '已付费',
    'monthlyTable.canceled': '已取消',
    'monthlyTable.status': '状态',
    'monthlyTable.actions': '操作',
    'monthlyTable.complete': '✅ 完成',
    'monthlyTable.pendingStatus': '⏳ 待处理',
    'monthlyTable.payAll': '全部支付 ({count})',

    // Credit List Table Columns
    'creditList.actionName': '历史记录',
    'creditList.amount': '数量',
    'creditList.status': '状态',
    'creditList.document': '文档',
    'creditList.user': '用户',
    'creditList.createdAt': '创建时间',

    // Template Document
    'template.save': '保存',
    'template.edit': '编辑',
    'template.clone': '复制',
    'template.useTemplate': '使用模板',
    'template.templatePrompt': '模板提示词',
    'template.templatePromptDescription':
      '此自动生成的提示词文本将用于基于此模板创建文档。',
    'template.noPermissionEdit': '您没有权限编辑此模板。',
    'template.clonedSuccessfully': '模板复制成功。您可以接下来编辑它',
    'template.updatedSuccessfully': '模板更新成功',
    'template.inUse': '使用中',
    'template.access': '{access} 可见',

    // Template Access Types
    'templateAccess.self': '个人',
    'templateAccess.organization': '组织',
    'templateAccess.public': '公开',

    // Template Clone
    'template.cloneSuffix': '副本',
    'template.builtIn': '内置',
    'template.cannotEditBuiltIn': '无法编辑内置模板',

    'project.navigateToPrototype': '跳转至原型',
    'project.navigateToPrototypeContent':
      '您想要现在跳转到原型吗？（原型可能还在部署中）',
    'project.navigateToPrototypeOk': '确认',
    'project.navigateToPrototypeCancel': '取消',

    'template.by': '作者',
    'template.documentTemplates': '文档模板',
    'template.templateCenter': '模版中心',
    'template.back': '返回',
    'template.searchPlaceholder': '按模板名称或描述搜索',
    'template.newTemplate': '新建模板',
    'template.name': '名称',
    'template.nameRequired': '请指定模板名称',
    'template.namePlaceholder': '输入模板名称',
    'template.type': '类型：',
    'template.typeRequired': '请选择文档类型',
    'template.description': '描述',
    'template.descriptionTooltip': '模板的用途及其预期用途',
    'template.descriptionRequired': '请描述模板的用途',
    'template.descriptionPlaceholder':
      '请指定模板的用途，例如，用于新产品开发的标准 PRD 模板',
    'template.generateTemplatePrompt': '生成模板提示词',
    'template.regenerateTemplatePrompt': '重新生成模板提示词',
    'template.templatePromptLabel': '模板提示词',
    'template.templatePromptTooltip': '这些指令用作 AI 生成输出文档的上下文',
    'template.templatePromptRequired': '请指定用户指令',
    'template.checkTemplateOutput': '检查模板输出',
    'template.saveTemplate': '保存模板',
    'template.sampleInput': '示例输入',
    'template.sampleInputTooltip':
      '输入将与提示词一起使用以生成输出的示例用户输入',
    'template.sampleInputRequired': '请提供示例用户输入',
    'template.sampleInputPlaceholder':
      '请包含生成所需的上下文、问题或用户需求。以下是 Omniflow PRD 输入的示例：\n- "我们想要构建一个自动化整个产品开发生命周期的应用程序。通过对产品的简要描述，Omniflow 将生成全面的 PRD、UI/UX 设计、技术设计、开发等。"',
    'template.outputDoc': '输出文档',
    'template.outputDocTooltip':
      '输入示例输入后，按"生成示例输出"按钮获取输出。',
    'template.outputDocRequired': '请在上面提供输入以生成此示例输出',
    'template.generateSampleOutput': '生成示例输出',
    'template.toolbarHelperText':
      '想要更改提示词？您可以直接在下方编辑或修改上面的描述来生成。',
    'template.toolbarHelperTextOutput': '您可以直接编辑下面的内容。',
    'template.generatePromptFirst': '请先在主屏幕中生成模板提示词',
    'template.create': '创建',

    // User Guide & Welcome
    'userGuide.title': 'Omniflow 用户指南',
    'userGuide.welcome': '欢迎使用 Omniflow。让我们开始探索更多功能。',
    'userGuide.viewFaq': '查看常见问题',
    'userGuide.watchDemo': '观看演示',
    'welcome.title': '欢迎使用 Omniflow！',
    'welcome.description': '请{addProjectLink}，开始体验 Omniflow 的魅力！',
    'welcome.addFirstProject': '添加您的第一个项目',
    'welcome.newProject': '新建项目',

    // Prototype Editor
    'prototypeEditor.preview': '预览 - ',
    'prototypeEditor.status': '状态：{status}',
    'prototypeEditor.sourceFiles': '源文件',
    'prototypeEditor.editor': '编辑器',
    'prototypeEditor.editorWithFile': '编辑器 - {file}',
    'prototypeEditor.buildingAppPreview': '构建应用预览中',
    'prototypeEditor.pleaseWaitPreview': '请稍等，我们正在为您准备应用预览',
    'prototypeEditor.networkIssue': '网络问题',
    'prototypeEditor.somethingWentWrong':
      '糟糕，出现了问题。请刷新浏览器并重试。',
    'prototypeEditor.deploymentFailed':
      '部署失败，出现错误：\n\n{error}\n\n请分析并修复构建错误。',
    'prototypeEditor.chatWithJoyToCreate':
      '让 Joy 在左侧聊天框中为您创建{documentName}',
    'prototypeEditor.noDocumentCreatedYet': '暂时没有{documentName}生成',
    'prototypeEditor.loadingAppPreview': '预览加载中...',
    'prototypeEditor.deploymentCompletedSuccessfully': '部署完成!',
    'prototypeEditor.previewApp': '预览应用',
    'prototypeEditor.viewCode': '查看代码',
    'prototypeEditor.viewPrototype': '查看原型',
    'prototypeEditor.viewProduct': '查看产品',
    'prototypeEditor.viewApp': '查看应用',
    'prototypeEditor.code': '代码',
    'prototypeEditor.fixErrors': '修复错误',
    'prototypeEditor.savingChanges': '保存更改中...',
    'prototypeEditor.visualEditPreview': '请稍候，我们正在应用您的更改',
    'prototypeEditor.startingLivePreview': '我们正在启动实时预览，请稍候',
    'prototypeEditor.saveChanges': '保存更改',
    'prototypeEditor.deployChange': '部署更改',
    'prototypeEditor.confirmDeployment': '确认部署',
    'prototypeEditor.deploymentMayTakeTime':
      '此部署可能需要几分钟。您要继续吗？',
    'prototypeEditor.rememberToPublish':
      '提醒：部署后，您仍需要将应用发布到生产环境。',
    'prototypeEditor.mobilePreviewMode': '手机预览',
    'prototypeEditor.desktopPreviewMode': '桌面预览',
    'prototypeEditor.noChangesToSave': '没有需要保存的更改',

    // Code Diff Modal
    'codeDiff.title': '代码对比',
    'codeDiff.lastSaved': '上次保存',
    'codeDiff.currentChanges': '当前更改',
    'codeDiff.noSavedVersion': '未找到保存的版本',
    'codeDiff.loadingHistory': '正在加载版本历史...',
    'codeDiff.errorLoadingHistory': '加载版本历史失败',
    'codeDiff.modified': '已修改',
    'codeDiff.unchanged': '未修改',
    'codeDiff.viewChanges': '查看变更',
    'codeDiff.modifiedFiles': '已修改文件',
    'codeDiff.allFiles': '所有文件',
    'codeDiff.noModifications': '无修改',
    'codeDiff.selectFile': '选择文件查看变更',
    'codeDiff.comparisonMode': '对比模式',
    'codeDiff.currentVsSaved': '当前编辑器 vs 保存版本',
    'codeDiff.historyComparison': 'V{version} vs V{prevVersion}',
    'codeDiff.selectVersion': '选择要对比的版本',
    'codeDiff.noPreviousVersion': '这是第一个版本，没有上一个版本可以对比',
    'codeDiff.version': '版本 {version}',

    // Vercel Logs Modal
    'prototype.vercelLogs.noBuildLogs': '暂无构建日志',
    'prototype.vercelLogs.logsAvailableAfterDeployment':
      '构建日志将在部署完成后提供',
    'prototype.vercelLogs.download': '下载',
    'prototype.vercelLogs.noLogsToDownload': '没有可下载的{type}日志',
    'prototype.vercelLogs.downloaded': '已下载 {filename}',

    // Status Values
    'status.loading': '加载中',
    'status.ready': '已完成',
    'status.error': '错误',
    'status.created': '待开始',
    'status.started': '进行中',
    'status.completed': '已完成',
    'status.canceled': '已取消',
    'status.inreview': '代码审核中',
    'status.approved': '测试中',
    'status.generating': '生成中',
    'status.overwritten': '已覆盖',
    'status.active': '活跃',
    'status.inactive': '非活跃',
    'status.notStarted': '未开始',
    'status.inProgress': '进行中',
    'status.published': '已发布',

    // Additional Messages & Alerts
    'message.buildingProjectDeploy': '构建项目中...',
    'message.deploymentCompletedSuccess': '部署成功完成！',
    'message.documentIdRequiredSaving': '保存需要文档 ID',
    'message.failedToSaveFileEditor': '保存文件失败',
    'message.failedToLoadCommunityProjects': '加载社区项目失败',
    'message.projectLimitReached': '您已达到项目限制。请{upgradeLink}',
    'message.upgradePlan': '升级您的计划',

    // Backend Status Messages (for frontend translation)
    'deploying.app': '部署应用中...',
    'polishing.app': '优化应用中...',
    'deploying.document.prototype': '部署原型中...',
    'deploying.document.product': '部署产品中...',
    'Deployment complete': '部署完成',
    'Deployment failed. Please check the logs and try again.':
      '部署失败。请检查日志并重试。',
    'Build error. Please retry.': '生成错误。请重试。',

    // AI Agent Intro Messages
    'aiAgent.prd':
      '👋 我是 Joy，您的 AI 助手。开始时，您可以选择示例提示、上传本地文件或链接其他文档来创建下面的需求文档。',
    'aiAgent.prototype':
      '👋 我是 Joy，您的 AI 助手。开始时，您可以选择示例提示、链接其他需求文档或在下面与我聊天来创建原型。',
    'aiAgent.uiDesign':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您头脑风暴、回答问题、创建您需要的文档或应用。',
    'aiAgent.techDesign':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您为产品制作技术设计。',
    'aiAgent.developmentPlan':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您头脑风暴、回答问题、创建您需要的文档或应用。',
    'aiAgent.qaPlan':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您头脑风暴、回答问题、创建您需要的文档或应用。',
    'aiAgent.releasePlan':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您头脑风暴、回答问题、创建您需要的文档或应用。',
    'aiAgent.business':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您头脑风暴、回答问题、创建您需要的文档或应用。',
    'aiAgent.product':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您创建全栈产品。您可以在下面的聊天框中开始与我聊天。',
    'aiAgent.engineering':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您头脑风暴、回答问题、创建您需要的文档或应用。',
    'aiAgent.marketing':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您头脑风暴、回答问题、创建您需要的文档或应用。',
    'aiAgent.sales':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您头脑风暴、回答问题、创建您需要的文档或应用。',
    'aiAgent.support':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您头脑风暴、回答问题或创建您需要的文档。',
    'aiAgent.chat':
      '👋 我是 Joy，您的 AI 助手。我可以帮助您头脑风暴、回答问题或讨论您感兴趣的任何事情。',

    // AI Agent Sample Prompts
    'samplePrompts.prd.buildWebApp': '构建一个 Web 应用...',
    'samplePrompts.prd.addFeature': '添加一个功能...',
    'samplePrompts.prototype.buildWebApp': '构建一个 Web 应用...',
    'samplePrompts.prototype.addFeature': '添加一个功能...',
    'samplePrompts.uiDesign.createWireframe':
      '我们希望支持所选 Omniflow 需求文档中定义的所有关键功能需求。请为其创建 UI 设计线框图。',
    'samplePrompts.techDesign.createTechnicalDesign':
      '我们希望支持所选 Omniflow 需求文档中定义的所有关键功能需求。请使用微服务架构和现代技术栈，如 ReactJS、NodeJS 和 LLM 模型。请帮助我们编写技术设计。',
    'samplePrompts.qaPlan.createTestPlan':
      '请为所选的产品需求文档创建 QA 测试计划。',
    'samplePrompts.releasePlan.createReleasePlan':
      '请基于所选的产品需求文档创建发布计划。',
    'samplePrompts.chat.buildAIApp':
      '我想构建一个新的 AI 应用来自动化我的产品开发生命周期。您能分享一些建议吗？',
    'samplePrompts.chat.soc2Compliance':
      '我想启动一个项目来实现我们产品的 SOC 2 合规性。我应该如何着手？',

    // MyIssues Sections
    'myIssues.recentApps': '最近的应用',
    'myIssues.recentPrds': '最近的需求文档',
    'myIssues.plannedSchedule': '计划时间表',
    'myIssues.projectOrWorkPlanName': '项目或工作计划名称',

    // Issue Types
    'issueType.buildable': '可构建',
    'issueType.epic': '史诗',
    'issueType.story': '用户故事',
    'issueType.task': '任务',
    'issueType.subtask': '子任务',
    'issueType.bug': '缺陷',

    // Issue Status
    'issueStatus.created': '已创建',
    'issueStatus.started': '已开始',
    'issueStatus.generating': '生成中',
    'issueStatus.inreview': '审核中',
    'issueStatus.approved': '已批准',
    'issueStatus.completed': '已完成',
    'issueStatus.canceled': '已取消',
    'issueStatus.overwritten': '已覆盖',

    // Common Components
    'common.uiPreview': 'UI 预览',
    'common.viewCode': '查看代码',
    'common.previewApp': '预览应用',
    'common.upgradePlanToViewCode': '升级订阅以查看代码',
    'common.uiEditor':
      'UI 编辑器（您可以输入设计 URL 或更新 HTML 代码来更新 UI 预览）',
    'common.uploadImage': '上传图片',
    'common.preview': '预览',
    'common.owner': '负责人',
    'common.progress': '进度',
    'common.templateInUse': '使用中的模板：{name}',
    'common.pickTemplate': '选择模板',
    'common.createRequirementSpec': '创建需求规格',
    'common.generatePrototype': '生成原型',
    'common.buildFinalProduct': '构建最终产品',
    'common.wait': '等待',
    'common.process': '进行中',
    'common.finish': '完成',
    'common.productRequirement': '产品需求、技术设计、测试/发布计划',
    'common.prd': '需求文档',
    'common.prototype': '原型',
    'common.prototypeDesc': '原型、UI/UX 设计',
    'common.product': '产品',
    'common.productDesc': '全栈产品、部署',
    'common.upgradeToPerformance': '升级到性能计划以获得访问权限',
    'common.upgradeToBusiness': '升级到商业计划以获得访问权限',
    'common.aiGenerating': 'AI 正在生成响应...',
    'common.errorOccurred': '发生错误。请重试。',
    'common.makeShorter': '缩短',
    'common.makeLonger': '延长',
    'common.simplify': '简化',
    'common.expand': '扩展',
    'common.changeTone': '改变语调',
    'common.completeSentence': '完成句子',
    'common.inviteUser': '邀请用户',
    'common.addVirtualTeammate': '添加虚拟队友',
    'common.maxTeamCountReached': '已达到最大团队数量。请升级您的计划。',
    'common.normalText': '普通文本',
    'common.heading': '标题',
    'common.heading1': '标题 1',
    'common.heading2': '标题 2',
    'common.heading3': '标题 3',
    'common.prdGenerated': '您的 PRD 已生成。您可以继续在下方编辑。',
    'common.docGenerated': '您的文档已生成。您可以继续在下方编辑。',
    'common.noContentAvailable': '无可用内容',
    'common.selectOwner': '选择负责人',
    'common.errorLoadingProfile': '加载用户配置文件时出错：{error}',
    'common.notStarted': '未开始',
    'common.inProgress': '进行中',
    'common.published': '已发布',

    // Project Status
    'projectStatus.notStarted': '未开始',
    'projectStatus.inProgress': '进行中',
    'projectStatus.published': '已发布',

    // App Utilities
    'app.monthlyCreditsUsedUp':
      '您已用完月度积分。您可以购买更多积分、升级账户或分享赚取。',
    'app.outOfCredits':
      '您目前没有积分。您可以购买更多积分、升级账户或分享赚取。',
    'app.databaseUrlRequired': '请填写数据库 URL 和 JWT 密钥。',
    'app.sampleTask':
      '实现一个允许用户更新其个人资料的功能，就像您看到的页面一样。\n\n描述：1) 添加一个 UI 表单来显示用户的当前个人资料，包括名字、姓氏、用户名。2) 构建后端逻辑来保存更新的信息。3) 完成后将页面重定向到主页。\n验收标准：1) 用户可以查看其当前个人资料信息。2) 用户可以成功更新其姓名和用户名。3) 更改保存到数据库。',
    'app.viewOnlyMode': '您当前处于仅查看模式',

    // Chat Components
    'chat.addNameRequired': '请为此想法添加名称',
    'chat.enterNamePlaceholder': '输入此想法的名称',
    'chat.selectAccessRequired': '请选择谁可以访问此想法',
    'chat.save': '保存',
    'chat.uploadFileTypeError': '请上传图片、word、txt 或 pdf 文件。',
    'chat.contentEmpty': '聊天内容不能为空',
    'chat.loadingHistoryError': '加载聊天历史记录，请稍后重试。',
    'chat.samplePrompt': '示例提示',
    'chat.uploadFile': '添加文件/功能',
    'chat.uploadFileAction': '上传文件',
    'chat.inputPlaceholder':
      '请输入您的问题或指令。您也可以上传或标记文档以提供额外上下文。',
    'chat.uploading': '上传中...',
    'chat.currentIdeas': '当前想法',
    'chat.noIdeasAvailable': '没有可用的想法',
    'chat.newIdea': '新想法',
    'chat.deleteConfirm': '您确定要删除此聊天吗？',
    'chat.delete': '删除',

    // DevPlan Components
    'devplan.addNewDocument': '添加新文档',
    'devplan.selectDocumentOrAdd': '请选择文档或添加新文档',
    'devplan.prefixNameWithTaskType':
      '请在名称前加上任务类型前缀，例如"[前端]"',
    'devplan.pointsRequired': '需要填写积分',
    'devplan.descriptionsRequired': '需要填写描述',
    'devplan.taskDescriptionPlaceholder': '任务描述',
    'devplan.deleteConfirm': '您确定要删除此{type}吗？',
    'devplan.addNewRole': '添加新角色',
    'devplan.roles': '角色',
    'devplan.addRolesNeeded': '添加工作所需的角色',
    'devplan.inviteUser': '邀请用户',
    'devplan.maxTeamCountReached': '已达到最大团队数量。请升级您的计划。',
    'devplan.addVirtualTeammate': '添加虚拟团队成员',
    'devplan.upgradeToPerformance': '升级到性能计划以获得访问权限',
    'devplan.teamMembers': '团队成员',
    'devplan.inviteTeamOrAddVirtual': '邀请团队或添加虚拟团队成员',
    'devplan.rolesNeeded': '所需角色',
    'devplan.selectRolesNeeded': '请选择或添加所需角色',
    'devplan.addRolesTooltip': '添加完成此项目所需的团队角色',
    'devplan.teamMembersLabel': '团队成员：',
    'devplan.selectTeamMembers': '您必须选择团队成员',
    'devplan.teamTooltip':
      '您可以邀请您的团队，或者通过从下拉菜单中选择来创建虚拟团队成员',
    'devplan.teamPlaceholder': '邀请团队或通过从下拉菜单选择添加虚拟团队成员',
    'devplan.startDate': '开始日期',
    'devplan.warning': '警告',
    'devplan.overwriteWarning':
      '这将覆盖当前的开发计划，包括任何当前的工作项目和状态',
    'devplan.continueQuestion': '您要继续吗？',
    'devplan.generateTask': '生成任务',
    'devplan.confirmSchedule': '确认时间表',
    'devplan.reviewWork': '审查工作',
    'devplan.publishDevPlan': '发布开发计划',
    'devplan.taskBreakdown': '开发计划',
    'devplan.workSchedule': '工作安排',
    'devplan.tasksNotGenerated': '任务尚未生成',
    'devplan.addRolesFirst': '请先在上面添加所需角色，然后再创建开发计划。',
    'devplan.publishPrdFirst': '请先发布PRD，然后再创建开发计划。',
    'devplan.addTeamAndDate': '请在上面添加团队成员和项目开始日期。',
    'devplan.createTaskBreakdown': '请先创建任务分解并审查工作项目',
    'devplan.newTask': '添加任务',
    'devplan.newStory': '添加用户故事',
    'devplan.newEpic': '添加大型需求',
    'devplan.reviewWorkTitle': '审查工作',
    'devplan.reviewWorkDescription': '大型需求、用户故事、任务',
    'devplan.confirmScheduleTitle': '确认时间表',
    'devplan.confirmScheduleDescription': '里程碑、冲刺',
    'devplan.publishTitle': '发布开发计划',
    'devplan.publishMessage':
      '我们目前只支持在项目内发布开发计划。请先添加项目，然后再发布开发计划。',
    'devplan.addProject': '添加项目',

    // Document Components
    'document.save': '保存',
    'document.selectAccessRequired': '请选择谁可以访问此项目',
    'document.chooseDocumentType': '请选择文档类型',
    'document.enterDocumentName': '输入文档名称',
    'document.addDocumentNameRequired': '请添加文档名称',
    'document.name': '名称',
    'document.type': '类型：',
    'document.currentApps': '当前应用',
    'document.noAppsAvailable': '没有可用的应用',
    'document.newApp': '新应用',
    'document.domain': '域名',
    'document.auth': '注册登录',
    'document.uploading': '上传中...',
    'document.uploadFile': '上传文件',
    'document.pickSamplePrompt': '选择示例提示',
    'document.createPrototype': '基于链接的需求文档创建原型',
    'document.createProduct': '创建具有完整前端、后端、数据库的产品',
    'document.generationInProgress': '文档生成正在进行中。请稍后重试。',
    'document.waitForChatHistory': '请等待聊天历史记录加载...',
    'document.loadingChatHistoryError': '加载聊天历史记录，请稍后重试。',
    'document.chatContentEmpty': '聊天内容不能为空！',
    'document.failedToUploadLogo': '上传徽标失败，请稍后重试。',
    'document.logoVerbs':
      'use,change,apply,update,replace,modify,switch,swap,redesign,使用,更改,应用,用,更新,替换,修改,切换,交换,重新设计',
    'document.thinking': '思考中...',
    'document.clearChat': '清空',
    'document.chatCleared': '聊天已清空。',
    'document.chatClearFailed': '重置聊天会话失败，请稍后重试。',

    // Document Components Extended
    'document.copy': '复制',
    'document.edit': '编辑',
    'document.generateDoc': '生成文档',
    'document.noDocumentFound': '未找到文档',
    'document.documents': '文档',
    'document.searchByFileName': '按文件名搜索',
    'document.linkDocument': '链接文档',
    'document.publishedSuccessfully': '"{name}" 发布成功。',
    'document.saveFirst': '请先保存文档',
    'document.requestSentSuccessfully': '请求发送成功',
    'document.failedToCompleteAI': '完成 AI 响应失败。请重试。',
    'document.sendMessage': '发送消息',
    'document.addFeedbackOrQuestion': '添加您的反馈或向 Joy 提问',
    'document.enterInstructions':
      '请输入您的指令。您也可以上传或链接文档以提供额外上下文。',
    'document.fullScreen': '全屏',
    'document.chatWithJoyToCreate': '在左侧聊天框中与 Joy 聊天来创建您的',
    'document.orClickToEdit': '或点击此处直接编辑、复制/粘贴内容',
    'document.versionNotFound': '在文档历史记录中未找到版本 {versionNumber}。',
    'document.errorFetchingHistory': '获取历史版本时出错。',
    'document.viewDocumentHistory': '查看文档历史记录',
    'document.hideSidepanel': '隐藏聊天',
    'document.showSidepanel': '显示聊天',
    'document.documentHistory': '文档历史记录',
    'document.upgradePlanForFullHistory': '升级计划以获得完整历史记录',
    'document.upgradePlanForFullVersionHistory':
      '升级计划以获得完整版本历史记录',
    'document.currentRequirements': '当前需求',
    'document.noDocumentsAvailable': '没有可用的文档',
    'document.owner': '所有者',
    'document.access': '访问权限',
    'document.createdAt': '创建时间',
    'document.action': '操作',
    'document.enterYourEmail': '输入您的邮箱',
    'document.invalidEmailAddress': '无效的邮箱地址',
    'document.pleaseInputEmail': '请输入您的邮箱。',
    'document.enterEmailToContinue': '输入邮箱以继续',
    'document.noPreviewAvailable': '暂无预览',
    'document.appNotDeployed': '应用尚未部署',
    'document.devPlanNotExist': '此项目的开发计划不存在。请先创建一个。',
    'document.failedToPrepareDevPlan': '准备开发计划生成失败。',
    'document.failedToParseContents': '解析文档内容失败。',
    'document.noFilesToPublish': '没有可发布的文件。',
    'document.rateLatestGeneration': '评价最新生成：',
    'document.veryPoor': '很差',
    'document.needsImprovement': '需要改进',
    'document.acceptable': '可接受',
    'document.good': '良好',
    'document.excellent': '优秀',
    'document.thankYouForFeedback': '感谢您的反馈！',
    'document.submit': '提交',
    'document.selectRolesPlaceholder': '选择人力（例如：前端、后端）',
    'document.selectTeamRolesLabel': '选择交付此项目所需的人力',
    'document.selectTeamRolesTooltip': '如果不确定，请保持为全栈工程师',
    'document.makeProduct': '制作产品',
    'document.accessDenied': '访问被拒绝',
    'document.noAccessToDocument': '您无权访问此文档。请在下方请求访问权限。',
    'document.requestAccess': '请求访问权限',
    'document.messageOptional': '消息（可选）',
    'document.imageUploadWarning': '图片上传到 S3 失败，但仍可用于生成。',
    'document.imageUploadFailed': '上传图片到服务器失败，请重试。',
    'document.imageCompressionFailed': '处理图片失败，请重试。',
    'document.filesStillUploading': '请等待所有文件上传完成',
    'document.fileTooLarge': '文件大小超过 10MB 限制。',
    'document.unsupportedImageType': '不支持的图片类型。',
    'document.invalidFileType': '无效的文件类型。',
    'document.uploadError': '文件上传失败。',
    // Document Types
    'document.label': '文档',
    'document.prd': '需求文档',
    'document.prdSubtitle': '收集、分析产品需求',
    'document.uiDesign': 'UI/UX 设计',
    'document.uiDesignSubtitle': '使用 HTML/CSS 创建 UIUX 设计',
    'document.prototype': '原型',
    'document.designPrototype': '设计原型',
    'document.product': '产品',
    'document.prototypeSubtitle': '生成功能完整的原型',
    'document.techDesign': '技术设计',
    'document.techDesignSubtitle': '创建技术架构',
    'document.developmentPlan': '开发计划',
    'document.developmentPlanSubtitle': '构建产品化执行计划',
    'document.qaPlan': 'QA 和测试计划',
    'document.qaPlanSubtitle': '自动化 QA 测试用例和计划',
    'document.releasePlan': '发布计划',
    'document.releasePlanSubtitle': '创建发布流程和计划',
    'document.marketing': '营销',

    // Home Components
    'home.createDocument': '创建文档',
    'home.newDocumentName': '新文档名称',
    'home.documentType': '文档类型',
    'home.cancel': '取消',
    'home.go': '开始',
    'home.generateDocsDescription': '生成 PRD、设计文档、工程图表等。',
    'home.generateDevTasks': '生成开发任务',
    'home.enterDevPlanName': '输入开发计划名称',
    'home.generateDevTasksDescription': '分解技术任务、估算和安排开发计划。',
    'home.whatToBuildToday': '您希望 Omniflow 今天构建什么？',
    'home.buildMobileApp': '构建移动应用',
    'home.startBlog': '开始搭建博客',
    'home.scaffoldUI': '使用 shadcn 搭建 UI',
    'home.craftRequirement': '制作需求',
    'home.enterRequirementName': '输入需求文档名称',
    'home.craftRequirementDescription': '将想法转化为高质量的产品需求文档',
    'home.buildProject': '开始创建',
    'home.failedToReadFile': '读取上传文件失败。',
    'home.createApp': '创建应用',
    'home.enterAppName': '输入应用名称',
    'home.createAppDescription':
      '将需求转化为简单的应用，如网站、游戏或原型，只需几分钟。',
    'home.createTechDesign': '创建技术设计',
    'home.createTechDesignDescription': '创建技术架构、工程设计。',
    'home.failedToLoadCommunityProjects': '加载社区项目失败',
    'home.projectIdNotAvailable': '项目 ID 不可用于复制',
    'home.projectClonedSuccessfully':
      '项目 "{name}" 已成功复制为 "{clonedName}"',
    'home.failedToCloneProject': '复制项目失败。请重试。',
    'home.by': '作者',

    // Community Filter Labels
    'community.all': '全部',
    'community.aiNative': 'AI 原生',
    'community.smbPortal': '门户网站',
    'community.saas': 'SaaS',
    'community.internalTool': '内部工具',

    // Layout
    'layout.lowCredits': '您的积分不足。',
    'layout.editProject': '编辑项目',
    'layout.cloneProject': '复制项目',
    'layout.deleteProject': '删除项目',
    'layout.cloneProjectConfirm':
      '您确定要复制 "{projectName}" 吗？这将创建一个具有相同数据的新项目。',
    'layout.loading': '加载中',
    'layout.pleaseWait': '请稍等片刻...',
    'layout.maxSeatsReached': '您已达到最大席位数量。请',
    'layout.upgradeAccount': '升级您的账户',
    'layout.toAddMoreSeats': '以添加更多席位。',
    'layout.noDocumentsAvailable': '暂无可用',

    // Organization
    'organization.unauthorized': '未授权',
    'organization.notAuthorized': '您无权查看此页面。',
    'organization.jiraIntegration': 'JIRA 集成',
    'organization.accountAuthorization': '账户授权：',
    'organization.connectWithJira': '连接 JIRA',
    'organization.jiraConnected': 'JIRA 已连接',
    'organization.jiraUserProfile': 'Jira 用户档案：',
    'organization.jiraResources': 'Jira 资源：',
    'organization.accessToken': '访问令牌：',
    'organization.connectingToBitbucket': '正在连接到 Bitbucket...',
    'organization.disconnectGitHub': '断开 GitHub',
    'organization.connectWithGitHub': '连接 GitHub',
    'organization.connectWithBitbucket': '连接 Bitbucket',
    'organization.disconnectBitbucket': '断开 Bitbucket',
    'organization.linkJiraTooltip': '将您的 JIRA 账户链接到您的个人资料。',
    'organization.name': '名称',
    'organization.url': '网址',
    'organization.noProjectsAvailable': '暂无可用项目',
    'organization.newProject': '新建项目',
    'organization.cardView': '卡片视图',
    'organization.listView': '列表视图',
    'organization.searchProjects': '搜索项目...',
    'organization.noProjectsFound': '未找到项目',

    // Document Generation
    'generation.updatingDocument': '更新{docType}...',
    'generation.creatingDocument': '创建{docType}...',
    'generation.updatingForYou': '正在为您更新{docType}...',
    'generation.creatingForYou': '正在为您创建{docType}...',
    'generation.stopGeneration': '停止生成',
    'generation.cancelled': '生成已取消',
    // Login
    'login.title': 'Omniflow AI',
    'login.lastUsed': '上次使用',
    'login.signInWithGoogle': '使用 Google 登录',
    'login.signInWithEmail': '使用邮箱登录',
    'login.email': '邮箱',
    'login.emailPlaceholder': '请输入邮箱',
    'login.password': '密码',
    'login.passwordPlaceholder': '请使用大小写字母和特殊字符',
    'login.confirmPassword': '确认密码',
    'login.confirmPasswordPlaceholder': '请确认密码',
    'login.forgotPassword': '忘记密码？',
    'login.createAccount': '没有账户？创建您的账户',
    'login.signIn': '登录',
    'login.signUp': '注册',
    'login.welcomeBack': '欢迎回来',
    'login.getStarted': '开始使用',

    // Database
    'database.title': '数据库设置',
    'database.url': '数据库 URL',
    'database.jwtSecret': 'JWT 密钥',
    'database.connect': '连接',
    'database.disconnect': '断开连接',
    'database.tables': '数据表',
    'database.selectTable': '选择一个数据表',
    'database.loadData': '加载数据',
    'database.deleteSettings': '删除数据库设置',
    'database.deleteConfirm':
      '您确定要删除数据库并清除所有数据库信息吗？此操作无法撤销。',
    'database.configuration': '数据库配置',
    'database.jwtToken': 'JWT 密钥',
    'database.edit': '编辑',
    'database.delete': '删除',
    'database.autoCreate': '自动创建',
    'database.autoCreateTooltip':
      '默认情况下，我们将自动生成 PostgreSQL 数据库并配置它。',
    'database.placeholder': '粘贴您的数据库连接字符串',
    'database.jwtPlaceholder': '在此粘贴您的 JWT 密钥',
    'database.jwtRequired': 'Supabase 需要 JWT 令牌',
    'database.saveSettings': '保存设置',
    'database.cancel': '取消',
    'database.columns': '列',
    'database.selectTableData': '选择对应的表 查看其数据',
    'database.noTables': '没有可用的表',
    'database.noTablesDesc': '连接到包含现有表的数据库后，表将显示在此处。',
    'database.totalItems': '共 {total} 项',
    'database.passwordHidden': '密码（已隐藏）',
    'database.searchPlaceholder': '搜索...',
    'database.search': '搜索',
    'database.reset': '重置',
    'database.items': '条',
    'database.selectTableToView': '从左侧选择一个表以查看其数据',
    'database.editRecord': '编辑记录',
    'database.primaryKeyNotEditable': '主键（不可编辑）',
    'database.noDatabaseConfigured': '未配置数据库',
    'database.pleaseConfigure': '请先在配置选项卡中配置您的数据库。',
    'database.saveFailed': '保存数据库设置失败',
    'database.deleteSuccess': '设置删除成功',
    'database.deleteFailed': '删除设置失败',
    'database.createSuccess': '数据库创建成功',
    'database.exportSelected': '导出选中',
    'database.exportAll': '导出全部',
    'database.noDataToExport': '没有可导出的数据',
    'database.newRecord': '新记录',
    'database.selectSearchFields': '在字段中搜索...',
    'database.recordInserted': '记录插入成功',
    'database.recordUpdated': '记录更新成功',
    'database.recordInsertFailed': '插入记录失败',
    'database.recordUpdateFailed': '更新记录失败',
    'database.systemFieldNotEditable': '系统字段（不可编辑）',
    'database.importCsv': '导入 CSV',
    'database.importing': '导入中...',
    'database.importSummary': '导入完成',
    'database.importFailed': '导入失败',
    'database.deleteSelected': '删除选中',
    'database.deleteSelectedConfirm': '确定要删除选中记录吗？',
    'database.clearTable': '清空表格',
    'database.clearTableConfirm': '确定要清空表格吗？',
    'database.clearFailed': '清空表格失败',
    'database.tableCleared': '表格清空成功',
    'database.noRowsSelected': '没有选中任何记录',
    'database.clear': '清空',
    'database.sqlEditor': 'SQL 编辑器',
    'database.executeSql': '执行 SQL',
    'database.sqlQuery': 'SQL 查询',
    'database.queryResults': '查询结果',
    'database.queryHistory': '查询历史',
    'database.savedQueries': '已保存查询',
    'database.saveQuery': '保存查询',
    'database.queryName': '查询名称',
    'database.queryDescription': '查询描述',
    'database.executeTime': '执行时间',
    'database.rowsAffected': '影响行数',
    'database.noResults': '无结果显示',
    'database.sqlExecutionFailed': 'SQL 执行失败',
    'database.sqlExecutionSuccess': 'SQL 执行成功',
    'database.querySaved': '查询保存成功',
    'database.queryDeleted': '查询删除成功',
    'database.loadQuery': '加载查询',
    'database.deleteQuery': '删除查询',
    'database.exportResults': '导出结果',
    'database.onlyDmlAllowed': '仅允许 SELECT、INSERT、UPDATE、DELETE 语句',
    'database.caseSensitiveHint':
      '提示：使用双引号保持标识符大小写（例如："Users" 而非 Users）',
    'database.sqlPlaceholder':
      '在此输入 SQL 查询...\n示例: SELECT * FROM users LIMIT 10;',
    'database.resultsTruncated': '结果已截断至 1000 行',
    // Document History
    'history.title': '版本历史',
    'history.current': '当前',
    'history.preview': '预览',
    'history.restore': '恢复',
    'history.restoring': '恢复中...',
    'history.loading': '加载中...',

    // Document Settings Modal
    'settings.title': '设置',
    'settings.prototypeTitle': '原型设置',
    'settings.productTitle': '产品设置',
    'settings.database': '数据库',
    'settings.files': '文件',
    'settings.payment': '支付',
    'settings.aiModel': '模型设置',
    'settings.environment.preview': '预览',
    'settings.environment.production': '生产',
    'settings.apiKeys': 'API 密钥',
    'settings.domain': '域名',
    'settings.resetApp': '重置应用',
    'settings.cancel': '取消',
    'settings.saveAll': '保存全部',
    'settings.unsavedChanges': '您有未保存的更改。确定要不保存就关闭吗？',
    'settings.email': '邮箱',
    'settings.users': '用户管理',
    'settings.knowledgeBase': '知识库',

    // Knowledge Base Tab
    'knowledgeBase.selectKnowledgeBases': '选择知识库',
    'knowledgeBase.weight': '权重',
    'knowledgeBase.testConnection': '测试连接',
    'knowledgeBase.connectionSuccess': '连接成功',
    'knowledgeBase.connectionFailed': '连接失败',
    'knowledgeBase.saveSuccess': '知识库设置保存成功',
    'knowledgeBase.saveFailed': '保存知识库设置失败',
    'knowledgeBase.weightDesc':
      '更高的权重在搜索结果中赋予此知识库更高的优先级（1-10）',
    'knowledgeBase.loading': '加载知识库中...',
    'knowledgeBase.setting.description':
      '为应用程序中的 RAG 功能选择和配置知识库。',
    'knowledgeBase.selected': '已选择',
    'knowledgeBase.fileCount': '{count} 个文件',
    'knowledgeBase.lastUpdated': '最后更新：{date}',
    'knowledgeBase.noDescription': '无描述',
    'knowledgeBase.testing': '测试中...',
    'knowledgeBase.save': '保存配置',

    // Files Tab
    'files.upload': '点击或拖拽文件到此处上传',
    'files.listView': '列表',
    'files.gridView': '预览',
    'files.copyLink': '复制链接',
    'files.linkCopied': '链接已复制',
    'files.delete': '删除',
    'files.deleteConfirm': '确定要删除该文件吗？',
    'files.quota': '存储配额',
    'files.overQuota': '上传超出配额（每个项目 1GB）',
    'files.empty': '暂无文件',
    'files.preview': '预览',
    'files.loadFailed': '加载文件失败',
    'files.loadQuotaFailed': '加载配额失败',
    'files.uploadSuccess': '上传成功',
    'files.uploadFailed': '上传失败',
    'files.deleteSuccess': '删除成功',
    'files.deleteFailed': '删除失败',
    'files.name': '文件名',
    'files.size': '大小',
    'files.updatedAt': '更新时间',
    'files.actions': '操作',

    // Common
    'common.loadMore': '加载更多',
    // Stripe Tab
    'stripe.configuration': 'Stripe 配置',
    'stripe.readOnlyDesc': 'Stripe 支付集成设置。',
    'stripe.secretKey': 'Stripe 密钥：',
    'stripe.secretKeyDesc': '用于服务器端的 Stripe 密钥。',
    'stripe.publishedKey': 'Stripe 发布密钥：',
    'stripe.publishedKeyDesc': '用于客户端的 Stripe 发布密钥。',
    'stripe.noPermission': '您没有修改这些设置的权限。',
    'stripe.settingsDesc': '您的 Stripe 支付集成设置。',
    'stripe.settingsUpdated': '设置已更新',
    'stripe.settingsUpdatedDesc':
      '更改 Stripe 设置后，请更新聊天框中的预填消息并发送给 Joy 以使用新的支付配置更新您的产品。',
    'stripe.configureDesc': '通过输入您的 API 密钥来配置 Stripe 支付集成。',
    'stripe.secretKeyPlaceholder': '输入您的 Stripe secret key (sk_...)',
    'stripe.secretKeyHelp': '用于服务器端操作的 Stripe secret key, 请妥善保管',
    'stripe.publishedKeyPlaceholder':
      '输入您的 Stripe publishable key (pk_...)',
    'stripe.publishedKeyHelp': '用于客户端操作的 Stripe publishable key',
    'stripe.saving': '保存中...',
    'stripe.configuring': '配置中...',
    'stripe.saveKeys': '保存 Stripe 密钥',
    'stripe.unsavedChanges': '⚠️ 您有未保存的更改',

    // Email Configuration Tab
    'email.configuration': '邮件配置',
    'email.configDesc':
      '为您的应用配置单个邮件服务商。环境变量将保存到文档设置并同步到 Vercel。',
    'email.onlyOneProvider': '一次只能启用一个邮件服务商。',
    'email.provider': '服务商',
    'email.selectProvider': '请选择一个服务商',
    'email.fromEmail': '发件人邮箱',
    'email.fromEmailRequired': '发件人邮箱为必填项',
    'email.invalidEmail': '无效的邮箱地址',
    'email.fromEmailPlaceholder': 'no-reply@example.com',
    'email.adminEmail': '管理员邮箱',
    'email.adminEmailPlaceholder': 'admin@example.com',
    'email.saveSettings': '保存设置',
    'email.settingsSaved': '邮件设置已保存',
    'email.settingsFailed': '保存邮件设置失败',
    'email.documentIdRequired': '文档 ID 为必填项',
    // SMTP
    'email.smtpHost': 'SMTP 主机',
    'email.smtpHostRequired': 'SMTP 主机为必填项',
    'email.smtpHostPlaceholder': 'smtp.example.com',
    'email.smtpPort': 'SMTP 端口',
    'email.smtpPortRequired': 'SMTP 端口为必填项',
    'email.smtpPortPlaceholder': '465',
    'email.useTlsSsl': '使用 TLS/SSL',
    'email.smtpUser': 'SMTP 用户名',
    'email.smtpUserRequired': 'SMTP 用户名为必填项',
    'email.smtpUserPlaceholder': 'user@example.com',
    'email.smtpPassword': 'SMTP 密码',
    'email.smtpPasswordRequired': 'SMTP 密码为必填项',
    'email.smtpPasswordPlaceholder': '••••••••',
    // SendGrid
    'email.sendgridApiKey': 'SendGrid API 密钥',
    'email.sendgridApiKeyRequired': 'SendGrid API 密钥为必填项',
    'email.sendgridApiKeyPlaceholder': 'SG.xxxxx',
    // Mailgun
    'email.mailgunApiKey': 'Mailgun API 密钥',
    'email.mailgunApiKeyRequired': 'Mailgun API 密钥为必填项',
    'email.mailgunApiKeyPlaceholder': 'key-xxxxx',
    'email.mailgunDomain': 'Mailgun 域名',
    'email.mailgunDomainRequired': 'Mailgun 域名为必填项',
    'email.mailgunDomainPlaceholder': 'mg.example.com',
    // Resend
    'email.resendApiKey': 'Resend API 密钥',
    'email.resendApiKeyRequired': 'Resend API 密钥为必填项',
    'email.resendApiKeyPlaceholder': 're_xxxxx',
    // AWS SES
    'email.awsRegion': 'AWS 区域',
    'email.awsRegionRequired': 'AWS 区域为必填项',
    'email.awsRegionPlaceholder': 'us-east-1',
    'email.awsAccessKeyId': 'AWS 访问密钥 ID',
    'email.awsAccessKeyIdRequired': 'AWS 访问密钥 ID 为必填项',
    'email.awsSecretAccessKey': 'AWS 密钥',
    'email.awsSecretAccessKeyRequired': 'AWS 密钥为必填项',

    'stripe.products': '产品',
    'stripe.productsDesc': '选择您想在应用程序中展示的产品。',
    'stripe.apiKeyRequired': '需要 Stripe API 密钥',
    'stripe.configureKeyFirst': '请先在配置选项卡中配置您的 Stripe 密钥。',
    'stripe.fetchProductsFailed': '获取 Stripe 产品失败',
    'stripe.selectAtLeastOne': '请至少选择一个产品',
    'stripe.updateProductsFailed': '更新产品失败',
    'stripe.productsUpdated':
      '产品更新成功,告诉 Joy 集成 Stripe 并触发重新部署。',
    'stripe.columnSelect': '选择',
    'stripe.columnProductName': '产品名称',
    'stripe.columnPrice': '价格',
    'stripe.columnType': '类型',
    'stripe.columnDescription': '描述',
    'stripe.typeSubscription': '订阅',
    'stripe.typeOneTime': '一次性',
    'stripe.saveSelectedProducts': '保存已选产品',
    'stripe.saveSelectedProductsCount': '保存已选产品 ({count})',
    'stripe.fetchProducts': '从 Stripe 获取产品',
    'stripe.loadingProducts': '加载产品中...',
    'stripe.noProductsFound': '未找到产品',
    'stripe.noProductsDesc': '点击"从 Stripe 获取产品"以加载您的 Stripe 产品。',
    // API Keys Tab
    'apiKeys.settings': 'API 密钥设置',
    'apiKeys.configDesc': '您的 API 密钥和 LLM 模型配置。',
    'apiKeys.manageDesc': '管理外部服务的 API 密钥和 LLM 模型配置。',
    'apiKeys.llmModelConfig': 'LLM 模型配置',
    'apiKeys.llmModelName': 'LLM 模型名称：',
    'apiKeys.omniflowApiKey': 'Omniflow API 密钥：',
    'apiKeys.apiKeyPlaceholder': '请输入您的 Omniflow API 密钥',
    'apiKeys.notConfigured': '未配置',
    'apiKeys.apiKeys': 'API 密钥 ({count})',
    'apiKeys.edit': '编辑',
    'apiKeys.apiKeyName': 'API 密钥名称',
    'apiKeys.apiKey': 'API 密钥',
    'apiKeys.actions': '操作',
    'apiKeys.deleteConfirm': '确定要删除此 API 密钥吗？',
    'apiKeys.yes': '是',
    'apiKeys.no': '否',
    'apiKeys.addApiKey': '添加 API 密钥',
    'apiKeys.noKeys': '未配置 API 密钥。',
    'apiKeys.noKeysDesc': '未配置 API 密钥。点击"添加 API 密钥"开始。',
    'apiKeys.saveAllChanges': '保存所有更改',
    'apiKeys.fillAll': '请填写所有 API 密钥名称和值',
    'apiKeys.duplicateRemoved': '已删除重复的 API 密钥名称',
    'apiKeys.documentIdRequired': '保存设置需要文档 ID',
    'apiKeys.saveSuccess': 'API密钥和保存成功',
    'apiKeys.saveFailed': '保存API密钥失败',
    'apiKeys.placeholder': '例如: OPENAI_API_KEY',
    'apiKeys.keyPlaceholder': '输入您的 API 密钥',
    'apiKeys.modelPlaceholder': '例如:gpt-4o-mini, gpt-4, claude-3-sonnet',
    'apiKeys.changeWarningTitle': '警告：API密钥更改',
    'apiKeys.changeWarningContent':
      '切换模型后请重新部署。另外，更改您的 Omniflow API密钥可能会影响使用此 API 密钥的项目。您需要重新部署这些项目以更新 API 密钥。',
    'apiKeys.redeploymentTitle': '重新部署应用',
    'apiKeys.redeploymentContent':
      '模型名称或 API 密钥已更新。是否立即重新部署应用以应用这些更改？',
    'apiKeys.redeploying': '正在重新部署应用...',
    'apiKeys.redeploymentSuccess': '应用重新部署成功',
    'apiKeys.redeploymentFailed': '重新部署失败',
    'apiKeys.redeploymentSkipped': '已跳过重新部署 - 未找到项目文件',
    'sync.deployingUpdatedCode': '正在部署更新的代码...',
    'sync.deploymentSuccessful': '部署成功',
    'sync.deploymentFailed': '部署失败：{error}',
    'common.ok': '确认',
    'common.more': '更多',
    'common.description': '描述',

    // Connectors Tab
    'connectors.title': '连接器',
    'connectors.description': '连接第三方服务、自定义API和MCP服务器',
    'connectors.apps': '应用',
    'connectors.customApi': '自定义API',
    'connectors.customMcp': '自定义MCP',
    'connectors.noConnectors': '尚未配置连接器',
    'connectors.addConnector': '添加连接器',
    'connectors.connected': '已连接',
    'connectors.notConnected': '未连接',
    'connectors.connect': '连接',
    'connectors.disconnect': '断开连接',
    'connectors.testConnection': '测试连接',
    'connectors.edit': '编辑',
    'connectors.delete': '删除',
    'connectors.deleteConfirm': '确定要删除此连接器吗？',
    'connectors.saveSuccess': '连接器保存成功',
    'connectors.saveFailed': '连接器保存失败',
    'connectors.deleteSuccess': '连接器删除成功',
    'connectors.deleteFailed': '连接器删除失败',
    'connectors.testSuccess': '连接测试成功',
    'connectors.testFailed': '连接测试失败',

    // App Connectors
    'connectors.apps.title': 'OAuth 应用',
    'connectors.apps.description': '连接基于OAuth的第三方应用',
    'connectors.apps.gmail': 'Gmail',
    'connectors.apps.googleCalendar': 'Google 日历',
    'connectors.apps.notion': 'Notion',
    'connectors.apps.github': 'GitHub',
    'connectors.apps.slack': 'Slack',
    'connectors.apps.outlook': 'Outlook邮件',
    'connectors.apps.asana': 'Asana',
    'connectors.apps.linear': 'Linear',
    'connectors.apps.clickup': 'ClickUp',
    'connectors.apps.connecting': '正在连接...',
    'connectors.apps.oauthSuccess': 'OAuth 连接成功',
    'connectors.apps.oauthFailed': 'OAuth 连接失败',

    // Custom API Connectors
    'connectors.customApi.title': '自定义API',
    'connectors.customApi.description': '添加带环境变量的自定义API',
    'connectors.customApi.addNew': '添加自定义API',
    'connectors.customApi.name': '名称',
    'connectors.customApi.namePlaceholder': '我的API服务',
    'connectors.customApi.descriptionPlaceholder':
      '提供API文档或说明，告诉Omniflow如何以及何时使用此API',
    'connectors.customApi.iconUrl': '图标URL（可选）',
    'connectors.customApi.iconUrlPlaceholder': 'https://example.com/icon.png',
    'connectors.customApi.docsUrl': '文档URL（可选）',
    'connectors.customApi.docsUrlPlaceholder': 'https://api.example.com/docs',
    'connectors.customApi.envVars': '环境变量',
    'connectors.customApi.envVarKey': '变量名称',
    'connectors.customApi.envVarValue': '值',
    'connectors.customApi.addEnvVar': '添加变量',
    'connectors.customApi.notes': '备注（可选）',
    'connectors.customApi.notesPlaceholder': '为LLM提供的额外信息',
    'connectors.customApi.envVarsTooltip':
      '这里设置的环境变量将同步到您的部署环境。变量名称不能与系统保留名称冲突（DATABASE_URL、JWT_SECRET 等）。',
    'connectors.customApi.envVarRequired': '请至少添加一个包含键和值的环境变量',
    'connectors.customApi.configured': '已配置',
    'connectors.customApi.notConfigured': '未配置',
    'connectors.customApi.search': '搜索自定义API',
    'connectors.customApi.connectInfo':
      '使用您自己的 API 密钥将 Omniflow 以编程方式连接到任何第三方服务。',
    'connectors.customApi.addNewDescription':
      '创建一个自定义API连接器，使用您自己的配置',
    'connectors.customApi.secretNamePattern': '仅允许大写字母和下划线',
    'connectors.customApi.reservedName':
      '此变量名称是系统保留的，请使用其他名称',

    // MCP Connectors
    'connectors.mcp.title': 'MCP 服务器',
    'connectors.mcp.description': '配置模型上下文协议服务器（仅支持HTTP）',
    'connectors.mcp.addNew': '添加MCP服务器',
    'connectors.mcp.batchImport': '批量导入',
    'connectors.mcp.exportConfig': '导出配置',
    'connectors.mcp.import': '导入',
    'connectors.mcp.jsonFormatHelp':
      '标准MCP配置格式 - 仅支持HTTP传输（支持多个服务器）：',
    'connectors.mcp.serverName': '服务器名称',
    'connectors.mcp.serverNamePlaceholder': '我的MCP服务器',
    'connectors.mcp.serverUrl': '服务器URL',
    'connectors.mcp.serverUrlPlaceholder': 'https://mcp.example.com/mcp',
    'connectors.mcp.serverUrlHelp':
      'MCP服务器必须支持基于HTTP的JSON-RPC 2.0协议（不支持STDIO传输）',
    'connectors.mcp.customHeaders': '自定义头部（可选）',
    'connectors.mcp.headerName': '头部名称',
    'connectors.mcp.headerValue': '头部值',
    'connectors.mcp.addHeader': '添加头部',
    'connectors.mcp.notes': '备注（可选）',
    'connectors.mcp.notesPlaceholder': '额外配置说明',
    'connectors.mcp.importJson': '通过JSON导入',
    'connectors.mcp.directConfig': '直接配置',
    'connectors.mcp.jsonConfig': 'JSON配置',
    'connectors.mcp.jsonPlaceholder': '粘贴MCP配置JSON（仅支持HTTP服务器）',
    'connectors.mcp.duplicateName': '已存在同名的MCP服务器',

    // Reset Tab
    'reset.title': '重置',
    'reset.warning': '警告',
    'reset.warningDesc':
      '此操作将永久清除此应用的所有内容且无法撤销。应用将重置为空状态。',
    'reset.whatWillHappen': '重置之后：',
    'reset.resetProduct': '产品和生成的代码将被重置',
    'reset.removeChat': '聊天历史将被删除',
    'reset.keepHistory': '之前的生成历史仍将可用',
    'reset.resetting': '重置中...',
    'reset.resetApp': '重置应用',
    'reset.confirmDesc': '点击上方按钮重置此应用。此操作无法撤销。',

    // Domain Management
    'domain.manageDesc': '管理连接到您项目的域名。',
    'domain.addDomain': '添加域名',
    'domain.enterDomain': '输入您的域名（例如：example.com）',
    'domain.pleaseEnterDomain': '请输入域名',
    'domain.validDomain': '请输入有效的域名',
    'domain.loadingDomains': '加载域名中...',
    'domain.redirectsTo': '重定向到',
    'domain.refresh': '刷新',
    'domain.remove': '删除',
    'domain.verifyOwnership':
      '首先，通过将 DNS 记录添加到您的 DNS 提供商来验证域名所有权：',
    'domain.setupDns': '现在所有权已验证，设置此 DNS 记录来配置您的域名：',
    'domain.type': '类型',
    'domain.name': '名称',
    'domain.value': '值',
    'domain.verificationComplete':
      '验证完成且域名成功配置后即可以删除 TXT 记录。',
    'domain.dnsPropagate': '取决于您的提供商，DNS 记录更新可能需要一些时间。',

    // Common Messages
    'message.databaseSaved': '数据库设置保存成功！',
    'message.databaseSaveFailed': '保存数据库设置失败',
    'message.databaseLoadFailed': '加载数据库设置失败：',
    'message.databaseUrlRequired': '请输入数据库 URL',
    'message.databaseConfigureFirst': '请先配置数据库设置',
    'message.noTablesFound': '数据库中未找到表',
    'message.documentIdRequired': '保存设置需要文档 ID',
    'message.organizationIdRequired': '保存设置需要组织 ID',
    'message.stripeSaveFailed': '保存 Stripe 设置失败',
    'message.stripeSaveSuccess': 'Stripe 设置保存成功',
    'message.stripeError': '保存 Stripe 设置时发生错误',
    'message.generateFirst': '请先生成您的第一个产品。',
    'message.productionNotDeployed': '生产环境尚未部署。请先部署到生产环境。',
    'message.projectNotFound': '未找到项目。请检查 deployDocId。',
    'message.maxWebhooks': '您已达到 16 个测试 webhook 端点的最大限制。',
    'message.vercelUpdateFailed': '更新 Vercel 环境变量失败：',
    'message.stripeKeysFailed':
      '更新 Stripe 密钥失败。请验证您的 Stripe 密钥是否正确或联系我们的支持团队。',
    'message.resetSuccess': '{docType} 重置成功！应用正在重新加载...',
    'message.resetFailed': '重置 {docType} 失败',
    'message.resetError': '重置 {docType} 时发生错误',
    'message.appIdRequired': '重置 {docType} 需要应用 ID',
    'message.documentInfoRequired': 'Stripe 配置需要文档信息',
    'message.domainUpgrade': '升级订阅套餐以连接自定义域名',
    'message.domainConnectDesc': '自定义域名',
    'message.connectDomain': '连接域名',
    'message.domainUpgradeDesc':
      '此功能需要更高的订阅套餐 请点击上方信息图标进行升级。',

    'user.add': '新建用户',
    'user.deleteConfirm': '确定要删除此用户吗？',
    'user.saveSuccess': '用户保存成功',
    'user.saveFailed': '用户保存失败',
    'user.createSuccess': '用户创建成功',
    'user.createFailed': '用户创建失败',
  },
};

// Helper function to get specialty translation key from display name
export function getSpecialtyTranslationKey(displayName: string): string {
  const keyMap: Record<string, string> = {
    'Product Management': 'specialty.productManagement',
    'UI Design': 'specialty.uiDesign',
    'Frontend Engineer': 'specialty.frontendEngineer',
    'Backend Engineer': 'specialty.backendEngineer',
    'Fullstack Engineer': 'specialty.fullstackEngineer',
    'Infra/DevOps Engineer': 'specialty.infraDevopsEngineer',
    'Data Engineer': 'specialty.dataEngineer',
    'ML/AI Engineer': 'specialty.mlAiEngineer',
    'QA Engineer': 'specialty.qaEngineer',
    'Release Engineer': 'specialty.releaseEngineer',
    'Mobile Engineer - iOS': 'specialty.mobileEngineerIos',
    'Mobile Engineer - Android': 'specialty.mobileEngineerAndroid',
    'Mobile Engineer - Windows': 'specialty.mobileEngineerWindows',
    'Security Engineer': 'specialty.securityEngineer',
    'Technical Writer': 'specialty.technicalWriter',
    'Engineering Manager': 'specialty.engineeringManager',
    'Technical Lead': 'specialty.technicalLead',
    Architect: 'specialty.architect',
    CTO: 'specialty.cto',
    CEO: 'specialty.ceo',
    Founder: 'specialty.founder',
    'Data Scientist': 'specialty.dataScientist',
    'Product Manager': 'specialty.productManager',
    'UI Designer': 'specialty.uiDesigner',
  };

  return keyMap[displayName] || displayName;
}

// Helper function to get industry translation key from value
export function getIndustryTranslationKey(industryValue: string): string {
  const keyMap: Record<string, string> = {
    Agriculture: 'industry.agriculture',
    Automotive: 'industry.automotive',
    Banking: 'industry.banking',
    Construction: 'industry.construction',
    'Consumer Goods': 'industry.consumerGoods',
    Education: 'industry.education',
    Energy: 'industry.energy',
    Entertainment: 'industry.entertainment',
    'Financial Services': 'industry.financialServices',
    'Food & Beverage': 'industry.foodBeverage',
    Healthcare: 'industry.healthcare',
    Hospitality: 'industry.hospitality',
    Insurance: 'industry.insurance',
    Manufacturing: 'industry.manufacturing',
    'Media & Advertising': 'industry.mediaAdvertising',
    'Real Estate': 'industry.realEstate',
    Retail: 'industry.retail',
    Technology: 'industry.technology',
    Telecommunications: 'industry.telecommunications',
    'Transportation & Logistics': 'industry.transportationLogistics',
  };

  return keyMap[industryValue] || industryValue;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  // Load language from localStorage on mount and listen for changes
  useEffect(() => {
    // Check for lang parameter in URL first (for reviewers)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang') as Language;

    if (urlLang && (urlLang === 'en' || urlLang === 'zh')) {
      // URL parameter takes precedence for reviewers
      setLanguageState(urlLang);
      // Also save to localStorage so it persists
      localStorage.setItem('preferredLanguage', urlLang);
      return;
    }

    // Otherwise, use localStorage preference
    const storedLanguage = localStorage.getItem(
      'preferredLanguage'
    ) as Language;
    if (
      storedLanguage &&
      (storedLanguage === 'en' || storedLanguage === 'zh')
    ) {
      setLanguageState(storedLanguage);
    }

    // Listen for localStorage changes (when user updates language in profile)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'preferredLanguage' && e.newValue) {
        const newLanguage = e.newValue as Language;
        if (newLanguage === 'en' || newLanguage === 'zh') {
          setLanguageState(newLanguage);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    // Save to localStorage for persistence
    localStorage.setItem('preferredLanguage', newLanguage);
  };

  const t = (key: string, params?: Record<string, any>): string => {
    let translation =
      translations[language][
        key as keyof (typeof translations)[typeof language]
      ] || key;

    // Replace parameters in the translation string
    if (params) {
      Object.keys(params).forEach((paramKey) => {
        translation = translation.replace(`{${paramKey}}`, params[paramKey]);
      });
    }

    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
