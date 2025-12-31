import { message } from 'antd';

import { upsertDocument } from '../../containers/project/api/document';

/**
 * Utility function to reset the repoUrl in document meta to empty string
 * @param documentId - The ID of the document to update
 * @param currentMeta - The current meta object from the document
 * @param setRepoUrl - Optional callback to update the local state
 * @returns Promise<boolean> - Returns true if successful, false otherwise
 */
export const resetRepoUrl = async (
  documentId: string,
  currentMeta: any,
  setRepoUrl?: (repoUrl: string) => void
): Promise<boolean> => {
  try {
    // Update the document meta to remove repoUrl and related fields
    await upsertDocument({
      id: documentId,
      meta: {
        ...currentMeta,
        repoUrl: '', // Reset to empty string
        githubBranch: undefined, // Clear GitHub branch
        bitbucketBranch: undefined, // Clear Bitbucket branch
      },
    });

    // Update local state if callback provided
    if (setRepoUrl) {
      setRepoUrl('');
    }

    message.success('Repository URL has been reset successfully');
    return true;
  } catch (error) {
    console.error('Failed to reset repository URL:', error);
    message.error('Failed to reset repository URL. Please try again.');
    return false;
  }
};
