import { BitbucketUserProfile } from '../../../shared/types/bitbucketTypes';
import { getHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';
import { ProjectFile } from '../components/prototype/PrototypeEditor';

export async function connectToBitbucketApi(
  code: string
): Promise<BitbucketUserProfile> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/bitbucketSign/callback/${code}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(`Error connect to bitbucket (${code}): ${errorMsg}`);
  }
}

export async function getUserBitbucketProfile(): Promise<BitbucketUserProfile> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/bitbucketSign/getUserBitbucketProfile`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(`Error get bitbucket profile: ${errorMsg}`);
  }
}

export async function disconnectFromBitbucketApi(): Promise<void> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/bitbucketSign/disconnect`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });

  const { success, errorMsg } = await result.json();
  if (!success) {
    throw new Error(`Error disconnect from bitbucket: ${errorMsg}`);
  }
}

export async function createAndUploadToBitbucket(
  files: ProjectFile[],
  repoName: string,
  description: string
): Promise<{ repoUrl: string }> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/bitbucketSign/create-repo`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      name: repoName
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')  // Replace invalid chars with hyphen
      .replace(/-+/g, '-')           // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
      .substring(0, 62),             // Bitbucket has 62 char limit,
      description: description+"placeholder",
      files,
    }),
  });

  const { success, data, errorMsg } = await result.json();

  if (success) {
    return { repoUrl: data.html_url };
  }  else {
    throw new Error(`Create bitbucket repo failed: ${errorMsg}`);
  }
}

export async function syncToBitbucket(
  files: ProjectFile[],
  repoName: string,
  branchName: string,
  commitMessage?: string
): Promise<void> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/bitbucketSign/sync-to-branch`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      files,
      repoName,
      branchName,
      commitMessage,
    }),
  });

  const { success, error } = await result.json();

  if (!success) {
    throw new Error(`Sync to Bitbucket failed: ${error}`);
  }
}

export async function syncFromBitbucket(
  repoName: string,
  branch: string = 'master'
): Promise<ProjectFile[]> {
  console.log("Bitbucket repoName: ", repoName);
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/bitbucketSign/sync-from-bitbucket`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      repoName: repoName.toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')  // Replace invalid chars with hyphen
      .replace(/-+/g, '-')           // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
      .substring(0, 62),             // Bitbucket has 62 char limit,
      branch,
    }),
  });

  const { success, data, error } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error(`Sync from Bitbucket failed: ${error}`);
  }
}

interface CreateBranchAndPullRequestBitbucketParams {
  repoName: string;
  branchName: string;
  title: string;
  body: string;
  files: ProjectFile[];
  baseBranch?: string;
}

export async function createBranchAndPullRequestBitbucket(
  params: CreateBranchAndPullRequestBitbucketParams
): Promise<{ branchUrl: string; prUrl: string; prNumber: number }> {
  const {
    repoName,
    branchName,
    title,
    body,
    files,
    baseBranch = 'master',
  } = params;

  try {
    // Step 1: Create the branch
    console.log(`Creating branch: ${branchName}`);
    const { branchUrl } = await createBranch(
      repoName,
      branchName,
      baseBranch
    );
    console.log(`Branch created successfully: ${branchUrl}`);

    // Step 2: Sync files to the new branch
    console.log(`Syncing files to branch: ${branchName}`);
    await syncToBitbucket(
      files,
      repoName,
      branchName,
      `Initial commit for ${branchName}`
    );
    console.log(`Files synced successfully to branch: ${branchName}`);

    // Add a small delay to ensure Bitbucket has processed the sync
    await new Promise(resolve => setTimeout(resolve, 2000));

    // TODO: direct to the branch page
    console.log(`Directing to branch page: ${branchUrl}`);
    
    // Open the branch page in a new tab
    window.open(branchUrl, '_blank');
    
    // Return branch information instead of PR information
    return { 
      branchUrl, 
      prUrl: branchUrl, // Use branch URL as PR URL for compatibility
      prNumber: 0 // No PR number since we're not creating a PR
    };
  } catch (error) {
    console.error('Error in createBranchAndPullRequest:', error);
    
    // Provide specific error messages based on where the failure occurred
    if (error instanceof Error) {
      if (error.message.includes('Create branch failed')) {
        throw new Error(`Failed to create branch: ${error.message}`);
      } else if (error.message.includes('Sync to Bitbucket failed')) {
        throw new Error(`Failed to sync files to branch: ${error.message}`);
      } else if (error.message.includes('Create pull request failed')) {
        throw new Error(`Failed to create pull request: ${error.message}`);
      }
    }
    
    throw error;
  }
}

async function createBranch(
  repoName: string,
  branchName: string,
  baseBranch: string = 'master'
): Promise<{ branchUrl: string }> {
  const headers = await getHeaders();
  const result = await fetch(`${api_url}/api/bitbucketSign/create-branch`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      repoName,
      branchName,
      baseBranch,
    }),
  });

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return { branchUrl: data.url };
  } else {
    throw new Error(`Create branch failed: ${errorMsg}`);
  }
} 