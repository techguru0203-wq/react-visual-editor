import { useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const PaymentCancel = () => {
  const navigate = useNavigate();

  const handleRetry = () => {
    navigate('/pricing');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:general@example.com?subject=Payment Issue';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
            </div>
            <CardTitle className="text-3xl">Payment Cancelled</CardTitle>
            <CardDescription className="text-base mt-2">
              Your payment was not completed
            </CardDescription>
          </CardHeader>

          <Separator />

          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>No charges were made to your account.</strong>
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                  You can retry the payment or contact our support team if you
                  encountered any issues during checkout.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="font-semibold text-sm">
                  Common reasons for cancellation:
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>Changed your mind about the subscription</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>Payment information was incorrect</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>Accidentally closed the checkout page</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>Technical issues during the payment process</span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">
                  What would you like to do?
                </h4>
                <p className="text-sm text-muted-foreground">
                  You can try again anytime or explore our free plan to get
                  started.
                </p>
              </div>
            </div>
          </CardContent>

          <Separator />

          <CardFooter className="flex flex-col gap-3 pt-6">
            <Button onClick={handleRetry} className="w-full" size="lg">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={handleGoHome} variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Home
            </Button>
            <Button
              onClick={handleContactSupport}
              variant="ghost"
              className="w-full"
            >
              Contact Support
            </Button>
          </CardFooter>
        </Card>

        {/* Additional Info Section */}
        <div className="mt-6 space-y-3">
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Still interested?{' '}
              <button
                onClick={handleRetry}
                className="text-primary hover:underline font-medium"
              >
                View our pricing plans
              </button>
            </p>
          </div>

          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h4 className="font-semibold text-sm mb-2">Need Assistance?</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Our support team is here to help if you're experiencing any
                issues.
              </p>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-2">Email:</span>
                  <a
                    href="mailto:general@example.com"
                    className="text-primary hover:underline"
                  >
                    general@example.com
                  </a>
                </div>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-2">Live Chat:</span>
                  <span className="text-primary">Available 24/7</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancel;
