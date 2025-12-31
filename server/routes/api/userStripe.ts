import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import prisma from '../../db/prisma';
import { userProfileRequestHandler } from '../../lib/util';
import { initializeCodebaseManager } from '../../services/llmService/tools/codebaseTools';
import {
  getStripeModuleFiles,
  mergeStripeFilesIntoCode,
} from '../../services/llmService/appGen/appGenUtil';
import { executeDBMigrationWithDrizzle } from '../../services/databaseService';
import { EnvSettings } from '../../services/documentService';
import { updateDocumentMeta } from '../../services/documentMetaService';

const router = Router();
router.use(userProfileRequestHandler);

router.post('/setup-webhook', async (req: Request, res: Response) => {
  const { secretKey, userDomain } = req.body as {
    secretKey?: string;
    userDomain?: string;
  };

  if (!secretKey || !userDomain) {
    return res.status(400).json({
      success: false,
      message: 'secretKey and webhookUrl are required',
    });
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2025-09-30.clover' });

  type EnabledEvent = Stripe.WebhookEndpointCreateParams.EnabledEvent;
  const desiredEvents: EnabledEvent[] = [
    'checkout.session.completed',
    'invoice.payment_succeeded',
  ];

  try {
    // create new webhook endpoint
    const created = await stripe.webhookEndpoints.create({
      url: userDomain + '/api/stripe/webhook',
      api_version: '2025-09-30.clover',
      enabled_events: desiredEvents,
      description:
        'App webhook for Checkout (one-time) + Subscriptions billing',
    });

    return res.json({
      success: true,
      endpointId: created.id,
      signingSecret: (created as any).secret ?? null,
    });
  } catch (err: any) {
    console.error('setup-webhook error:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Stripe error',
    });
  }
});

// Get Stripe products
router.post('/products', async (req: Request, res: Response) => {
  const { stripeSecretKey, documentId } = req.body;

  if (!stripeSecretKey) {
    return res.status(400).json({
      success: false,
      errorMsg: 'Stripe Secret Key is required',
    });
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-09-30.clover',
    });

    // Fetch all active prices with product details
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
      limit: 100,
    });

    // Transform Stripe prices to our product format
    const products = prices.data.map((price) => {
      const product =
        typeof price.product === 'string'
          ? null
          : price.product && 'name' in price.product
          ? price.product
          : null;

      return {
        priceId: price.id,
        productId:
          typeof price.product === 'string' ? price.product : price.product.id,
        name:
          price.nickname || (product && 'name' in product ? product.name : ''),
        description:
          product && 'description' in product
            ? product.description || undefined
            : undefined,
        price: (price.unit_amount || 0) / 100,
        currency: price.currency,
        mode: price.type === 'recurring' ? 'subscription' : 'payment',
        interval: price.recurring?.interval,
        intervalCount: price.recurring?.interval_count,
        trialDays: price.recurring?.trial_period_days || undefined,
      };
    });

    res.json({
      success: true,
      data: { products },
    });
  } catch (error: any) {
    console.error('Error fetching Stripe products:', error);
    res.status(500).json({
      success: false,
      errorMsg: error.message || 'Failed to fetch products from Stripe',
    });
  }
});

// Update project codebase with selected products
router.post(
  '/update-products',
  async (req: Request, res: Response & { locals: { currentUser: any } }) => {
    const { documentId, products } = req.body;
    const currentUser = res.locals.currentUser;

    if (!documentId || !products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        errorMsg: 'Document ID and products array are required',
      });
    }

    try {
      // Get document with its content from database
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { content: true, meta: true },
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          errorMsg: 'Document not found',
        });
      }

      if (!document.content) {
        return res.status(400).json({
          success: false,
          errorMsg: 'Document content not found',
        });
      }

      // Parse the code from database
      const codeContent = document.content.toString('utf-8');

      // Initialize codebase manager with the code
      const codebaseManager = initializeCodebaseManager(codeContent);

      // Try to find the stripe-product.ts file in the codebase
      const possiblePaths = ['shared/config/stripe-product.ts'];

      let stripeProductPath: string | null = null;
      for (const path of possiblePaths) {
        const file = codebaseManager.getFile(path);
        if (file) {
          stripeProductPath = path;
          break;
        }
      }

      // If Stripe product file not found, install Stripe module automatically
      let isFirstTimeInstall = false;
      if (!stripeProductPath) {
        try {
          console.log(
            '⚠️  Stripe product configuration file not found. Installing Stripe module...'
          );

          // Get Stripe module files
          const { files: stripeFiles } = await getStripeModuleFiles();

          if (stripeFiles.length === 0) {
            return res.status(500).json({
              success: false,
              errorMsg: 'Failed to load Stripe module files',
            });
          }

          // Merge Stripe files into existing codebase
          const mergedCodeJson = mergeStripeFilesIntoCode(
            codeContent,
            stripeFiles
          );

          // Reinitialize codebase manager with merged code
          const newCodebaseManager = initializeCodebaseManager(mergedCodeJson);

          // Try to find the stripe-product.ts file again
          for (const path of possiblePaths) {
            const file = newCodebaseManager.getFile(path);
            if (file) {
              stripeProductPath = path;
              // Update codebaseManager reference
              Object.assign(codebaseManager, newCodebaseManager);
              break;
            }
          }

          if (!stripeProductPath) {
            return res.status(500).json({
              success: false,
              errorMsg:
                'Failed to install Stripe module: Configuration file not found after installation',
            });
          }

          // Mark as first-time installation
          isFirstTimeInstall = true;

          console.log(
            `✅ Stripe module installed successfully (${stripeFiles.length} files)`
          );
        } catch (error: any) {
          console.error('Error installing Stripe module:', error);
          return res.status(500).json({
            success: false,
            errorMsg: `Failed to install Stripe module: ${error.message}`,
          });
        }
      }

      // Get the current file content
      const currentContent = codebaseManager.getFileContent(stripeProductPath);
      if (!currentContent) {
        return res.status(400).json({
          success: false,
          errorMsg: 'Failed to read stripe-product.ts file',
        });
      }

      // Generate pricing tiers from products
      const pricingTiers = generatePricingTiers(products);
      // Update the file content
      let newContent = currentContent;
      // Replace stripeProducts array
      const productsStr = JSON.stringify(products, null, 2);
      newContent = newContent.replace(
        /export const stripeProducts: StripeProduct\[\] = \[[\s\S]*?\];/,
        `export const stripeProducts: StripeProduct[] = ${productsStr};`
      );

      // Replace pricingTiers array
      const tiersStr = JSON.stringify(pricingTiers, null, 2);
      newContent = newContent.replace(
        /export const pricingTiers: PricingTier\[\] = \[[\s\S]*?\];/,
        `export const pricingTiers: PricingTier[] = ${tiersStr};`
      );

      // Update the file in the codebase manager
      codebaseManager.updateFile(stripeProductPath, newContent);

      let finalCodeJson: string;

      // Not first-time install, just get the updated codebase
      const updatedCodebase = codebaseManager.getCodebaseMap();
      finalCodeJson = JSON.stringify({
        files: Object.values(updatedCodebase),
      });

      // Save the updated code to database
      await prisma.document.update({
        where: { id: documentId },
        data: {
          content: Buffer.from(finalCodeJson, 'utf-8'),
        },
      });

      // Add installation flags if first-time install using partial update
      if (isFirstTimeInstall) {
        await updateDocumentMeta(documentId, {
          stripeModuleInstalled: true,
          stripeModuleInstalledAt: new Date().toISOString(),
        });
        console.log(
          '✅ Saved Stripe module installation status to document meta'
        );
      }

      // Get current meta for migration
      const currentMeta = (document.meta as any) || {};

      // Execute database migration if first-time install
      let migrationResult = null;
      if (isFirstTimeInstall) {
        console.log('🔧 Executing database migration for Stripe tables...');
        const envSettings = (currentMeta?.envSettings as EnvSettings) || null;

        if (envSettings?.DATABASE_URL) {
          try {
            migrationResult = await executeDBMigrationWithDrizzle(
              documentId,
              finalCodeJson,
              envSettings,
              true // hasSchemaChange = true for Stripe installation
            );

            if (migrationResult.success) {
              console.log(
                '✅ Database migration completed successfully:',
                migrationResult.migrationId
              );
            } else {
              console.log(
                '⚠️ Database migration skipped or failed:',
                migrationResult.error
              );
            }
          } catch (migrationError: any) {
            console.error(
              'Error executing database migration:',
              migrationError
            );
            // Don't fail the entire request - log the error and continue
          }
        } else {
          console.log(
            '⚠️ No DATABASE_URL found in envSettings, skipping database migration'
          );
        }
      }

      res.json({
        success: true,
        message: isFirstTimeInstall
          ? 'Stripe module installed and integrated successfully'
          : 'Products updated successfully in codebase',
        migrationExecuted: isFirstTimeInstall && migrationResult?.success,
      });
    } catch (error: any) {
      console.error('Error updating products:', error);
      res.status(500).json({
        success: false,
        errorMsg: error.message || 'Failed to update products',
      });
    }
  }
);

// Helper function to generate pricing tiers from products
function generatePricingTiers(products: any[]): any[] {
  const tiers: any[] = [];
  const productGroups = new Map<string, any[]>();

  // Group products by name prefix (e.g., "Teams", "Performance", "Free")
  products.forEach((product) => {
    const baseName = product.name.split('(')[0].trim();
    if (!productGroups.has(baseName)) {
      productGroups.set(baseName, []);
    }
    productGroups.get(baseName)!.push(product);
  });

  // Create pricing tiers from groups
  productGroups.forEach((groupProducts, tierName) => {
    const monthlyProduct = groupProducts.find((p) => p.interval === 'month');
    const yearlyProduct = groupProducts.find((p) => p.interval === 'year');

    if (monthlyProduct || yearlyProduct) {
      tiers.push({
        name: tierName,
        description: groupProducts[0].description || `${tierName} plan`,
        monthlyPriceId: monthlyProduct?.priceId || yearlyProduct?.priceId || '',
        yearlyPriceId: yearlyProduct?.priceId || monthlyProduct?.priceId || '',
        monthlyPrice: monthlyProduct?.price || 0,
        yearlyPrice: yearlyProduct?.price || 0,
        features: [
          'Please change as you need',
          'Priority support',
          'Advanced analytics',
        ],
        cta: tierName === 'Free' ? 'Get Started' : 'Start Free Trial',
      });
    }
  });

  return tiers;
}

module.exports = {
  className: 'stripe',
  routes: router,
};
