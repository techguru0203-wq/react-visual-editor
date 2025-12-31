import { SubscriptionStatus } from '@prisma/client';
import prisma from '../db/prisma';
import {
  reminderEmail,
  subscriptionExpirationEmail,
} from '../lib/emailTemplate';

type sendEmailProps = {
  email: string;
  subject: string;
  body: string;
};

// Customer.io configuration
const customerIoAppApiKey = process.env.CUSTOMER_IO_APP_API_KEY;
const customerIoApiKey = process.env.CUSTOMER_IO_API_KEY;
const customerIoSiteId = process.env.CUSTOMER_IO_SITE_ID;

export async function sendEmail({ email, subject, body }: sendEmailProps) {
  try {
    if (customerIoApiKey) {
      const result = await sendCustomerIoEmail(email, subject, body);
      if (result.success) {
        return result;
      }
      console.warn('Customer.io email failed: ', result.errorMsg);
    } else {
      console.log('Customer.io API key not found');
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      errorMsg: 'Error sending email',
    };
  }
}

// Generic retry function with exponential backoff
const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3
): Promise<T | null> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      console.error(
        `${operationName} failed (attempt ${attempt}/${maxRetries}):`,
        error
      );

      if (attempt === maxRetries) {
        console.error(`${operationName} failed after ${maxRetries} attempts`);
        return null;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
};

// Customer.io functions
const createOrUpdateCustomerIoContact = async (
  email: string,
  attributes?: Record<string, any>
) => {
  return withRetry(async () => {
    const response = await fetch(
      `https://track.customer.io/api/v1/customers/${encodeURIComponent(email)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(
            `${customerIoSiteId}:${customerIoApiKey}`
          ).toString('base64')}`,
        },
        body: JSON.stringify({
          email,
          attributes: {
            created_at: Math.floor(Date.now() / 1000),
            ...attributes,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error creating Customer.io contact: HTTP ${response.status} ${errorText}`
      );
    }

    return { id: email, email };
  }, 'create/update Customer.io contact');
};

const sendCustomerIoEmail = async (
  email: string,
  subject: string,
  body: string,
  templateId?: string
) => {
  try {
    // Create or update the contact in Customer.io
    const contact = await createOrUpdateCustomerIoContact(email);
    if (!contact) {
      return {
        success: false,
        errorMsg: 'Error creating Customer.io contact',
      };
    }

    // Send email using Customer.io App API with retry logic
    const requestBody = {
      to: email,
      subject: subject,
      body: body,
      from: 'general@omniflow.team',
      identifiers: {
        email: email,
      },
    };

    // Validate JSON encoding
    let jsonBody;
    try {
      jsonBody = JSON.stringify(requestBody);
    } catch (error) {
      console.error('Error encoding JSON for Customer.io:', error);
      throw error;
    }

    const result = await withRetry(async () => {
      const response = await fetch('https://api.customer.io/v1/send/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerIoAppApiKey}`,
        },
        body: jsonBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    }, 'send Customer.io email');

    if (result) {
      return {
        success: true,
        data: result,
      };
    } else {
      return {
        success: false,
        errorMsg: 'Error sending email via Customer.io after 3 attempts',
      };
    }
  } catch (error) {
    console.error('Error sending Customer.io email:', error);
    return {
      success: false,
      errorMsg: 'Error sending email via Customer.io',
    };
  }
};

// Subscription end reminder
async function notifyUsersOfExpiringSubscriptions({
  gte,
  lt,
}: {
  gte: Date;
  lt: Date;
}) {
  const organizations = await prisma.organization.findMany({
    where: {
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionEnd: {
        gte,
        lt,
      },
    },
  });

  for (const org of organizations) {
    const users = await prisma.user.findMany({
      where: {
        organizationId: org.id,
      },
    });

    for (const user of users) {
      if (user?.email) {
        await sendEmail({
          email: user.email,
          subject: `Subscription Expiration Reminder for Omniflow`,
          body: subscriptionExpirationEmail(
            user.firstname.trim() ? user.firstname : user.username,
            org?.name,
            new Date(org.subscriptionEnd as Date).toDateString()
          ),
        });
      }
    }
  }
}

// Users created a week ago
async function checkUserAction() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

  console.log('checkUserAction: Looking for users created between:', {
    sevenDaysAgo: sevenDaysAgo.toISOString(),
    sixDaysAgo: sixDaysAgo.toISOString(),
    now: now.toISOString(),
  });

  const users = await prisma.user.findMany({
    where: {
      createdAt: {
        gte: sevenDaysAgo,
        lt: sixDaysAgo,
      },
      AND: [
        { ownedProjects: { none: {} } }, // No owned projects
        { createdDocuments: { none: {} } }, // No created documents
      ],
    },
    select: {
      email: true,
      createdAt: true,
      username: true,
      firstname: true,
    },
  });

  console.log(
    'checkUserAction: Found users to send reminder emails to:',
    users.length
  );

  for (const user of users) {
    console.log(
      'checkUserAction: Sending reminder email to:',
      user.email,
      'created at:',
      user.createdAt
    );
    await sendEmail({
      email: user.email,
      subject: `Create your first Project in Omniflow`,
      body: reminderEmail(
        user.firstname.trim() ? user.firstname : user.username
      ),
    });
  }
}

// Update the subscription status to 'EXPIRED'
async function handleSubscriptionExpiration() {
  const organizations = await prisma.organization.findMany({
    where: {
      subscriptionStatus: 'ACTIVE',
      subscriptionEnd: {
        lt: new Date(),
      },
    },
  });

  for (const org of organizations) {
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        subscriptionStatus: 'EXPIRED',
      },
    });
    await prisma.user.updateMany({
      where: { organizationId: org.id },
      data: {
        subscriptionStatus: 'EXPIRED',
      },
    });
  }
}

export async function runScheduledTasks() {
  const now = new Date();
  console.log(
    'runScheduledTasks: Starting scheduled tasks at:',
    now.toISOString()
  );

  // Subscription end reminder - 14 days
  notifyUsersOfExpiringSubscriptions({
    gte: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    lt: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
  });

  // Subscription end reminder - 7 days
  notifyUsersOfExpiringSubscriptions({
    gte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    lt: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
  });

  // Subscription end reminder - 1 day
  notifyUsersOfExpiringSubscriptions({
    gte: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
    lt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
  });

  //  updated subscription expiration
  handleSubscriptionExpiration();

  // Users created a week ago and no owned projects or created documents
  checkUserAction();

  console.log('runScheduledTasks: Completed all scheduled tasks');
}
