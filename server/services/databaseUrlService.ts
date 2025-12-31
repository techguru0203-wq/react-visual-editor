import fetch from 'node-fetch';
import { DBTYPES } from '../lib/constant';
// just support neon for now
export async function createDbBackend(
  deployDocId: string,
  dbType: DBTYPES
): Promise<string> {
  if (!deployDocId || !dbType) {
    throw new Error('deployDocId and dbType are required');
  }

  let response;
  let data;

  switch (dbType) {
    case DBTYPES.NEON:
      response = await fetch('https://console.neon.tech/api/v2/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEON_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: {
            name: deployDocId,
            region_id: 'aws-us-east-2',
          },
        }),
      });

      data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create Neon project');
      }

      const dbUrl = data?.connection_uris?.[0]?.connection_uri;
      if (!dbUrl) throw new Error('No database URL returned');
      return dbUrl;

    default:
      throw new Error(`Unsupported dbType: ${dbType}`);
  }
}
