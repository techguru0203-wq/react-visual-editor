import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
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

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessionDetails, setSessionDetails] = useState<any>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Simulate fetching session details
    // In a real app, you might want to verify the session with your backend
    const fetchSessionDetails = async () => {
      try {
        // Optional: Verify the session with your backend
        // const response = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`, {
        //   headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        // });
        // const data = await response.json();
        // setSessionDetails(data);

        // For now, just set loading to false
        setTimeout(() => {
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Failed to fetch session details:', error);
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchSessionDetails();
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  const handleContinue = () => {
    navigate('/subscription');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-3xl">Payment Successful!</CardTitle>
            <CardDescription className="text-base mt-2">
              Your payment has been processed successfully
            </CardDescription>
          </CardHeader>

          <Separator />

          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Thank you for your subscription!</strong>
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="font-semibold text-sm">What's next?</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>Access all premium features immediately</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>
                      Manage your subscription anytime from your dashboard
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>

          <Separator />

          <CardFooter className="flex flex-col gap-3 pt-6">
            <Button onClick={handleContinue} className="w-full" size="lg">
              View Subscription Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button onClick={handleGoHome} variant="outline" className="w-full">
              Return to Home
            </Button>
          </CardFooter>
        </Card>

        {/* Additional Help Section */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Need help?{' '}
            <a
              href="mailto:general@example.com"
              className="text-primary hover:underline"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
