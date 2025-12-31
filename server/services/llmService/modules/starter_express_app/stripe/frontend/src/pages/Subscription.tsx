import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatPrice,
  getProductByPriceId,
} from '../../../shared/config/stripe-product';
import type {
  StripeSubscription,
  StripeOrder,
  SubscriptionsData,
  OrdersData,
} from '../../../shared/types/stripe';

const Subscription = () => {
  const [subscriptions, setSubscriptions] = useState<StripeSubscription[]>([]);
  const [orders, setOrders] = useState<StripeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const [subsResponse, ordersResponse] = await Promise.all([
        fetch('/api/stripe/subscriptions', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/stripe/orders', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const subsData = await subsResponse.json();
      const ordersData = await ordersResponse.json();

      if (subsData.success) {
        setSubscriptions((subsData.data as SubscriptionsData).subscriptions);
      }

      if (ordersData.success) {
        setOrders((ordersData.data as OrdersData).orders);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    setCancelling(subscriptionId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subscriptionId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to cancel subscription');
      }

      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription has been cancelled successfully',
      });

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Cancel subscription error:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to cancel subscription',
        variant: 'destructive',
      });
    } finally {
      setCancelling(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      {
        variant: 'default' | 'secondary' | 'destructive' | 'outline';
        icon: any;
      }
    > = {
      active: { variant: 'default', icon: CheckCircle },
      trialing: { variant: 'secondary', icon: CheckCircle },
      past_due: { variant: 'destructive', icon: AlertCircle },
      canceled: { variant: 'outline', icon: XCircle },
      unpaid: { variant: 'destructive', icon: XCircle },
    };

    const config = statusConfig[status] || {
      variant: 'secondary',
      icon: AlertCircle,
    };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">
            Subscription Management
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage your subscriptions and view billing history
          </p>
        </div>

        {/* Active Subscriptions */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Subscriptions</CardTitle>
                <CardDescription>
                  Manage your current subscription plans
                </CardDescription>
              </div>
              <Button onClick={() => navigate('/pricing')} variant="outline">
                View All Plans
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {subscriptions.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">
                  No active subscriptions
                </h3>
                <p className="mt-2 text-muted-foreground">
                  Start a subscription to unlock premium features
                </p>
                <Button onClick={() => navigate('/pricing')} className="mt-4">
                  Browse Plans
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {subscriptions.map((subscription) => {
                  const product = getProductByPriceId(
                    subscription.priceId || ''
                  );
                  const isActive =
                    subscription.status === 'active' ||
                    subscription.status === 'trialing';

                  return (
                    <Card key={subscription.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-xl">
                              {product?.name || 'Unknown Plan'}
                            </CardTitle>
                            <CardDescription>
                              Subscription ID: {subscription.subscriptionId}
                            </CardDescription>
                          </div>
                          {getStatusBadge(subscription.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div className="text-sm">
                              <p className="text-muted-foreground">
                                Current Period
                              </p>
                              <p className="font-medium">
                                {formatDate(subscription.currentPeriodStart)} -{' '}
                                {formatDate(subscription.currentPeriodEnd)}
                              </p>
                            </div>
                          </div>
                          {subscription.paymentMethodLast4 && (
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                              <div className="text-sm">
                                <p className="text-muted-foreground">
                                  Payment Method
                                </p>
                                <p className="font-medium">
                                  {subscription.paymentMethodBrand?.toUpperCase()}{' '}
                                  •••• {subscription.paymentMethodLast4}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                        {subscription.cancelAtPeriodEnd && (
                          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              This subscription will be cancelled at the end of
                              the billing period on{' '}
                              {formatDate(subscription.currentPeriodEnd)}
                            </p>
                          </div>
                        )}
                      </CardContent>
                      {isActive && !subscription.cancelAtPeriodEnd && (
                        <CardFooter>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                disabled={
                                  cancelling === subscription.subscriptionId
                                }
                              >
                                {cancelling === subscription.subscriptionId ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Cancelling...
                                  </>
                                ) : (
                                  'Cancel Subscription'
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Are you sure you want to cancel?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Your subscription will remain active until the
                                  end of the current billing period (
                                  {formatDate(subscription.currentPeriodEnd)}).
                                  After that, you'll lose access to premium
                                  features.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  Keep Subscription
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleCancelSubscription(
                                      subscription.subscriptionId!
                                    )
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Cancel Subscription
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </CardFooter>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>
              View your past orders and invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No billing history available
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(order.amountTotal / 100, order.currency)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{order.paymentStatus}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Subscription;
