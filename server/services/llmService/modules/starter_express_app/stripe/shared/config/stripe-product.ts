/**
 * Stripe Product Configuration
 *
 * This file defines the product and pricing configuration for Stripe integration.
 *
 * ===================================
 * CONFIGURATION VALIDATION
 * ===================================
 *
 * This file includes automatic validation to ensure:
 * 1. All priceIds in PricingTier exist in stripeProducts
 * 2. Prices in PricingTier match prices in stripeProducts
 * 3. Configuration consistency
 *
 * Run validation:
 * ```typescript
 * import { validatePricingConfiguration } from './stripe-product';
 * const result = validatePricingConfiguration();
 * if (!result.isValid) {
 *   console.error(result.errors);
 * }
 * ```
 */

export interface StripeProduct {
  priceId: string; // Stripe Price ID (e.g., 'price_1RJU0qHs4qn0CNNBBFPKLfzC')
  productId?: string; // Stripe Product ID (e.g., 'prod_xxx')
  name: string; // Product/Price nickname
  description?: string; // Product description
  price: number; // Price in dollars (unit_amount / 100)
  currency: string; // Three-letter ISO currency code (e.g., 'usd')
  mode: 'subscription' | 'payment'; // 'subscription' for recurring, 'payment' for one-time
  interval?: 'month' | 'year'; // Billing interval for subscriptions
  intervalCount?: number; // Number of intervals between billings
  trialDays?: number; // Default trial period in days
}

export interface PricingTier {
  name: string; // Display name for the pricing tier
  description: string; // Short description of the tier
  monthlyPriceId: string; // Stripe Price ID for monthly billing (must exist in stripeProducts)
  yearlyPriceId: string; // Stripe Price ID for yearly billing (must exist in stripeProducts)
  monthlyPrice: number; // Monthly price in dollars (for display)
  yearlyPrice: number; // Yearly price in dollars (for display)
  features: string[]; // List of features included in this tier
  popular?: boolean; // Highlight this tier as most popular
  cta: string; // Call-to-action button text
}

/**
 * Stripe Products/Prices Configuration
 *
 * This array should match your actual Stripe products.
 * Sync with Stripe Dashboard or fetch via API:
 * - Dashboard: https://dashboard.stripe.com/prices
 * - API: stripe.prices.list({ active: true })
 */
export const stripeProducts: StripeProduct[] = [
  // Teams Plans
  {
    priceId: 'price_1RJU0qHs4qn0CNNBBFPKLfzC',
    name: 'Teams (Yearly)',
    description: 'Teams plan with yearly billing',
    price: 720.0,
    currency: 'usd',
    mode: 'subscription',
    interval: 'year',
    intervalCount: 1,
    trialDays: 14,
  },
  {
    priceId: 'price_1RJU0YHs4qn0CNNBiMGHAUsv',
    name: 'Teams (Monthly)',
    description: 'Teams plan with monthly billing',
    price: 75.0,
    currency: 'usd',
    mode: 'subscription',
    interval: 'month',
    intervalCount: 1,
    trialDays: 14,
  },

  // Performance Plans
  {
    priceId: 'price_1RJU0LHs4qn0CNNBmSXlzAkj',
    name: 'Performance (Yearly)',
    description: 'Performance plan with yearly billing',
    price: 240.0,
    currency: 'usd',
    mode: 'subscription',
    interval: 'year',
    intervalCount: 1,
    trialDays: 14,
  },
  {
    priceId: 'price_1RJU04Hs4qn0CNNBS0XBgEEm',
    name: 'Performance (Monthly)',
    description: 'Performance plan with monthly billing',
    price: 25.0,
    currency: 'usd',
    mode: 'subscription',
    interval: 'month',
    intervalCount: 1,
    trialDays: 14,
  },

  // Free Plan
  {
    priceId: 'price_1RJTlCHs4qn0CNNBBbCrX9Tv',
    name: 'Free',
    description: 'Free plan with basic features',
    price: 0.0,
    currency: 'usd',
    mode: 'subscription',
    interval: 'month',
    intervalCount: 1,
  },
];

// Pricing tiers configuration for the pricing page
// To customize: Edit this array or configure through Project Settings -> Payment Configuration
export const pricingTiers: PricingTier[] = [
  {
    name: 'Free',
    description: 'Perfect for getting started',
    monthlyPriceId: 'price_1RJTlCHs4qn0CNNBBbCrX9Tv',
    yearlyPriceId: 'price_1RJTlCHs4qn0CNNBBbCrX9Tv',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Basic features',
      'Up to 10 projects',
      'Community support',
      '1GB storage',
    ],
    cta: 'Get Started',
  },
  {
    name: 'Performance',
    description: 'For professionals and small teams',
    monthlyPriceId: 'price_1RJU04Hs4qn0CNNBS0XBgEEm',
    yearlyPriceId: 'price_1RJU0LHs4qn0CNNBmSXlzAkj',
    monthlyPrice: 25,
    yearlyPrice: 240,
    features: [
      'All Free features',
      'Unlimited projects',
      'Priority support',
      '10GB storage',
      'Advanced analytics',
    ],
    popular: true,
    cta: 'Start Free Trial',
  },
  {
    name: 'Teams',
    description: 'For larger teams and enterprises',
    monthlyPriceId: 'price_1RJU0YHs4qn0CNNBiMGHAUsv',
    yearlyPriceId: 'price_1RJU0qHs4qn0CNNBBFPKLfzC',
    monthlyPrice: 75,
    yearlyPrice: 720,
    features: [
      'All Performance features',
      'Unlimited team members',
      'Dedicated support',
      '100GB storage',
      'Custom integrations',
      'SSO & SAML',
    ],
    cta: 'Contact Sales',
  },
];

/**
 * Utility Functions
 */

/**
 * Get product details by Stripe Price ID
 * @param priceId - Stripe Price ID (e.g., 'price_1RJU0qHs4qn0CNNBBFPKLfzC')
 * @returns StripeProduct object or undefined if not found
 */
export function getProductByPriceId(
  priceId: string
): StripeProduct | undefined {
  return stripeProducts.find((product) => product.priceId === priceId);
}

/**
 * Get pricing tier by name
 * @param tierName - Name of the pricing tier
 * @returns PricingTier object or undefined if not found
 */
export function getPricingTierByName(
  tierName: string
): PricingTier | undefined {
  return pricingTiers.find((tier) => tier.name === tierName);
}

/**
 * Get pricing tier by price ID (monthly or yearly)
 * @param priceId - Stripe Price ID
 * @returns PricingTier object or undefined if not found
 */
export function getPricingTierByPriceId(
  priceId: string
): PricingTier | undefined {
  return pricingTiers.find(
    (tier) => tier.monthlyPriceId === priceId || tier.yearlyPriceId === priceId
  );
}

/**
 * Format price for display
 * @param price - Price in dollars
 * @param currency - ISO currency code (e.g., 'usd')
 * @returns Formatted price string (e.g., '$25.00')
 */
export function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(price);
}

/**
 * Validate that all price IDs in pricingTiers exist in stripeProducts
 * This helps catch configuration errors at runtime
 * @returns Object with validation result and any errors
 */
export function validatePricingConfiguration(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const priceIds = new Set(stripeProducts.map((p) => p.priceId));

  pricingTiers.forEach((tier) => {
    if (!priceIds.has(tier.monthlyPriceId)) {
      errors.push(
        `Pricing tier "${tier.name}" references non-existent monthly price ID: ${tier.monthlyPriceId}`
      );
    }
    if (!priceIds.has(tier.yearlyPriceId)) {
      errors.push(
        `Pricing tier "${tier.name}" references non-existent yearly price ID: ${tier.yearlyPriceId}`
      );
    }

    // Verify prices match
    const monthlyProduct = getProductByPriceId(tier.monthlyPriceId);
    const yearlyProduct = getProductByPriceId(tier.yearlyPriceId);

    if (monthlyProduct && monthlyProduct.price !== tier.monthlyPrice) {
      errors.push(
        `Pricing tier "${tier.name}" monthly price (${tier.monthlyPrice}) doesn't match stripeProducts (${monthlyProduct.price})`
      );
    }

    if (yearlyProduct && yearlyProduct.price !== tier.yearlyPrice) {
      errors.push(
        `Pricing tier "${tier.name}" yearly price (${tier.yearlyPrice}) doesn't match stripeProducts (${yearlyProduct.price})`
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get all price IDs from stripeProducts
 * Useful for validation and checking
 */
export function getAllPriceIds(): string[] {
  return stripeProducts.map((product) => product.priceId);
}

/**
 * Check if a price ID exists in the configuration
 * @param priceId - Stripe Price ID to check
 * @returns true if the price ID exists
 */
export function isPriceIdValid(priceId: string): boolean {
  return stripeProducts.some((product) => product.priceId === priceId);
}

// Validate configuration on module load (development only)
if (process.env.NODE_ENV === 'development') {
  const validation = validatePricingConfiguration();
  if (!validation.isValid) {
    console.error('❌ Pricing configuration validation failed:');
    validation.errors.forEach((error) => console.error(`  - ${error}`));
  } else {
    console.log('✅ Pricing configuration validated successfully');
  }
}
