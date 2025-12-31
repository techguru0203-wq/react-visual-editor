import { PrismaClient } from '@prisma/client';
import {
  templateIssueDependencyData,
  projectTemplateData,
  projectTemplateIssueData,
  templateDocumentData,
} from './projectData';

export const createProjectTemplates = async (prisma: PrismaClient) => {
  console.log('server.db.seed.createProjectTemplates.start');

  const projectTemplates = await prisma.templateProject.createMany({
    data: projectTemplateData,
  });

  const issueTemplates = await prisma.templateIssue.createMany({
    data: projectTemplateIssueData,
  });

  const documentTemplates = await prisma.templateDocument.createMany({
    data: templateDocumentData,
  });

  const dependIssues = await prisma.templateIssueDependency.createMany({
    data: templateIssueDependencyData,
  });

  console.log('server.db.seed.createProjectTemplates.done');
};
