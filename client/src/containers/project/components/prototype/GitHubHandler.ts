export const handleGitHubLogin = () => {
  try {
    const GITHUB_REDIRECT_URI = `${process.env.REACT_APP_COGNITO_REDIRECT_SIGNOUT}/settings/github`;
    const redirectUri = `https://github.com/login/oauth/authorize?client_id=${process.env.REACT_APP_GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_REDIRECT_URI}&scope=repo`;
    window.location.href = redirectUri;
  } catch (error) {
    console.error('Error connecting to GitHub:', error);
  }
};
