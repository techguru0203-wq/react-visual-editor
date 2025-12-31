import { Router } from 'express';
import { StandardResponse } from '../../types/response';

const router = Router();

interface CommunityProject {
  id: string;
  name: string;
  description: string;
  domain: string;
  imageUrl: string;
  previewUrl?: string;
  author?: string;
  createdAt?: string;
  projectId?: string; // The actual project ID for cloning
}

// Mock data - in a real app, this would come from a database
const COMMUNITY_PROJECTS: CommunityProject[] = [
  {
    id: '1',
    name: 'Omniflow Team',
    description: 'Website for Omniflow Team',
    domain: 'SMBPortal',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/omniflowteam.jpg',
    previewUrl:
      'https://www.omniflow.team/',
    author: 'Tingzhen',
    createdAt: '2025-08-10',
    projectId: 'cme6btz0000013vzwmr86c2l6',
  },
  {
    id: '2',
    name: 'Palo Alto Reality',
    description: 'A website selling house in Palo Alto with AI Chatbot',
    domain: 'ai',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/paloaltoreality.jpg',
    previewUrl: 'https://paloaltorealty-prod-cmf968tjg00c.useomniflow.com/',
    author: 'Hanya',
    createdAt: '2025-09-07',
    projectId: 'cmf968t8l00c516mp9tcu6qli',
  },
  {
    id: '3',
    name: 'Design Hub',
    description: 'Online design hub for personal design gallery',
    domain: 'SMBPortal',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/designhub.jpg',
    previewUrl: 'https://designhub-prod-cmf6vmz9t00j.useomniflow.com/',
    author: 'Haoyue',
    createdAt: '2025-09-05',
    projectId: 'cmf6vmyyg00inyvuv0bco7jud',
  },
  {
    id: '4',
    name: 'TestGen AI',
    description:
      'Automatic test case generation based on documentation.',
    domain: 'saas',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/testgen.jpg',
    previewUrl: 'https://testgenai-prot-cmeze16d3000-jtzczm4k3.useomniflow.com/',
    author: 'Tingzhen',
    createdAt: '2025-08-31',
    projectId: 'cmeze167p0007r4ct0oyowgmh',
  },
  {
    id: '5',
    name: 'Quantum AI Query',
    description: 'AI Chatbox for science research',
    domain: 'ai',
    imageUrl: 'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/querypage.jpg',
    previewUrl: 'https://querypage-prod-cmf756b0v00r.useomniflow.com/',
    author: 'Zixiao',
    createdAt: '2025-09-05',
    projectId: 'cmf756ate00rgyvuv5cf1bxph',
  },
  {
    id: '6',
    name: 'Robot Status Tracker',
    description: 'Task management dashboard for robot',
    domain: 'internal',
    imageUrl: 'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/robottracker.jpg',
    previewUrl: 'https://robotstatustracker-prot-cmesz9iqz000-5g42wj7hj.useomniflow.com/',
    author: 'Zixiao',
    createdAt: '2025-08-26',
    projectId: 'cmesz9ift000ff3d0486d8aa2',
  },
  {
    id: '7',
    name: 'Travel China',
    description: 'China Travel Recommendation',
    domain: 'SMBPortal',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/prot-cmf5rcmw500n.jpg',
    previewUrl: 'https://prot-cmf5rcmw500n.useomniflow.com/',
    author: 'Yue',
    createdAt: '2025-09-06',
    projectId: 'cmf5rcmg900ndmcnt98dxsw6w',
  },
  {
    id: '8',
    name: 'Quick Hire',
    description: 'Hiring platform for human resources',
    domain: 'saas',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/QuickHire.jpg',
    previewUrl: 'https://quickhire-prot-cmf5u15r500r.useomniflow.com/',
    author: 'Zindy',
    createdAt: '2025-09-06',
    projectId: 'cmf5u15lj00rlmcntl6yz0eeg',
  },
  {
    id: '9',
    name: 'Project Tracker',
    description: 'Dashboard to track project progress',
    domain: 'saas',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/QuickHire.jpg',
    previewUrl: 'https://projecttracker-cmdgezg8r0.useomniflow.com',
    author: 'Khushboo',
    createdAt: '2025-07-23',
    projectId: 'cmdgezg2j006tvnmhz2akj7gz',
  },
  {
    id: '10',
    name: 'Portfolio',
    description: 'Explore complete collection of design projects across various industries and disciplines.',
    domain: 'SMBPortal',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/ZYAN.jpg',
    previewUrl: 'https://portfolio-prot-cmf6y829o00m-i0zqcw9du.useomniflow.com',
    author: 'ZYAN',
    createdAt: '2025-07-23',
    projectId: 'cmf6y823u00lxyvuvfbkhfqdd',
  },
  {
    id: '11',
    name: 'Aura Nexus',
    description: 'Aura Nexus',
    domain: 'SMBPortal',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/datafrontier.jpg',
    previewUrl: 'https://auranexus-prot-cme0dmgy000h.useomniflow.com',
    author: 'Zixiao',
    createdAt: '2025-07-02',
    projectId: 'cme0dmgtb00hm10c0um8t8n0k',
  },

  {
    id: '12',
    name: 'Ethon Hub',
    description: 'Ethon Hub',
    domain: 'SMBPortal',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/ethon.jpg',
    previewUrl: 'https://ethonlannisterhub-prot-cmf3qelbx002-nrrv2c5ni.useomniflow.com',
    author: 'Ethon',
    createdAt: '2025-09-03',
    projectId: 'cmf3qel6e002agmyx1azuikzn',
  },
  {
    id: '13',
    name: 'Law 25',
    description: 'Law 25 Compliance Hub',
    domain: 'SMBPortal',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/law25.jpg',
    previewUrl: 'https://law25compliancehub-prot-cmepbks51000-4ajvstxi5.useomniflow.com',
    author: 'Mikayla',
    createdAt: '2025-08-024',
    projectId: 'cmepbkrye000120jvu20txyke',
  },
  {
    id: '14',
    name: 'Pet Care Blog',
    description: 'Knowledge sharing blog for pet care',
    domain: 'SMBPortal',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/PetCare.jpg',
    previewUrl: 'https://pawprintblog-prot-cmf7b0rdu01a-56ovwk1jv.useomniflow.com/',
    author: 'Jeremy',
    createdAt: '2025-09-05',
    projectId: 'cmf7b0r8001alyvuvhp6dbs28',
  },
  {
    id: '15',
    name: 'Talk Master',
    description: 'AI-powered language learning with CEFR alignment',
    domain: 'ai',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/talksmart.jpg',
    previewUrl: 'https://langflow-prot-cmfcsu7ut00s-cvtrinqn5.useomniflow.com',
    author: 'Daniel',
    createdAt: '2025-08-21',
    projectId: 'cmfcsu75b00rt2pvsrxlbf8cd',
  },
  {
    id: '16',
    name: 'HealthRoot',
    description: 'Personalized recommendations and health trends',
    domain: 'saas',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/healthroot.jpg',
    previewUrl: 'https://healthroot-prot-cmehadhjq001-bl9iwl368-lumvers-projects.useomniflow.com',
    author: 'Dan',
    createdAt: '2025-08-18',
    projectId: 'cmehadhdi0013donnvh8kt3u2',
  },
  {
    id: '17',
    name: 'BioChat AI',
    description: 'Analyze RNA-seq data through natural language conversations. No programming required',
    domain: 'ai',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/biochat.jpg',
    previewUrl: 'https://biochatai-prot-cmf8quibc007-am07rl5uf.useomniflow.com',
    author: 'Iris',
    createdAt: '2025-09-06',
    projectId: 'cmf8qui4i007516mprmx4r57l',
  },
  {
    id: '18',
    name: 'ToDo Buddy',
    description: 'TODO list management to make your work easier',
    domain: 'internal',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/todoapp.jpg',
    previewUrl: 'https://todobuddy-prot-cmf1huwv5000.useomniflow.com',
    author: 'Longbo',
    createdAt: '2025-09-01',
    projectId: 'cmf1huwoe00019pazssts50rs',
  },
  {
    id: '19',
    name: 'SassForge',
    description: 'Discover, evaluate, and deploy the perfect SaaS solutions for your organization',
    domain: 'internal',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/saasforge.jpg',
    previewUrl: 'https://sassforge-prot-cmfagudtg002.useomniflow.com/',
    author: 'Hadolop',
    createdAt: '2025-09-08',
    projectId: 'cmfagudj60026q82lwi9ithpj',
  },
  {
    id: '20',
    name: 'Influencer Connect',
    description: 'Find the perfect creators for your brand campaigns',
    domain: 'saas',
    imageUrl:
      'https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/influencer.jpg',
    previewUrl: 'https://influencerconnect-prot-cmdrobury001.useomniflow.com',
    author: 'Zixiao',
    createdAt: '2025-07-31',
    projectId: 'cmdrobums001j6tmiezunqj5c',
  },
];

/**
 * GET /api/community/projects
 * Get all community projects with optional project ID filtering
 */
router.get(
  '/projects',
  async function (req, res: StandardResponse<CommunityProject[]>) {
    try {
      const { projectIds } = req.query;

      let filteredProjects = COMMUNITY_PROJECTS;

      // Filter by specific project IDs if provided
      if (projectIds) {
        // Handle both comma-separated string and array formats
        const idsArray = Array.isArray(projectIds)
          ? projectIds.map((id) => String(id))
          : typeof projectIds === 'string'
          ? projectIds.split(',').map((id) => id.trim())
          : [String(projectIds)];
        filteredProjects = COMMUNITY_PROJECTS.filter((project) =>
          idsArray.includes(project.id)
        );
      }

      res.status(200).json({
        success: true,
        data: filteredProjects,
      });
    } catch (error) {
      console.error('Error fetching community projects:', error);
      res.status(500).json({
        success: false,
        errorMsg: 'Failed to fetch community projects',
      });
    }
  }
);

/**
 * GET /api/community/projects/:id
 * Get a specific community project by ID
 */
router.get(
  '/projects/:id',
  async function (req, res: StandardResponse<CommunityProject>) {
    try {
      const { id } = req.params;

      const project = COMMUNITY_PROJECTS.find((p) => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          errorMsg: 'Community project not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: project,
      });
    } catch (error) {
      console.error('Error fetching community project:', error);
      res.status(500).json({
        success: false,
        errorMsg: 'Failed to fetch community project',
      });
    }
  }
);

export const className = 'community';
export const routes = router;
