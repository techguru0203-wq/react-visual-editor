export const handleBitbucketLogin = () => {
  try {
    const redirectUri = `https://bitbucket.org/site/oauth2/authorize?client_id=${process.env.REACT_APP_BITBUCKET_CLIENT_ID}&response_type=code&redirect_uri=${process.env.REACT_APP_COGNITO_REDIRECT_SIGNOUT}/settings/bitbucket`;
    window.location.href = redirectUri;
  } catch (error) {
    console.error('Error connecting to Bitbucket:', error);
  }
}; 