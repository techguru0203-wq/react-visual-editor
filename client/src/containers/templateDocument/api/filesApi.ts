import { RcFile } from 'antd/es/upload';

import { getFormHeaders } from '../../../common/util/apiHeaders';
import { api_url } from '../../../lib/constants';

interface UploadSingleFileParams {
  file: string | Blob | RcFile;
  s3BucketName: string;
}

export async function uploadSingleFileApi(
  params: UploadSingleFileParams
): Promise<string> {
  const { file, s3BucketName } = params;
  const headers = await getFormHeaders();

  const formData = new FormData();
  formData.append('file', file);

  const result = await fetch(`${api_url}/api/files/upload/${s3BucketName}`, {
    method: 'POST',
    headers: headers,
    credentials: 'include',
    body: formData,
  });
  console.log(result);
  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error loading team: ' + errorMsg);
  }
}

interface BuildFile {
  file: Blob;
  path: string;
}
export async function uploadBuiltFileApi(
  file: BuildFile,
  docId: string
): Promise<string[]> {
  const headers = await getFormHeaders();
  const formData = new FormData();

  // Append each file with a unique name
  formData.append('file', file.file);

  // Add file paths as a separate field

  const result = await fetch(
    `${api_url}/api/files/upload-built-file/${docId}`,
    {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: formData,
    }
  );

  const { success, data, errorMsg } = await result.json();
  if (success) {
    return data;
  } else {
    throw new Error('Error uploading build files: ' + errorMsg);
  }
}
