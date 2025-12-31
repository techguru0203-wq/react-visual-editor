import prisma from '../db/prisma';

export interface OrganizationWithApiKey {
  id: string;
  name: string | null;
  description: string | null;
  status: string;
  createdAt: Date;
  apiKey: string | null;
}

/**
 * Get organization with API key
 */
export async function getOrganizationWithApiKey(
  organizationId: string
): Promise<OrganizationWithApiKey | null> {
  return await prisma.organization.findUnique({
    where: {
      id: organizationId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      apiKey: true,
      subscriptionTier: true,
    },
  });
}

/**
 * Delete an API key for an organization
 */
export async function deleteApiKeyForOrganization(organizationId: string) {
  return await prisma.organization.update({
    where: {
      id: organizationId,
    },
    data: {
      apiKey: null,
    },
  });
}

/**
 * Validate an API key and return the associated organization
 */
export async function validateApiKey(apiKey: string): Promise<{
  isValid: boolean;
  organizationId?: string;
}> {
  try {
    const organization = await prisma.organization.findFirst({
      where: {
        apiKey,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!organization) {
      return { isValid: false };
    }

    return {
      isValid: true,
      organizationId: organization.id,
    };
  } catch (error) {
    console.error('Error validating API key:', error);
    return { isValid: false };
  }
}
