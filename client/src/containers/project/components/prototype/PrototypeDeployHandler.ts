import { message } from 'antd';

import { uploadWebpageAssets } from '../../api/deployApi';

export async function handleDeploy(
  docId: string,
  issueId: string,
  sourceUrl: string,
  t?: (key: string) => string
): Promise<boolean> {
  try {
    if (!sourceUrl) {
      throw new Error('Source URL is required');
    }

    message.info(
      t ? t('message.buildingProjectDeploy') : 'Building project...'
    );

    // Upload webpage assets to S3
    const { fileUrl } = await uploadWebpageAssets(docId, issueId, sourceUrl);
    console.log('Webpage assets uploaded to:', fileUrl);

    message.success(
      t
        ? t('message.deploymentCompletedSuccess')
        : 'Deployment completed successfully!'
    );
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    message.error('Deployment failed: ' + errorMessage);

    return false;
  }
}
