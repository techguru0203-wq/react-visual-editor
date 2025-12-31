import prisma from '../db/prisma';
import { Prisma } from '@prisma/client';

/**
 * Partially update document.meta field using PostgreSQL jsonb operations
 * This avoids race conditions and data loss from full overwrites
 *
 * @param documentId - The document ID to update
 * @param metaUpdates - Partial meta object to merge (supports nested updates)
 * @returns Updated document
 *
 * @example
 * // Simple update
 * await updateDocumentMeta('doc-123', { previewUpdatedAt: new Date().toISOString() });
 *
 * // Nested update
 * await updateDocumentMeta('doc-123', {
 *   envSettings: { preview: { DATABASE_URL: 'new-url' } }
 * });
 *
 * // Delete a field (set to null - field will exist but with null value)
 * await updateDocumentMeta('doc-123', { stripe: null });
 *
 * // To completely remove a field, use deleteDocumentMetaFields instead
 */
export async function updateDocumentMeta(
  documentId: string,
  metaUpdates: Record<string, any>
) {
  // Use Prisma's raw query to leverage PostgreSQL's jsonb || operator for merging
  // This performs a shallow merge at the top level
  // Note: Setting a field to null will keep the field with null value (not delete it)
  const result = await prisma.$executeRaw`
    UPDATE "documents"
    SET meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify(
      metaUpdates
    )}::jsonb
    WHERE id = ${documentId}
  `;

  return result;
}

/**
 * Delete specific fields from document.meta
 * Use this when you need to completely remove fields (not just set to null)
 *
 * @param documentId - The document ID to update
 * @param fieldKeys - Array of field keys to remove from meta
 *
 * @example
 * // Remove the 'stripe' field completely
 * await deleteDocumentMetaFields('doc-123', ['stripe']);
 *
 * // Remove multiple fields
 * await deleteDocumentMetaFields('doc-123', ['oldField1', 'oldField2']);
 */
export async function deleteDocumentMetaFields(
  documentId: string,
  fieldKeys: string[]
) {
  // Use PostgreSQL's - operator to remove keys from jsonb
  // Chain multiple - operations to remove each key safely
  if (fieldKeys.length === 0) {
    return 0;
  }

  // Use parameterized query to prevent SQL injection
  // PostgreSQL jsonb - text[] removes multiple keys at once
  const result = await prisma.$executeRaw`
    UPDATE "documents"
    SET meta = COALESCE(meta, '{}'::jsonb) - ${fieldKeys}::text[]
    WHERE id = ${documentId}
  `;

  return result;
}

/**
 * Deep merge update for nested jsonb fields
 * Use this when you need to merge nested objects without overwriting sibling keys
 *
 * @param documentId - The document ID to update
 * @param metaPath - JSON path to the field (e.g., 'envSettings', 'envSettings.preview')
 * @param value - Value to set at that path
 *
 * @example
 * // Update nested field without affecting other keys
 * await updateDocumentMetaPath('doc-123', 'envSettings.preview.DATABASE_URL', 'new-url');
 */
export async function updateDocumentMetaPath(
  documentId: string,
  metaPath: string,
  value: any
) {
  const pathArray = metaPath.split('.');

  // Prisma's $executeRaw expects the path as an array, which it converts to PostgreSQL text[]
  const result = await prisma.$executeRaw`
    UPDATE "documents"
    SET meta = jsonb_set(
      COALESCE(meta, '{}'::jsonb),
      ${pathArray}::text[],
      ${JSON.stringify(value)}::jsonb,
      true
    )
    WHERE id = ${documentId}
  `;

  return result;
}

/**
 * Batch update multiple documents' meta fields
 * Useful for bulk operations
 */
export async function batchUpdateDocumentMeta(
  updates: Array<{ documentId: string; metaUpdates: Record<string, any> }>
) {
  const results = await Promise.all(
    updates.map(({ documentId, metaUpdates }) =>
      updateDocumentMeta(documentId, metaUpdates)
    )
  );

  return results;
}

/**
 * Helper to safely read meta field with fallback
 */
export async function getDocumentMeta(
  documentId: string
): Promise<Prisma.JsonObject | null> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { meta: true },
  });

  return (doc?.meta as Prisma.JsonObject) || null;
}

/**
 * Update document meta after deployment
 * This is a unified function to handle all deployment-related meta updates
 *
 * @param documentId - The document ID to update
 * @param deploymentResult - Deployment result containing sourceUrl and deploymentId
 * @param target - Deployment target environment ('preview' or 'production')
 *
 * @example
 * // For preview deployment
 * await updateDocumentMetaAfterDeploy('doc-123', {
 *   sourceUrl: 'https://app-preview.vercel.app',
 *   deploymentId: 'dpl_123',
 *   success: true
 * }, 'preview');
 *
 * // For production deployment
 * await updateDocumentMetaAfterDeploy('doc-123', {
 *   sourceUrl: 'https://app.vercel.app',
 *   deploymentId: 'dpl_456',
 *   success: true
 * }, 'production');
 */
export async function updateDocumentMetaAfterDeploy(
  documentId: string,
  deploymentResult: {
    sourceUrl: string;
    deploymentId?: string;
    success: boolean;
  },
  target: 'preview' | 'production' = 'preview'
) {
  if (!deploymentResult.success) {
    console.warn(
      `Skipping meta update for failed deployment: ${documentId}, target: ${target}`
    );
    return;
  }

  const metaUpdates: Record<string, any> = {};

  if (target === 'preview') {
    // Preview deployment updates
    if (deploymentResult.deploymentId) {
      metaUpdates.previewDeploymentId = deploymentResult.deploymentId;
    }
    if (deploymentResult.sourceUrl) {
      metaUpdates.sourceUrl = deploymentResult.sourceUrl;
    }
    metaUpdates.previewUpdatedAt = new Date().toISOString();
  } else {
    // Production deployment updates
    if (deploymentResult.deploymentId) {
      metaUpdates.productionDeploymentId = deploymentResult.deploymentId;
    }
    if (deploymentResult.sourceUrl) {
      metaUpdates.publishUrl = deploymentResult.sourceUrl;
    }
    metaUpdates.publishedAt = new Date().toISOString();
  }

  console.log(
    `Updating document meta after ${target} deployment:`,
    documentId,
    metaUpdates
  );

  await updateDocumentMeta(documentId, metaUpdates);
}
