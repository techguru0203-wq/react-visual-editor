import axios, { AxiosError } from 'axios';
import { createHash } from 'crypto';
import { Router } from 'express';
import {
  getUserGithubProfile,
  saveGithubUserInformation,
  deleteGithubUserInformation,
} from '../../services/userService';

// Helper function to make GitHub API calls with rate limit handling and retry logic
async function githubApiCall<T>(
  requestFn: () => Promise<axios.AxiosResponse<T>>,
  maxRetries = 3,
  retryDelay = 2000
): Promise<T> {
  let lastError: AxiosError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await requestFn();
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data as any;

        // Handle rate limit errors (429 or secondary rate limit)
        const isRateLimit =
          status === 429 ||
          (errorData?.message &&
            (errorData.message.includes('secondary rate limit') ||
              errorData.message.includes('exceeded a secondary rate limit')));

        if (isRateLimit) {
          lastError = error;

          // Get retry-after header if available, otherwise use exponential backoff
          const retryAfterHeader =
            error.response?.headers['retry-after'] ||
            error.response?.headers['x-ratelimit-reset'];

          let waitTime: number;
          if (retryAfterHeader) {
            const resetTime = parseInt(retryAfterHeader);
            waitTime =
              resetTime > Date.now() / 1000
                ? resetTime * 1000 - Date.now() + 5000 // Wait until reset + 5 seconds buffer
                : retryDelay * Math.pow(2, attempt); // Fallback to exponential backoff
          } else {
            // Exponential backoff with jitter: 2s, 4s, 8s
            waitTime = retryDelay * Math.pow(2, attempt);
          }

          if (attempt < maxRetries) {
            console.log(
              `GitHub rate limit hit (${
                errorData?.message || 'rate limit'
              }), waiting ${Math.round(
                waitTime / 1000
              )}s before retry (attempt ${attempt + 1}/${maxRetries + 1})`
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }
        }

        // For other errors, throw immediately
        throw error;
      }

      throw error;
    }
  }

  // If we exhausted all retries, throw the last error
  throw lastError || new Error('GitHub API call failed after retries');
}

// Helper function to add delays between sequential API calls
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to compute Git blob SHA locally (without API call)
// Git blob SHA = SHA1("blob " + content_length + "\0" + content)
function computeBlobSha(content: string): string {
  const contentBuffer = Buffer.from(content, 'utf8');
  const header = `blob ${contentBuffer.length}\0`;
  const blobContent = Buffer.concat([
    Buffer.from(header, 'utf8'),
    contentBuffer,
  ]);
  return createHash('sha1').update(blobContent).digest('hex');
}

interface RepoFile {
  path: string;
  content: string;
}

interface TreeItem {
  path: string;
  sha: string;
  mode: string;
  type: string;
}

const router = Router();

router.get('/callback/:code', async (request, response) => {
  const currentUser = response.locals.currentUser;
  console.log('currentUser:', currentUser);
  const { code } = request.params;
  const url = `https://github.com/login/oauth/access_token?client_id=${process.env.GITHUB_CLIENT_ID}&client_secret=${process.env.GITHUB_CLIENT_SECRET}&code=${code}`;

  const githubResponse = await axios.get(url, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
  });

  let accessToken = '';
  let userName = '';
  if (githubResponse.status === 200) {
    const info = githubResponse.data;
    if (!info.includes('error')) {
      accessToken = info.split('access_token=')[1].split('&')[0];

      const response2 = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`, // 使用 Bearer 认证
          Accept: 'application/vnd.github.v3+json', // 确保接受 JSON 格式的响应
        },
      });

      userName = response2.data.login; // 获取用户名

      await saveGithubUserInformation(currentUser.userId, {
        accessToken,
        userName,
      });
    }

    return response.status(200).json({
      success: true,
      data: { accessToken, userName },
    });
  } else {
    return response.status(400).json({
      success: false,
      data: { info: 'github connected error', error: null },
    });
  }
});

router.post('/disconnect', async (request, response) => {
  try {
    const currentUser = response.locals.currentUser;
    console.log('Disconnecting GitHub for user:', currentUser.userId);

    await deleteGithubUserInformation(currentUser.userId);

    return response.status(200).json({
      success: true,
      message: 'GitHub profile disconnected successfully',
    });
  } catch (err) {
    console.error('Failed to disconnect GitHub:', err);
    return response.status(500).json({
      success: false,
      errorMsg: 'Failed to disconnect GitHub',
    });
  }
});

router.get('/getUserGithubProfile', async (request, response) => {
  const currentUser = response.locals.currentUser;

  const githubProfile = await getUserGithubProfile(currentUser.userId);

  return response.status(200).json({
    success: true,
    data: githubProfile,
  });
});

router.post('/create-repo', async (request, response) => {
  const startTime = Date.now();
  let repoUrl = ''; // Define repoUrl at the top level

  try {
    const { name, description, files, accessToken, userName } = request.body;
    // Sanitize description by removing control characters and trimming whitespace
    const sanitizedDescription = description
      ? description
          .replace(/[\n\r\t\f\v]/g, ' ')
          .trim()
          .substring(0, 20)
      : '';

    if (!accessToken) {
      return response.status(400).json({
        success: false,
        errorMsg: 'GitHub access token is required',
      });
    }

    if (!userName) {
      return response.status(400).json({
        success: false,
        errorMsg: 'GitHub user name is required',
      });
    }

    console.log(
      `[GitHub Create Repo] Starting creation with ${files.length} files`
    );

    // Check if repository exists
    try {
      const existingRepoResponse = await axios.get(
        `https://api.github.com/repos/${userName}/${name}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      // If repository exists, return the existing repository URL
      return response.status(200).json({
        success: true,
        data: { html_url: existingRepoResponse.data.html_url },
      });
    } catch (error) {
      // If repository doesn't exist, continue with creation
      if (axios.isAxiosError(error) && error.response?.status !== 404) {
        throw error;
      }
    }

    // Create repository
    const createRepoResponse = await axios.post(
      `https://api.github.com/user/repos`,
      {
        name,
        description: sanitizedDescription,
        private: true,
        auto_init: true, // Initialize with README
        gitignore_template: null,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          timeout: 1000 * 60 * 5,
        },
      }
    );

    repoUrl = createRepoResponse.data.html_url; // Assign to the top-level variable

    // Get the main branch's latest commit SHA
    const branchResponse = await axios.get(
      `https://api.github.com/repos/${userName}/${name}/git/ref/heads/main`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    const parentCommitSha = branchResponse.data.object.sha;

    // Log start of blob creation
    const blobStartTime = Date.now();
    console.log(
      `[GitHub Create Repo] Creating ${files.length} blobs in batches...`
    );

    // Create blobs sequentially with delays to avoid rate limits
    // Batch in groups of 5 to balance speed and rate limit compliance
    const treeItems: TreeItem[] = [];
    const batchSize = 5;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchPromises = batch.map(async (file: RepoFile, index: number) => {
        // Add small delay between requests in batch
        if (index > 0) {
          await delay(200);
        }
        const content = Buffer.from(file.content).toString('base64');
        const blobResponse = await githubApiCall(() =>
          axios.post(
            `https://api.github.com/repos/${userName}/${name}/git/blobs`,
            {
              content: content,
              encoding: 'base64',
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
              },
            }
          )
        );
        return {
          path: file.path,
          sha: blobResponse.sha,
          mode: '100644', // Regular file mode
          type: 'blob',
        } as TreeItem;
      });

      const batchResults = await Promise.all(batchPromises);
      treeItems.push(...batchResults);

      // Add delay between batches to avoid hitting rate limits
      if (i + batchSize < files.length) {
        await delay(500);
      }
    }
    console.log(
      `[GitHub Create Repo] Blob creation completed in ${
        Date.now() - blobStartTime
      }ms`
    );

    // Create tree and commit
    const treeStartTime = Date.now();
    console.log('[GitHub Create Repo] Creating tree and commit...');

    // Create a tree containing all files
    const treeResponse = await githubApiCall(() =>
      axios.post(
        `https://api.github.com/repos/${userName}/${name}/git/trees`,
        {
          tree: treeItems,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      )
    );

    // Create a commit with the tree
    const commitResponse = await githubApiCall(() =>
      axios.post(
        `https://api.github.com/repos/${userName}/${name}/git/commits`,
        {
          message: 'Initial commit with project files',
          tree: treeResponse.sha,
          parents: [parentCommitSha], // Use the main branch's commit as parent
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      )
    );

    // Create/update the main branch reference to point to our new commit
    await githubApiCall(() =>
      axios.patch(
        `https://api.github.com/repos/${userName}/${name}/git/refs/heads/main`,
        {
          sha: commitResponse.sha,
          force: true,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      )
    );

    // Add a small delay to ensure GitHub has processed the commit
    // This is a workaround for the issue where redirecting to the repo URL but files commit was not shown on the UI immediately until user refresh the github page
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(
      `[GitHub Create Repo] Tree and commit completed in ${
        Date.now() - treeStartTime
      }ms`
    );
    console.log(
      `[GitHub Create Repo] Total time: ${
        Date.now() - startTime
      }ms, URL: ${repoUrl}`
    );

    return response.status(200).json({
      success: true,
      data: { html_url: repoUrl },
    });
  } catch (error) {
    console.error(
      `[GitHub Create Repo] Failed after ${Date.now() - startTime}ms:`,
      error
    );
    if (axios.isAxiosError(error)) {
      console.error(
        '[GitHub Create Repo] Response data:',
        error.response?.data
      );
      return response.status(error.response?.status || 500).json({
        success: false,
        errorMsg: repoUrl
          ? `Repository was created at ${repoUrl} but file upload failed. Please delete the repository and try again.`
          : error.response?.data?.message ||
            error.message ||
            'Failed to create repository',
        errors: error.response?.data?.errors || [],
      });
    }
    return response.status(500).json({
      success: false,
      errorMsg: repoUrl
        ? `Repository was created at ${repoUrl} but file upload failed. Please delete the repository and try again.`
        : error instanceof Error
        ? error.message
        : 'Failed to create repository',
    });
  }
});

router.post('/sync-to-github', async (request, response) => {
  try {
    const { accessToken, repoName, files, commitMessage } = request.body;
    const currentUser = response.locals.currentUser;

    const userResponse = (await githubApiCall(() =>
      axios.get<{ login: string }>('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    )) as { login: string };

    const username = userResponse.login;

    const branchRes = await githubApiCall(() =>
      axios.get(
        `https://api.github.com/repos/${username}/${repoName}/git/ref/heads/main`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
    );
    const parentCommitSha = branchRes.object.sha;

    // Get the current tree to compare with existing files
    const parentCommit = await githubApiCall(() =>
      axios.get(
        `https://api.github.com/repos/${username}/${repoName}/git/commits/${parentCommitSha}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    );

    const existingTreeRes = await githubApiCall(() =>
      axios.get(
        `https://api.github.com/repos/${username}/${repoName}/git/trees/${parentCommit.tree.sha}?recursive=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    );

    // Create a map of path -> sha for existing files
    const existingFilesMap = new Map<string, string>();
    existingTreeRes.tree
      .filter((item: any) => item.type === 'blob')
      .forEach((item: any) => {
        existingFilesMap.set(item.path, item.sha);
      });

    // Compare files and only create blobs for changed/new files
    const treeItems: TreeItem[] = [];
    const changedFiles: RepoFile[] = [];
    let changedFilesCount = 0;

    // First pass: compute local SHA and compare with existing (no API calls)
    for (const file of files) {
      const computedSha = computeBlobSha(file.content);
      const existingSha = existingFilesMap.get(file.path);

      if (existingSha !== computedSha) {
        // File is new or changed, need to create blob
        changedFiles.push(file);
        changedFilesCount++;
      } else {
        // File unchanged, reuse existing SHA
        treeItems.push({
          path: file.path,
          sha: existingSha,
          mode: '100644',
          type: 'blob',
        });
      }
    }

    // Only create blobs for changed/new files (much fewer API calls!)
    if (changedFilesCount > 0) {
      const batchSize = 5;
      for (let i = 0; i < changedFiles.length; i += batchSize) {
        const batch = changedFiles.slice(i, i + batchSize);
        const batchPromises = batch.map(
          async (file: RepoFile, index: number) => {
            // Add small delay between requests in batch
            if (index > 0) {
              await delay(200);
            }
            const content = Buffer.from(file.content).toString('base64');

            // Create blob for changed/new file
            const blobRes = await githubApiCall(() =>
              axios.post(
                `https://api.github.com/repos/${username}/${repoName}/git/blobs`,
                { content, encoding: 'base64' },
                { headers: { Authorization: `Bearer ${accessToken}` } }
              )
            );

            return {
              path: file.path,
              sha: blobRes.sha,
              mode: '100644',
              type: 'blob',
            } as TreeItem;
          }
        );

        const batchResults = await Promise.all(batchPromises);
        treeItems.push(...batchResults);

        // Add delay between batches to avoid hitting rate limits
        if (i + batchSize < changedFiles.length) {
          await delay(500);
        }
      }
    } else {
      // If no files changed, return early
      return response.status(200).json({
        success: true,
        message: 'No changes detected, repository is up to date',
      });
    }

    const treeRes = await githubApiCall(() =>
      axios.post(
        `https://api.github.com/repos/${username}/${repoName}/git/trees`,
        { tree: treeItems },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    );

    const commitRes = await githubApiCall(() =>
      axios.post(
        `https://api.github.com/repos/${username}/${repoName}/git/commits`,
        {
          message:
            commitMessage || `Omniflow sync - ${new Date().toISOString()}`,
          tree: treeRes.sha,
          parents: [parentCommitSha],
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    );

    await githubApiCall(() =>
      axios.patch(
        `https://api.github.com/repos/${username}/${repoName}/git/refs/heads/main`,
        { sha: commitRes.sha },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    );

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in /sync-to-github:', error);
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/sync-to-branch', async (request, response) => {
  try {
    const { accessToken, repoName, branchName, files, commitMessage } =
      request.body;
    const currentUser = response.locals.currentUser;

    if (!accessToken || !repoName || !branchName || !files) {
      return response.status(400).json({
        success: false,
        error:
          'Missing required parameters: accessToken, repoName, branchName, files',
      });
    }

    const userResponse = (await githubApiCall(() =>
      axios.get<{ login: string }>('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    )) as { login: string };

    const username = userResponse.login;

    // Check if the branch exists, if not create it from main
    let branchExists = true;
    let parentCommitSha: string;

    try {
      const branchRes = await githubApiCall(() =>
        axios.get(
          `https://api.github.com/repos/${username}/${repoName}/git/ref/heads/${branchName}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        )
      );
      parentCommitSha = branchRes.object.sha;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Branch doesn't exist, create it from main
        branchExists = false;
        const mainBranchRes = await githubApiCall(() =>
          axios.get(
            `https://api.github.com/repos/${username}/${repoName}/git/ref/heads/main`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          )
        );
        parentCommitSha = mainBranchRes.object.sha;
      } else {
        throw error;
      }
    }

    // Get the current tree to compare with existing files
    const parentCommit = await githubApiCall(() =>
      axios.get(
        `https://api.github.com/repos/${username}/${repoName}/git/commits/${parentCommitSha}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    );

    const existingTreeRes = await githubApiCall(() =>
      axios.get(
        `https://api.github.com/repos/${username}/${repoName}/git/trees/${parentCommit.tree.sha}?recursive=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    );

    // Create a map of path -> sha for existing files
    const existingFilesMap = new Map<string, string>();
    existingTreeRes.tree
      .filter((item: any) => item.type === 'blob')
      .forEach((item: any) => {
        existingFilesMap.set(item.path, item.sha);
      });

    // Compare files and only create blobs for changed/new files
    const treeItems: TreeItem[] = [];
    const changedFiles: RepoFile[] = [];
    let changedFilesCount = 0;

    // First pass: compute local SHA and compare with existing (no API calls)
    for (const file of files) {
      const computedSha = computeBlobSha(file.content);
      const existingSha = existingFilesMap.get(file.path);

      if (existingSha !== computedSha) {
        // File is new or changed, need to create blob
        changedFiles.push(file);
        changedFilesCount++;
      } else {
        // File unchanged, reuse existing SHA
        treeItems.push({
          path: file.path,
          sha: existingSha,
          mode: '100644',
          type: 'blob',
        });
      }
    }

    console.log('sync-to-branch: changedFilesCount: ', changedFilesCount);
    // Only create blobs for changed/new files (much fewer API calls!)
    if (changedFilesCount > 0) {
      const batchSize = 20;
      for (let i = 0; i < changedFiles.length; i += batchSize) {
        const batch = changedFiles.slice(i, i + batchSize);
        const batchPromises = batch.map(
          async (file: RepoFile, index: number) => {
            // Add small delay between requests in batch
            if (index > 0) {
              await delay(200);
            }
            const content = Buffer.from(file.content).toString('base64');

            // Create blob for changed/new file
            const blobRes = await githubApiCall(() =>
              axios.post(
                `https://api.github.com/repos/${username}/${repoName}/git/blobs`,
                { content, encoding: 'base64' },
                { headers: { Authorization: `Bearer ${accessToken}` } }
              )
            );

            return {
              path: file.path,
              sha: blobRes.sha,
              mode: '100644',
              type: 'blob',
            } as TreeItem;
          }
        );

        const batchResults = await Promise.all(batchPromises);
        treeItems.push(...batchResults);

        // Add delay between batches to avoid hitting rate limits
        if (i + batchSize < changedFiles.length) {
          await delay(200);
        }
      }
    } else {
      // If no files changed, return early
      return response.status(200).json({
        success: true,
        message: 'No changes detected, repository is up to date',
      });
    }

    // Create tree
    const treeRes = await githubApiCall(() =>
      axios.post(
        `https://api.github.com/repos/${username}/${repoName}/git/trees`,
        { tree: treeItems },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    );

    // Create commit
    const commitRes = (await githubApiCall(() =>
      axios.post<{ sha: string }>(
        `https://api.github.com/repos/${username}/${repoName}/git/commits`,
        {
          message:
            commitMessage ||
            `Omniflow sync to ${branchName} - ${new Date().toISOString()}`,
          tree: treeRes.sha,
          parents: [parentCommitSha],
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    )) as { sha: string };

    if (branchExists) {
      // Update existing branch
      await githubApiCall(() =>
        axios.patch(
          `https://api.github.com/repos/${username}/${repoName}/git/refs/heads/${branchName}`,
          { sha: commitRes.sha },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
      );
    } else {
      // Create new branch
      await githubApiCall(() =>
        axios.post(
          `https://api.github.com/repos/${username}/${repoName}/git/refs`,
          {
            ref: `refs/heads/${branchName}`,
            sha: commitRes.sha,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
      );
    }

    const branchUrl = `https://github.com/${username}/${repoName}/tree/${branchName}`;

    return response.status(200).json({
      success: true,
      data: {
        branchUrl,
        branchName,
        commitSha: commitRes.sha,
        created: !branchExists,
      },
    });
  } catch (error) {
    console.error('Error in /sync-to-branch:', error);
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/sync-from-github', async (request, response) => {
  try {
    const { accessToken, repoName, branch: requestBranch } = request.body;
    const currentUser = response.locals.currentUser;

    // Step 1: Get the authenticated user's GitHub username
    let repo = repoName;
    let branch = requestBranch || 'main';

    // Support legacy format: repoName/branch
    if (repoName.includes('/')) {
      const parts = repoName.split('/');
      repo = parts[0];
      // Prioritize explicit requestBranch parameter over branch from repoName
      branch = requestBranch || parts[1] || 'main';
    }

    const userResponse = await githubApiCall(() =>
      axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );
    const username = userResponse.login;

    // Step 2: Get the latest commit on the specified branch
    let commitRes;
    try {
      commitRes = await githubApiCall(() =>
        axios.get(
          `https://api.github.com/repos/${username}/${repo}/commits/${branch}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        )
      );
    } catch (branchError: any) {
      // Check if it's a 404 error (branch not found)
      if (
        axios.isAxiosError(branchError) &&
        branchError.response?.status === 404
      ) {
        return response.status(400).json({
          success: false,
          error: `Branch '${branch}' does not exist in repository '${repo}'. Please check the branch name and try again.`,
        });
      }
      // Re-throw other errors
      throw branchError;
    }
    const treeSha = commitRes.commit.tree.sha;

    // Step 3: Fetch the file tree from the latest commit
    const treeRes = await githubApiCall(() =>
      axios.get(
        `https://api.github.com/repos/${username}/${repo}/git/trees/${treeSha}?recursive=1`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
    );

    const tree = treeRes.tree.filter((item: any) => item.type === 'blob');

    // Step 4: Download the content of each file with batching to avoid rate limits
    const files: RepoFile[] = [];
    const batchSize = 20;

    for (let i = 0; i < tree.length; i += batchSize) {
      const batch = tree.slice(i, i + batchSize);
      const batchPromises = batch.map(async (item: any, index: number) => {
        // Add small delay between requests in batch
        if (index > 0) {
          await delay(100);
        }
        const blobRes = await githubApiCall(() =>
          axios.get(
            `https://api.github.com/repos/${username}/${repo}/git/blobs/${item.sha}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          )
        );
        const content = Buffer.from(blobRes.content, 'base64').toString();
        return { path: item.path, content };
      });

      const batchResults = await Promise.all(batchPromises);
      files.push(...batchResults);

      // Add delay between batches to avoid hitting rate limits
      if (i + batchSize < tree.length) {
        await delay(200);
      }
    }

    return response.status(200).json({ success: true, data: files });
  } catch (error) {
    console.error('Error in /sync-from-github:', error);
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/create-branch', async (request, response) => {
  try {
    const {
      repoName,
      branchName,
      baseBranch = 'main',
      accessToken,
      userName,
    } = request.body;

    if (!accessToken) {
      return response.status(400).json({
        success: false,
        errorMsg: 'GitHub access token is required',
      });
    }

    if (!userName) {
      return response.status(400).json({
        success: false,
        errorMsg: 'GitHub user name is required',
      });
    }

    // Get the latest commit SHA from the base branch
    const baseBranchResponse = await axios.get(
      `https://api.github.com/repos/${userName}/${repoName}/git/ref/heads/${baseBranch}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const baseCommitSha = baseBranchResponse.data.object.sha;

    // Create the new branch by creating a reference
    const createBranchResponse = await axios.post(
      `https://api.github.com/repos/${userName}/${repoName}/git/refs`,
      {
        ref: `refs/heads/${branchName}`,
        sha: baseCommitSha,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const branchUrl = `https://github.com/${userName}/${repoName}/tree/${branchName}`;

    return response.status(200).json({
      success: true,
      data: { url: branchUrl },
    });
  } catch (error) {
    console.error('Error in /create-branch:', error);
    if (axios.isAxiosError(error)) {
      return response.status(error.response?.status || 500).json({
        success: false,
        errorMsg:
          error.response?.data?.message ||
          error.message ||
          'Failed to create branch',
      });
    }
    return response.status(500).json({
      success: false,
      errorMsg:
        error instanceof Error ? error.message : 'Failed to create branch',
    });
  }
});

router.post('/create-pull-request', async (request, response) => {
  // TODO: if the branch name is already exist, then change one
  try {
    const {
      repoName,
      title,
      body,
      headBranch,
      baseBranch = 'main',
      accessToken,
      userName,
    } = request.body;

    if (!accessToken) {
      return response.status(400).json({
        success: false,
        errorMsg: 'GitHub access token is required',
      });
    }

    if (!userName) {
      return response.status(400).json({
        success: false,
        errorMsg: 'GitHub user name is required',
      });
    }

    if (!repoName || !title || !headBranch) {
      return response.status(400).json({
        success: false,
        errorMsg: 'Repository name, title, and head branch are required',
      });
    }

    // Create the pull request
    const createPRResponse = await axios.post(
      `https://api.github.com/repos/${userName}/${repoName}/pulls`,
      {
        title: title,
        body: body || '',
        head: `${userName}:${headBranch}`,
        base: baseBranch,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const prData = createPRResponse.data;

    return response.status(200).json({
      success: true,
      data: {
        html_url: prData.html_url,
        number: prData.number,
        title: prData.title,
        state: prData.state,
      },
    });
  } catch (error) {
    console.error('Error in /create-pull-request:', error);
    if (axios.isAxiosError(error)) {
      return response.status(error.response?.status || 500).json({
        success: false,
        errorMsg:
          error.response?.data?.message ||
          error.message ||
          'Failed to create pull request',
      });
    }
    return response.status(500).json({
      success: false,
      errorMsg:
        error instanceof Error
          ? error.message
          : 'Failed to create pull request',
    });
  }
});

export default router;

module.exports = {
  className: 'githubSign',
  routes: router,
};
