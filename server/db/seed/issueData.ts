import { Prisma, IssueType, DOCTYPE, IssueStatus } from '@prisma/client';
import { DocumentTypeNameMapping } from '../../lib/constant';
import dayjs from 'dayjs';

export const IssuesData: Pick<
  Prisma.IssueUncheckedCreateInput,
  'name' | 'type' | 'description' | 'meta' | 'plannedEndDate' | 'status'
>[] = [
  {
    name: DOCTYPE.PRD,
    type: IssueType.BUILDABLE,
    description: DocumentTypeNameMapping[DOCTYPE.PRD].name,
    meta: { sequence: 0 },
    plannedEndDate: dayjs().add(7, 'day').toDate(),
    status: IssueStatus.CREATED,
  },
  // {
  //   name: DOCTYPE.UI_DESIGN,
  //   type: IssueType.BUILDABLE,
  //   description: DocumentTypeNameMapping[DOCTYPE.UI_DESIGN].name,
  //   meta: { sequence: 1 },
  //   plannedEndDate: dayjs().add(14, 'day').toDate(),
  //   status: IssueStatus.CANCELED,
  // },
  {
    name: DOCTYPE.PROTOTYPE,
    type: IssueType.BUILDABLE,
    description: DocumentTypeNameMapping[DOCTYPE.PROTOTYPE].name,
    meta: { sequence: 2 },
    plannedEndDate: dayjs().add(14, 'day').toDate(),
    status: IssueStatus.CREATED,
  },
  {
    name: DOCTYPE.TECH_DESIGN,
    type: IssueType.BUILDABLE,
    description: DocumentTypeNameMapping[DOCTYPE.TECH_DESIGN].name,
    meta: { sequence: 3 },
    plannedEndDate: dayjs().add(14, 'day').toDate(),
    status: IssueStatus.CANCELED,
  },
  {
    name: DOCTYPE.DEVELOPMENT_PLAN,
    type: IssueType.BUILDABLE,
    description: DocumentTypeNameMapping[DOCTYPE.DEVELOPMENT_PLAN].name,
    meta: { sequence: 4 },
    plannedEndDate: dayjs().add(16, 'day').toDate(),
    status: IssueStatus.CANCELED,
  },
  {
    name: DOCTYPE.QA_PLAN,
    type: IssueType.BUILDABLE,
    description: DocumentTypeNameMapping[DOCTYPE.QA_PLAN].name,
    meta: { sequence: 5 },
    plannedEndDate: dayjs().add(21, 'day').toDate(),
    status: IssueStatus.CANCELED,
  },
  {
    name: DOCTYPE.RELEASE_PLAN,
    type: IssueType.BUILDABLE,
    description: DocumentTypeNameMapping[DOCTYPE.RELEASE_PLAN].name,
    meta: { sequence: 6 },
    plannedEndDate: dayjs().add(25, 'day').toDate(),
    status: IssueStatus.CANCELED,
  },
  {
    name: DOCTYPE.PRODUCT,
    type: IssueType.BUILDABLE,
    description: DocumentTypeNameMapping[DOCTYPE.PRODUCT].name,
    meta: { sequence: 7 },
    plannedEndDate: dayjs().add(28, 'day').toDate(),
    status: IssueStatus.CREATED,
  },
];

export const EpicsData = {
  epics: [
    {
      name: 'User Registration',
      type: 'epic',
      storyPoint: 26,
      children: [
        {
          name: 'As a talent, I want to register on the platform so that I can find job opportunities.',
          type: 'story',
          storyPoint: 13,
          children: [
            {
              name: '[Backend] Develop user authentication system',
              type: 'task',
              description: 'Design user data model and schema',
              storyPoint: 2,
            },
            {
              name: '[Backend] Develop user authentication system',
              type: 'task',
              description: 'Implement API for user log in authentication',
              storyPoint: 3,
            },
            {
              name: '[Backend] Develop user authentication system',
              type: 'task',
              description: 'Add support for OAuth (such as Google OAuth)',
              storyPoint: 3,
            },
            {
              name: '[Frontend] Develop user registration form',
              type: 'task',
              description: 'Design and implement user registration form',
              storyPoint: 5,
            },
          ],
        },
        {
          name: 'As a company, I want to register on the platform so that I can find skilled professionals.',
          type: 'story',
          storyPoint: 13,
          children: [
            {
              name: '[Backend] Develop company authentication system',
              type: 'task',
              description: 'Design company data model and schema',
              storyPoint: 2,
            },
            {
              name: '[Backend] Develop company authentication system',
              type: 'task',
              description: 'Implement API for company log in authentication',
              storyPoint: 3,
            },
            {
              name: '[Backend] Develop company authentication system',
              type: 'task',
              description: 'Add support for OAuth (such as Google OAuth)',
              storyPoint: 3,
            },
            {
              name: '[Frontend] Develop company registration form',
              type: 'task',
              description: 'Design and implement company registration form',
              storyPoint: 5,
            },
          ],
        },
      ],
    },
    {
      name: 'Job Posting and Application',
      type: 'epic',
      storyPoint: 21,
      children: [
        {
          name: 'As a company, I want to post a job so that I can find a suitable talent.',
          type: 'story',
          storyPoint: 8,
          children: [
            {
              name: '[Backend] Develop job posting system',
              type: 'task',
              description: 'Design job data model and schema',
              storyPoint: 2,
            },
            {
              name: '[Backend] Develop job posting system',
              type: 'task',
              description: 'Implement API for job posting',
              storyPoint: 3,
            },
            {
              name: '[Frontend] Develop job posting form',
              type: 'task',
              description: 'Design and implement job posting form',
              storyPoint: 3,
            },
          ],
        },
        {
          name: 'As a talent, I want to apply for a job so that I can work on a project that matches my skills.',
          type: 'story',
          storyPoint: 13,
          children: [
            {
              name: '[Backend] Develop job application system',
              type: 'task',
              description: 'Design job application data model and schema',
              storyPoint: 2,
            },
            {
              name: '[Backend] Develop job application system',
              type: 'task',
              description: 'Implement API for job application',
              storyPoint: 3,
            },
            {
              name: '[Frontend] Develop job application form',
              type: 'task',
              description: 'Design and implement job application form',
              storyPoint: 3,
            },
            {
              name: '[Backend] Develop job application notification system',
              type: 'task',
              description:
                'Implement API for sending notifications when a job application is submitted',
              storyPoint: 5,
            },
          ],
        },
      ],
    },
    {
      name: 'Job Matching',
      type: 'epic',
      storyPoint: 13,
      children: [
        {
          name: 'As a talent, I want the platform to match me with job opportunities that fit my skills and preferences.',
          type: 'story',
          storyPoint: 8,
          children: [
            {
              name: '[Backend] Develop job matching algorithm',
              type: 'task',
              description:
                'Design and implement algorithm to match talents with job opportunities',
              storyPoint: 5,
            },
            {
              name: '[Backend] Develop job matching notification system',
              type: 'task',
              description:
                'Implement API for sending notifications when a job match is found',
              storyPoint: 3,
            },
          ],
        },
        {
          name: 'As a company, I want the platform to match me with talents that fit the skills required for my project.',
          type: 'story',
          storyPoint: 5,
          children: [
            {
              name: '[Backend] Develop talent matching algorithm',
              type: 'task',
              description:
                'Design and implement algorithm to match companies with talents',
              storyPoint: 5,
            },
          ],
        },
      ],
    },
    {
      name: 'Other Epic',
      type: 'epic',
      storyPoint: 20,
      children: [
        {
          name: 'As a user, I want the platform to ensure the security of my data.',
          type: 'story',
          storyPoint: 5,
          children: [
            {
              name: '[Backend] Develop data security measures',
              type: 'task',
              description: 'Implement data encryption and secure data storage',
              storyPoint: 5,
            },
          ],
        },
        {
          name: 'As a user, I want the platform to be able to handle a large number of users and job postings without performance degradation.',
          type: 'story',
          storyPoint: 5,
          children: [
            {
              name: '[Backend] Develop performance optimization measures',
              type: 'task',
              description:
                'Implement caching, database indexing, and other performance optimization measures',
              storyPoint: 5,
            },
          ],
        },
        {
          name: 'As a user, I want the platform to be user-friendly and easy to navigate.',
          type: 'story',
          storyPoint: 5,
          children: [
            {
              name: '[Frontend] Develop user-friendly UI',
              type: 'task',
              description:
                'Design and implement a user-friendly and intuitive UI',
              storyPoint: 5,
            },
          ],
        },
        {
          name: 'As a user, I want the platform to be scalable to accommodate growth in the number of users and job postings.',
          type: 'story',
          storyPoint: 5,
          children: [
            {
              name: '[Backend] Develop scalability measures',
              type: 'task',
              description:
                'Implement horizontal scaling, load balancing, and other scalability measures',
              storyPoint: 5,
            },
          ],
        },
      ],
    },
  ],
};
