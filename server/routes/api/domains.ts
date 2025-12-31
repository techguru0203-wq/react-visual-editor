import { Request, Response, Router } from 'express';
import axios from 'axios';

const router = Router();

export const className = 'domains';

// vercel documentation: https://vercel.com/docs/domains/troubleshooting#common-dns-issues
const VERCEL_DNS_CONFIG = {
  APEX_IP: '76.76.21.21',
  CNAME_VALUE: 'cname.vercel-dns.com',
} as const;

interface DomainConfig {
  configuredBy: 'CNAME' | 'A' | 'http' | 'dns-01' | null;
  acceptedChallenges: string[];
  misconfigured: boolean;
  recommendedIps: string[];
  recommendedCname: string;
}

function isApexDomain(domain: string): boolean {
  // Split the domain by dots and check if we have exactly one dot
  // This means we have only a domain and TLD (e.g., example.com)
  const parts = domain.split('.');
  return parts.length === 2;
}

async function getDomainConfig(domain: string): Promise<DomainConfig> {
  try {
    const response = await axios.get(
      `https://api.vercel.com/v6/domains/${domain}/config`,
      {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error getting domain config:', error);
    throw error;
  }
}

async function addDomainToProject(req: Request, res: Response) {
  const { deployDocId, domain } = req.body;

  if (!deployDocId || !domain) {
    return res.status(400).json({
      success: false,
      error: 'Document ID and domain are required',
    });
  }

  try {
    // Add the original domain
    const response = await axios.post(
      `https://api.vercel.com/v10/projects/${deployDocId}/domains`,
      { name: domain },
      {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // If it's an apex domain, add www subdomain and set up redirect
    if (isApexDomain(domain)) {
      const wwwDomain = `www.${domain}`;

      // Add www subdomain
      await axios.post(
        `https://api.vercel.com/v10/projects/${deployDocId}/domains`,
        { name: wwwDomain },
        {
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Set up redirect from apex to www
      await axios.patch(
        `https://api.vercel.com/v9/projects/${deployDocId}/domains/${domain}`,
        {
          redirect: wwwDomain,
          redirectStatusCode: 308,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error(
      'Error adding domain to Vercel project:',
      error.response?.data || error
    );
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error?.message || 'Failed to add domain',
    });
  }
}

async function getProjectDomains(req: Request, res: Response) {
  // documentId is the projectId on vercel
  const { documentId } = req.params;

  if (!documentId) {
    return res.status(400).json({
      success: false,
      error: 'Document ID is required',
    });
  }

  try {
    const response = await axios.get(
      `https://api.vercel.com/v9/projects/${documentId}/domains`,
      {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Filter out vercel.app domains and get configuration for each remaining domain
    const domains = (response.data.domains || []).filter(
      (domain: any) => !domain.name.endsWith('vercel.app')
    );

    const domainsWithConfig = await Promise.all(
      domains.map(async (domain: any) => {
        try {
          const config = await getDomainConfig(domain.name);
          const apex = isApexDomain(domain.name);
          return {
            ...domain,
            config,
            isApex: apex,
            dnsRecord: apex
              ? {
                  type: 'A',
                  name: '@',
                  value: VERCEL_DNS_CONFIG.APEX_IP,
                }
              : {
                  type: 'CNAME',
                  name: 'www',
                  value: VERCEL_DNS_CONFIG.CNAME_VALUE,
                },
            verificationRecord: domain.verification?.[0]
              ? {
                  type: domain.verification[0].type,
                  name: '_vercel',
                  value: domain.verification[0].value,
                }
              : null,
          };
        } catch (error) {
          console.error(
            `Error getting config for domain ${domain.name}:`,
            error
          );
          return domain;
        }
      })
    );

    return res.json({
      success: true,
      data: { domains: domainsWithConfig },
    });
  } catch (error: any) {
    console.error(
      'Error getting project domains:',
      error.response?.data || error
    );
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error?.message || 'Failed to get domains',
    });
  }
}

async function removeDomainFromProject(req: Request, res: Response) {
  const { documentId, domain } = req.params;

  if (!documentId || !domain) {
    return res.status(400).json({
      success: false,
      error: 'Document ID and domain are required',
    });
  }

  try {
    await axios.delete(
      `https://api.vercel.com/v9/projects/${documentId}/domains/${domain}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.json({
      success: true,
    });
  } catch (error: any) {
    console.error(
      'Error removing domain from Vercel project:',
      error.response?.data || error
    );
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error?.message || 'Failed to remove domain',
    });
  }
}

router.post('/add', addDomainToProject);
router.get('/:documentId', getProjectDomains);
router.delete('/:documentId/:domain', removeDomainFromProject);

export const routes = router;
