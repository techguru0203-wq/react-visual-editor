export const redirectToCheckout = async (
  checkoutUrl: string
): Promise<void> => {
  console.log('Redirecting to Stripe Checkout:', checkoutUrl);

  if (!checkoutUrl) {
    throw new Error('Checkout URL is required');
  }
  window.location.href = checkoutUrl;
};

export const redirectToCheckoutLegacy = async (
  sessionId: string
): Promise<void> => {
  console.warn(
    'This method expects a URL, not a sessionId. Please update your code to pass the checkout URL.'
  );
  throw new Error('Please pass the checkout URL instead of sessionId');
};
