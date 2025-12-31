/**
 * OAuth Callback Handler
 * Handles OAuth redirect after successful authentication
 * This component should be rendered somewhere to catch the OAuth callback
 */

import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const OAuthCallbackHandler: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const connectorId = params.get('connector_id');
    const provider = params.get('provider');

    // Send message to parent window (for popup flow)
    if (window.opener) {
      if (oauthSuccess === 'true') {
        window.opener.postMessage(
          {
            type: 'oauth_success',
            connectorId,
            provider,
          },
          window.location.origin
        );
        window.close();
      } else if (oauthError) {
        window.opener.postMessage(
          {
            type: 'oauth_error',
            error: oauthError,
          },
          window.location.origin
        );
        window.close();
      }
    }
  }, [location]);

  return null;
};

