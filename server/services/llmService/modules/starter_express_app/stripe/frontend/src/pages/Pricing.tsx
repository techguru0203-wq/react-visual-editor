import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Info, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { redirectToCheckout } from '@/lib/stripe';
import {
  formatPrice,
  pricingTiers,
  stripeProducts,
  StripeProduct,
} from '../../../shared/config/stripe-product';

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Group stripe products by product name or productId
  const groupedProducts = useMemo(() => {
    if (!stripeProducts || stripeProducts.length === 0) return {};

    const groups: Record<
      string,
      {
        monthly?: StripeProduct;
        yearly?: StripeProduct;
        oneTime?: StripeProduct;
        name: string;
        description?: string;
      }
    > = {};

    stripeProducts.forEach((product) => {
      // Use productId or name as the grouping key
      const key = product.productId || product.name;

      if (!groups[key]) {
        groups[key] = {
          name: product.name,
          description: product.description,
        };
      }

      if (product.mode === 'subscription') {
        if (product.interval === 'month') {
          groups[key].monthly = product;
        } else if (product.interval === 'year') {
          groups[key].yearly = product;
        }
      } else if (product.mode === 'payment') {
        groups[key].oneTime = product;
      }
    });

    return groups;
  }, []);

  // Determine if we should use pricingTiers or fallback to stripeProducts
  const hasPricingTiers = pricingTiers && pricingTiers.length > 0;
  const hasStripeProducts = Object.keys(groupedProducts).length > 0;

  const handlePurchase = async (
    priceId: string,
    planName: string,
    isSubscription: boolean
  ) => {
    setLoadingPriceId(priceId);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to continue',
          variant: 'destructive',
        });
        navigate('/login');
        return;
      }

      let response;

      if (isSubscription) {
        // Create subscription session
        response = await fetch('/api/stripe/create-subscription-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: priceId,
            interval: isYearly ? 'year' : 'month',
            intervalCount: 1,
            trialDays: 14, // Optional: 14-day free trial
          }),
        });
      } else {
        // Create one-time checkout session
        response = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: priceId,
            quantity: 1,
          }),
        });
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.error?.message || 'Failed to create checkout session'
        );
      }

      if (data.data.url) {
        await redirectToCheckout(data.data.url);
      } else {
        throw new Error('No checkout URL returned from server');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to complete purchase',
        variant: 'destructive',
      });
    } finally {
      setLoadingPriceId(null);
    }
  };

  const calculateSavings = (monthly: number, yearly: number) => {
    if (monthly === 0) return 0;
    const annualMonthly = monthly * 12;
    const savings = ((annualMonthly - yearly) / annualMonthly) * 100;
    return Math.round(savings);
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that's right for you. All plans include a 14-day
            free trial.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <Label
              htmlFor="billing-toggle"
              className={!isYearly ? 'font-semibold' : ''}
            >
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={isYearly}
              onCheckedChange={setIsYearly}
            />
            <Label
              htmlFor="billing-toggle"
              className={isYearly ? 'font-semibold' : ''}
            >
              Yearly
            </Label>
            {isYearly && (
              <Badge variant="secondary" className="ml-2">
                Save up to 20%
              </Badge>
            )}
          </div>
        </div>

        {/* Configuration Notice */}
        <Alert className="mb-8 max-w-4xl mx-auto">
          <Info className="h-4 w-4" />
          <AlertTitle>Demo Pricing Page</AlertTitle>
          <AlertDescription>
            This is a demo page with sample pricing data. To configure your own
            Stripe products:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                Or configure through:{' '}
                <span className="font-medium">
                  Project Settings → Payment Configuration
                </span>
              </li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Render pricingTiers if available */}
          {hasPricingTiers ? (
            pricingTiers.map((tier) => {
              const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice;
              const priceId = isYearly
                ? tier.yearlyPriceId
                : tier.monthlyPriceId;
              const savings = calculateSavings(
                tier.monthlyPrice,
                tier.yearlyPrice
              );
              const isLoading = loadingPriceId === priceId;

              return (
                <Card
                  key={tier.name}
                  className={`relative flex flex-col ${
                    tier.popular
                      ? 'border-primary shadow-lg scale-105'
                      : 'border-border'
                  }`}
                >
                  {tier.popular && (
                    <Badge
                      className="absolute -top-3 left-1/2 -translate-x-1/2"
                      variant="default"
                    >
                      Most Popular
                    </Badge>
                  )}

                  <CardHeader>
                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <div className="mb-6">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold">
                          {formatPrice(price, 'usd')}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          /{isYearly ? 'year' : 'month'}
                        </span>
                      </div>
                      {isYearly && savings > 0 && (
                        <p className="text-sm text-green-600 mt-1">
                          Save {savings}% with yearly billing
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start">
                          <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={tier.popular ? 'default' : 'outline'}
                      onClick={() => handlePurchase(priceId, tier.name, true)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        tier.cta
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })
          ) : hasStripeProducts ? (
            // Fallback to stripeProducts when no pricingTiers
            Object.entries(groupedProducts).map(([key, group]) => {
              const product = isYearly
                ? group.yearly || group.monthly || group.oneTime
                : group.monthly || group.yearly || group.oneTime;

              if (!product) return null;

              const isSubscription = product.mode === 'subscription';
              const isLoading = loadingPriceId === product.priceId;

              return (
                <Card key={key} className="relative flex flex-col">
                  {/* Show subscription badge */}
                  {isSubscription && (
                    <Badge
                      className="absolute -top-3 left-1/2 -translate-x-1/2"
                      variant="outline"
                    >
                      {product.interval === 'year'
                        ? 'Yearly'
                        : product.interval === 'month'
                        ? 'Monthly'
                        : 'Subscription'}
                    </Badge>
                  )}

                  <CardHeader>
                    <CardTitle className="text-2xl">{group.name}</CardTitle>
                    {group.description && (
                      <CardDescription>{group.description}</CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1">
                    <div className="mb-6">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold">
                          {formatPrice(product.price, product.currency)}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          {isSubscription
                            ? `/${product.interval}${
                                product.intervalCount &&
                                product.intervalCount > 1
                                  ? `/${product.intervalCount}`
                                  : ''
                              }`
                            : ' one-time'}
                        </span>
                      </div>
                      {product.trialDays && product.trialDays > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {product.trialDays}-day free trial
                        </p>
                      )}
                    </div>

                    {/* Basic feature list for products without defined features */}
                    <ul className="space-y-3">
                      <li className="flex items-start">
                        <ShoppingCart className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">
                          {isSubscription
                            ? 'Subscription service'
                            : 'One-time purchase'}
                        </span>
                      </li>
                      {isSubscription && (
                        <>
                          <li className="flex items-start">
                            <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                            <span className="text-sm">Cancel anytime</span>
                          </li>
                          <li className="flex items-start">
                            <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                            <span className="text-sm">
                              Full access to all features
                            </span>
                          </li>
                        </>
                      )}
                      {product.trialDays && product.trialDays > 0 && (
                        <li className="flex items-start">
                          <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">
                            {product.trialDays}-day free trial included
                          </span>
                        </li>
                      )}
                    </ul>

                    {/* Show available billing options */}
                    {isSubscription && (group.monthly || group.yearly) && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground">
                          Available billing:
                          {group.monthly && ' Monthly'}
                          {group.monthly && group.yearly && ' •'}
                          {group.yearly && ' Yearly'}
                        </p>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() =>
                        handlePurchase(
                          product.priceId,
                          group.name,
                          isSubscription
                        )
                      }
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : isSubscription ? (
                        'Start Subscription'
                      ) : (
                        'Purchase Now'
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })
          ) : (
            // No products available
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">
                No products available at the moment.
              </p>
            </div>
          )}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            All plans include 14-day free trial. No credit card required.
          </p>
          <p className="text-muted-foreground mt-2">
            Questions? Contact us at{' '}
            <a
              href="mailto:general@example.com"
              className="text-primary hover:underline"
            >
              general@example.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
