import axios from 'axios';
import { Router } from 'express';
import {
  getUserBitbucketProfile,
  saveBitbucketUserInformation,
  deleteBitbucketUserInformation,
} from '../../services/userService';
import { BITBUCKET_REDIRECT_URI } from '../../lib/constant';
import { userProfileRequestHandler } from '../../lib/util';

const router = Router();

// Apply userProfileRequestHandler to get full user profile including meta
router.use(userProfileRequestHandler);

// OAuth callback
router.get('/callback/:code', async (request, response) => {
  const currentUser = response.locals.currentUser;
  const { code } = request.params;
  try {
    console.log('try to get bitbucket token');
    // Exchange code for access token
    const tokenRes = await axios.post(
      'https://bitbucket.org/site/oauth2/access_token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${BITBUCKET_REDIRECT_URI}/settings/bitbucket`,
      }),
      {
        auth: {
          username: process.env.BITBUCKET_CLIENT_ID!,
          password: process.env.BITBUCKET_CLIENT_SECRET!,
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    console.log('bitbucket token: ', tokenRes);

    const { access_token, refresh_token, expires_in } = tokenRes.data;
    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Get user info
    const userRes = await axios.get('https://api.bitbucket.org/2.0/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userName = userRes.data.username;
    // Get workspace (first one)
    const wsRes = await axios.get('https://api.bitbucket.org/2.0/workspaces', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const workspace = wsRes.data.values[0]?.slug || '';
    await saveBitbucketUserInformation(currentUser.userId, {
      accessToken: access_token,
      userName,
      workspace,
      expiresAt,
      refreshToken: refresh_token,
    });
    console.log('Get Bitbucket info successful');
    return response.status(200).json({
      success: true,
      data: {
        accessToken: access_token,
        userName,
        workspace,
        expiresAt,
        refreshToken: refresh_token,
      },
    });
  } catch (err) {
    console.error('Bitbucket OAuth failed:', err);
    return response.status(400).json({
      success: false,
      errorMsg: 'Bitbucket OAuth failed',
    });
  }
});

// Function to refresh access token
async function refreshBitbucketToken(userId: string) {
  try {
    const userInfo = await getUserBitbucketProfile(userId);
    if (!userInfo || !userInfo.refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokenRes = await axios.post(
      'https://bitbucket.org/site/oauth2/access_token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: userInfo.refreshToken,
      }),
      {
        auth: {
          username: process.env.BITBUCKET_CLIENT_ID!,
          password: process.env.BITBUCKET_CLIENT_SECRET!,
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Update stored tokens
    await saveBitbucketUserInformation(userId, {
      ...userInfo,
      accessToken: access_token,
      refreshToken: refresh_token || userInfo.refreshToken, // Use new refresh token if provided
      expiresAt,
    });

    return { access_token, expiresAt, refresh_token };
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw error;
  }
}

// Helper function to handle token refresh and update currentUser
async function handleTokenRefresh(
  currentUser: any,
  bitbucketUserProfile: any,
  response: any
): Promise<{ accessToken: string }> {
  console.log('Bitbucket token expired, refreshing...');
  const { access_token, expiresAt, refresh_token } =
    await refreshBitbucketToken(currentUser.userId);

  // Update the currentUser with the refreshed token
  response.locals.currentUser = {
    ...response.locals.currentUser,
    meta: {
      ...response.locals.currentUser.meta,
      bitbucket_profile: {
        ...bitbucketUserProfile,
        accessToken: access_token,
        expiresAt: expiresAt,
        refreshToken: refresh_token,
      },
    },
  };

  // Return the new access token and workspace for immediate use
  return {
    accessToken: access_token,
  };
}

// Disconnect
router.post('/disconnect', async (request, response) => {
  try {
    const currentUser = response.locals.currentUser;
    await deleteBitbucketUserInformation(currentUser.userId);
    return response.status(200).json({
      success: true,
      message: 'Bitbucket profile disconnected successfully',
    });
  } catch (err) {
    return response.status(500).json({
      success: false,
      errorMsg: 'Failed to disconnect Bitbucket',
    });
  }
});

// Get user Bitbucket profile
router.get('/getUserBitbucketProfile', async (request, response) => {
  const currentUser = response.locals.currentUser;
  const bitbucketProfile = await getUserBitbucketProfile(currentUser.userId);
  return response.status(200).json({
    success: true,
    data: bitbucketProfile,
  });
});

// Refresh Bitbucket token
router.post('/refresh-token', async (request, response) => {
  try {
    const currentUser = response.locals.currentUser;
    await refreshBitbucketToken(currentUser.userId);

    // Get updated profile with new token
    const updatedProfile = await getUserBitbucketProfile(currentUser.userId);

    return response.status(200).json({
      success: true,
      data: updatedProfile,
    });
  } catch (error) {
    console.error('Token refresh failed:', error);
    return response.status(401).json({
      success: false,
      errorMsg:
        'Failed to refresh Bitbucket token. Please reconnect your account.',
    });
  }
});

// Create repo and upload files
router.post('/create-repo', async (request, response) => {
  try {
    const { name, files } = request.body;
    const currentUser = response.locals.currentUser;
    const bitbucketUserProfile = currentUser.meta?.bitbucket_profile;
    if (!bitbucketUserProfile) {
      return response.status(401).json({
        success: false,
        errorMsg:
          'Bitbucket profile not found. Please connect your Bitbucket account first.',
      });
    }

    let { accessToken, workspace } = bitbucketUserProfile;
    // Check if accessToken is expired and refresh if needed
    if (new Date(bitbucketUserProfile.expiresAt) < new Date()) {
      const refreshedAccessToken = await handleTokenRefresh(
        currentUser,
        bitbucketUserProfile,
        response
      );
      accessToken = refreshedAccessToken.accessToken;
    }

    // Check if repo already exists
    try {
      const existingRepo = await axios.get(
        `https://api.bitbucket.org/2.0/repositories/${workspace}/${name}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      // If we get here, repo exists
      //Upload files (initial commit)
      const form = new URLSearchParams();
      files.forEach((file: any) => {
        form.append(file.path, file.content);
      });
      await axios.post(
        `https://api.bitbucket.org/2.0/repositories/${workspace}/${name}/src`,
        form,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      return response.status(200).json({
        success: true,
        data: { html_url: existingRepo.data.links.html.href },
      });
    } catch (checkError) {
      if (
        axios.isAxiosError(checkError) &&
        checkError.response?.status !== 404
      ) {
        // Some other error occurred during check
        console.error('Error checking repo existence:', checkError);
        return response.status(500).json({
          success: false,
          errorMsg: 'Failed to check if repository exists',
        });
      }
      // 404 means repo doesn't exist, continue with creation
    }

    // Create repo
    const repoRes = await axios.post(
      `https://api.bitbucket.org/2.0/repositories/${workspace}/${name}`,
      {
        name,
        scm: 'git',
        is_private: false,
        description: 'initial commit',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    //Upload files (initial commit)
    const form = new URLSearchParams();
    files.forEach((file: any) => {
      form.append(file.path, file.content);
    });
    await axios.post(
      `https://api.bitbucket.org/2.0/repositories/${workspace}/${name}/src`,
      form,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.status(200).json({
      success: true,
      data: { html_url: repoRes.data.links.html.href },
    });
  } catch (err) {
    console.error('Bitbucket create repo failed:', err);

    return response.status(500).json({
      success: false,
      errorMsg: 'Bitbucket create repo failed',
    });
  }
});

// Sync to branch (commit files)
router.post('/sync-to-branch', async (request, response) => {
  try {
    const { files, repoName, branchName, commitMessage } = request.body;
    const currentUser = response.locals.currentUser;
    const bitbucketUserProfile = currentUser.meta?.bitbucket_profile;
    if (!bitbucketUserProfile) {
      return response.status(401).json({
        success: false,
        errorMsg:
          'Bitbucket profile not found. Please connect your Bitbucket account first.',
      });
    }
    let { accessToken, workspace } = bitbucketUserProfile;

    // Check if accessToken is expired and refresh if needed
    if (new Date(bitbucketUserProfile.expiresAt) < new Date()) {
      const refreshedAccessToken = await handleTokenRefresh(
        currentUser,
        bitbucketUserProfile,
        response
      );
      accessToken = refreshedAccessToken.accessToken;
    }

    const form = new URLSearchParams();
    files.forEach((file: any) => {
      form.append(file.path, file.content);
    });
    form.append('branch', branchName);
    form.append('message', commitMessage || `Sync update from Omniflow`);
    await axios.post(
      `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoName}/src`,
      form,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.status(200).json({ success: true });
  } catch (err) {
    console.error('Bitbucket sync to branch failed:', err);

    return response.status(500).json({
      success: false,
      errorMsg: 'Bitbucket sync to branch failed',
    });
  }
});

// Sync from Bitbucket (download files)
router.post('/sync-from-bitbucket', async (request, response) => {
  try {
    const { repoName, branch = 'master' } = request.body;
    const currentUser = response.locals.currentUser;
    const bitbucketUserProfile = currentUser.meta?.bitbucket_profile;
    if (!bitbucketUserProfile) {
      return response.status(401).json({
        success: false,
        errorMsg:
          'Bitbucket profile not found. Please connect your Bitbucket account first.',
      });
    }
    let { accessToken, workspace } = bitbucketUserProfile;

    // Check if accessToken is expired and refresh if needed
    if (new Date(bitbucketUserProfile.expiresAt) < new Date()) {
      const refreshedAccessToken = await handleTokenRefresh(
        currentUser,
        bitbucketUserProfile,
        response
      );
      accessToken = refreshedAccessToken.accessToken;
    }

    // Recursive function to sync directories and files
    async function syncDirectoryContents(
      directoryUrl: string,
      basePath = '',
      isRootLevel = false
    ): Promise<{ path: string; content: any }[]> {
      const dirRes = await axios.get(directoryUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const files = [];

      for (const item of dirRes.data.values) {
        // Extract only the last part of the path to avoid repetition
        const itemName = item.path.split('/').pop();
        const itemPath = basePath ? `${basePath}/${itemName}` : itemName;

        if (item.type === 'commit_file') {
          // Fetch file content
          const fileRes = await axios.get(item.links.self.href, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          files.push({ path: itemPath, content: fileRes.data });
        } else if (item.type === 'commit_directory') {
          // Recursively sync subdirectory (never skip at nested levels)
          const subDirFiles = await syncDirectoryContents(
            item.links.self.href,
            itemPath,
            false
          );
          files.push(...subDirFiles);
        }
      }

      // Handle pagination if there are more items
      if (dirRes.data.next) {
        const nextPageFiles = await syncDirectoryContents(
          dirRes.data.next,
          basePath,
          isRootLevel
        );
        files.push(...nextPageFiles);
      }

      return files;
    }

    // Get file list from root - include branch in URL
    let treeRes;
    try {
      treeRes = await axios.get(
        `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoName}/src/${branch}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    } catch (branchError: any) {
      // Check if it's a 404 error (branch not found)
      if (branchError.response && branchError.response.status === 404) {
        return response.status(400).json({
          success: false,
          error: `Branch '${branch}' does not exist in repository '${repoName}'. Please check the branch name and try again.`,
        });
      }
      // Re-throw other errors
      throw branchError;
    }
    const files = [];

    for (const file of treeRes.data.values) {
      if (file.type === 'commit_file') {
        const fileRes = await axios.get(file.links.self.href, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        files.push({ path: file.path, content: fileRes.data });
      } else if (file.type === 'commit_directory') {
        // Recursively sync other subdirectories normally
        const fileName = file.path.split('/').pop();
        const subDirFiles = await syncDirectoryContents(
          file.links.self.href,
          fileName,
          true
        );
        files.push(...subDirFiles);
      }
    }

    // Handle pagination for root level if needed
    if (treeRes.data.next) {
      let nextUrl = treeRes.data.next;
      while (nextUrl) {
        const nextRes = await axios.get(nextUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        for (const file of nextRes.data.values) {
          if (file.type === 'commit_file') {
            const fileRes = await axios.get(file.links.self.href, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            files.push({ path: file.path, content: fileRes.data });
          } else if (file.type === 'commit_directory') {
            const fileName = file.path.split('/').pop();
            const subDirFiles = await syncDirectoryContents(
              file.links.self.href,
              fileName,
              false
            );
            files.push(...subDirFiles);
          }
        }

        nextUrl = nextRes.data.next;
      }
    }
    console.log(`Successfully synced ${files.length} files from Bitbucket:`);
    console.log(
      'File paths:',
      files.map((f) => f.path)
    );
    return response.status(200).json({ success: true, data: files });
  } catch (err: any) {
    console.error('Bitbucket sync from failed:', err);

    return response.status(500).json({
      success: false,
      errorMsg: 'Bitbucket sync from failed',
      error: err.message,
    });
  }
});

// Create branch
router.post('/create-branch', async (request, response) => {
  try {
    const { repoName, branchName, baseBranch = 'main' } = request.body;
    const currentUser = response.locals.currentUser;
    const bitbucketUserProfile = currentUser.meta?.bitbucket_profile;
    if (!bitbucketUserProfile) {
      return response.status(401).json({
        success: false,
        errorMsg:
          'Bitbucket profile not found. Please connect your Bitbucket account first.',
      });
    }
    let { accessToken, workspace } = bitbucketUserProfile;

    // Check if accessToken is expired and refresh if needed
    if (new Date(bitbucketUserProfile.expiresAt) < new Date()) {
      const refreshedAccessToken = await handleTokenRefresh(
        currentUser,
        bitbucketUserProfile,
        response
      );
      accessToken = refreshedAccessToken.accessToken;
    }

    // Validate required parameters
    if (!repoName || !branchName || !accessToken || !workspace) {
      return response.status(400).json({
        success: false,
        errorMsg:
          'Missing required parameters: repoName, branchName, accessToken, workspace',
      });
    }

    // Check if branch already exists
    try {
      await axios.get(
        `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoName}/refs/branches/${branchName}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      // Branch exists, return success without creating
      const branchUrl = `https://bitbucket.org/${workspace}/${repoName}/src/${branchName}`;
      return response.status(200).json({
        success: true,
        data: { url: branchUrl },
        message: `Branch '${branchName}' already exists`,
      });
    } catch (checkErr: any) {
      // Branch doesn't exist (404), proceed to create it
      if (checkErr.response?.status !== 404) {
        // Some other error occurred during branch check
        throw checkErr;
      }
    }

    // Get base branch latest commit
    const branchRes = await axios.get(
      `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoName}/refs/branches/${baseBranch}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const baseHash = branchRes.data.target.hash;

    // Create new branch using the correct API endpoint
    await axios.post(
      `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoName}/refs/branches`,
      {
        name: branchName,
        target: { hash: baseHash },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const branchUrl = `https://bitbucket.org/${workspace}/${repoName}/src/${branchName}`;
    return response.status(200).json({
      success: true,
      data: { url: branchUrl },
      message: `Branch '${branchName}' created successfully`,
    });
  } catch (err: any) {
    console.error('Bitbucket create branch failed:', err);
    // Provide more specific error messages for other cases
    let errorMsg = 'Bitbucket create branch failed';
    if (err.response) {
      if (err.response.status === 404) {
        errorMsg = `Repository or base branch not found`;
      } else if (err.response.status === 403) {
        errorMsg = 'Insufficient permissions to create branch';
      }
    }
    return response.status(500).json({
      success: false,
      errorMsg: errorMsg,
    });
  }
});

export default router;

module.exports = {
  className: 'bitbucketSign',
  routes: router,
};
