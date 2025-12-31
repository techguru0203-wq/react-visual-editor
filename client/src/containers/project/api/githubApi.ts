import { GithubUserProfile } from '../../../../../shared/types/githubTypes';
import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { ProjectFile } from '../components/prototype/PrototypeEditor';

export async function connectToGithubApi(
  code: string
): Promise<GithubUserProfile> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/githubSign/callback/${code}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(`Error connect to github (${code}): ${errorMsg}`);
  }
}

export async function getUserGithubProfile(): Promise<GithubUserProfile> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/githubSign/getUserGithubProfile`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(`Error get user github profile: ${errorMsg}`);
  }
}

export async function createAndUploadToGithub(
  files: ProjectFile[],
  repoName: string,
  description: string = '',
  accessToken: string,
  userName: string
): Promise<{ repoUrl: string }> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/githubSign/create-repo`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      name: repoName,
      description: description.substring(0, 20),
      files,
      accessToken,
      userName,
    }),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return { repoUrl: data.html_url };
  } else {
    throw new Error(errorMsg);
  }
}

export async function syncToGithub(
  files: ProjectFile[],
  repoName: string,
  branchName: string,
  accessToken: string,
  commitMessage?: string
): Promise<void> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/githubSign/sync-to-branch`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      files,
      repoName,
      branchName,
      accessToken,
      commitMessage,
    }),
  });

  const { success, error } = await result.json();
  if (!success) {
    throw new Error(`Sync to GitHub failed: ${error}`);
  }
}

export async function syncFromGithub(
  repoName: string,
  accessToken: string,
  branch: string = 'main' // default value is main
): Promise<ProjectFile[]> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/githubSign/sync-from-github`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      repoName,
      accessToken,
      branch,
    }),
  });

  const { success, data, error } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(`Sync from GitHub failed: ${error}`);
  }
}

export async function createBranch(
  repoName: string,
  branchName: string,
  baseBranch: string = 'main',
  accessToken: string,
  userName: string
): Promise<{ branchUrl: string }> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/githubSign/create-branch`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      repoName,
      branchName,
      baseBranch,
      accessToken,
      userName,
    }),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return { branchUrl: data.url };
  } else {
    throw new Error(`Create branch failed: ${errorMsg}`);
  }
}

export async function createPullRequest(
  repoName: string,
  title: string,
  body: string,
  headBranch: string,
  baseBranch: string = 'main',
  accessToken: string
): Promise<{ prUrl: string; prNumber: number }> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/githubSign/create-pull-request`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      repoName,
      title,
      body,
      headBranch,
      baseBranch,
      accessToken,
    }),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return {
      prUrl: data.html_url,
      prNumber: data.number,
    };
  } else {
    throw new Error(`Create pull request failed: ${errorMsg}`);
  }
}

export async function createBranchAndPullRequest(
  repoName: string,
  branchName: string,
  title: string,
  body: string,
  files: ProjectFile[],
  baseBranch: string = 'main',
  accessToken: string,
  userName: string
): Promise<{ branchUrl: string; prUrl: string; prNumber: number }> {
  try {
    let branchUrl: string = '';

    // Step 1: Create the branch first
    try {
      console.log(`Creating branch: ${branchName} from ${baseBranch}`);
      const { branchUrl: createdBranchUrl } = await createBranch(
        repoName,
        branchName,
        baseBranch,
        accessToken,
        userName
      );
      branchUrl = createdBranchUrl;
      console.log(`Branch created successfully: ${branchUrl}`);
    } catch (error) {
      // if the branch is already exist, there will be an error Reference already exists, then skip creating it
      if (
        error instanceof Error &&
        error.message.includes('Reference already exists')
      ) {
        console.log(`Branch ${branchName} already exists, skipping creation`);

        // Construct the branch URL manually since we didn't create it
        try {
          const githubProfile = await getUserGithubProfile();
          const username = githubProfile.userName;
          branchUrl = `https://github.com/${username}/${repoName}/tree/${branchName}`;
        } catch (profileError) {
          throw new Error(
            `Branch already exists but could not determine branch URL: ${profileError}`
          );
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    }

    // Step 2: Sync the files to the newly created branch (not main)
    console.log(`Syncing files to branch: ${branchName}`);
    await syncToGithub(
      files,
      repoName,
      branchName,
      accessToken,
      `Update ${branchName}: ${title}`
    );
    console.log(`Files synced successfully to branch: ${branchName}`);

    // Step 3: Verify the branch exists and has content before creating PR
    console.log(`Verifying branch ${branchName} is ready for pull request`);

    // Add a small delay to ensure GitHub has processed the sync
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // TODO: direct to the branch page
    console.log(`Directing to branch page: ${branchUrl}`);

    // Open the branch page in a new tab
    window.open(branchUrl, '_blank');

    // Step 4: Create the pull request only after branch is successfully created and files are synced
    // console.log(`Creating pull request from ${branchName} to ${baseBranch}`);
    // const { prUrl, prNumber } = await createPullRequest(
    //   repoName,
    //   title,
    //   body,
    //   branchName,
    //   baseBranch,
    //   accessToken
    // );
    // console.log(`Pull request created successfully: #${prNumber}`);

    // Return branch information instead of PR information
    return {
      branchUrl,
      prUrl: branchUrl, // Use branch URL as PR URL for compatibility
      prNumber: 0, // No PR number since we're not creating a PR
    };
  } catch (error) {
    console.error('Error in createBranchAndPullRequest:', error);

    // Provide specific error messages based on where the failure occurred
    if (error instanceof Error) {
      if (error.message.includes('Create branch failed')) {
        throw new Error(`Failed to create branch: ${error.message}`);
      } else if (error.message.includes('Sync to GitHub failed')) {
        throw new Error(`Failed to sync files to branch: ${error.message}`);
      } else if (error.message.includes('Create pull request failed')) {
        throw new Error(`Failed to create pull request: ${error.message}`);
      }
    }

    throw error;
  }
}

export async function disconnectFromGithubApi(): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch(`${api_url}/api/githubSign/disconnect`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });
  const result = await res.json();
  if (!result.success) {
    throw new Error(result.errorMsg || 'Failed to disconnect');
  }
}
