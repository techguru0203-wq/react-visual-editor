import { QdrantClient } from '@qdrant/js-client-rest';

let qdrantClient: QdrantClient | null = null;

/**
 * Initialize Qdrant client connection
 */
export function initializeQdrant(): QdrantClient {
  if (!qdrantClient) {
    const url = process.env.QDRANT_DATABASE_URL;
    const apiKey = process.env.QDRANT_API_KEY;

    if (!url) {
      throw new Error('QDRANT_DATABASE_URL environment variable is not set');
    }

    qdrantClient = new QdrantClient({
      url,
      apiKey,
    });

    console.log('✅ Qdrant client initialized');
  }

  return qdrantClient;
}

/**
 * Get Qdrant client instance
 */
export function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    return initializeQdrant();
  }
  return qdrantClient;
}

/**
 * Create a collection in Qdrant
 * @param collectionName - Name of the collection
 * @param vectorSize - Size of the vectors (default: 1536 for OpenAI text-embedding-3-small)
 */
export async function createCollection(
  collectionName: string,
  vectorSize: number = 1536
): Promise<void> {
  const client = getQdrantClient();

  try {
    // Check if collection already exists
    const collections = await client.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === collectionName
    );

    if (exists) {
      console.log(`Collection ${collectionName} already exists`);
      return;
    }

    // Create new collection
    await client.createCollection(collectionName, {
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
      },
    });

    console.log(`✅ Created collection: ${collectionName}`);
  } catch (error) {
    console.error(`Error creating collection ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Delete a collection from Qdrant
 * @param collectionName - Name of the collection to delete
 */
export async function deleteCollection(collectionName: string): Promise<void> {
  const client = getQdrantClient();

  try {
    await client.deleteCollection(collectionName);
    console.log(`✅ Deleted collection: ${collectionName}`);
  } catch (error) {
    console.error(`Error deleting collection ${collectionName}:`, error);
    throw error;
  }
}

interface VectorPoint {
  id: string;
  vector: number[];
  payload?: Record<string, any>;
}

/**
 * Insert or update vectors in a collection
 * @param collectionName - Name of the collection
 * @param points - Array of vector points to upsert
 */
export async function upsertVectors(
  collectionName: string,
  points: VectorPoint[]
): Promise<void> {
  const client = getQdrantClient();

  try {
    await client.upsert(collectionName, {
      wait: true,
      points: points.map((point) => ({
        id: point.id,
        vector: point.vector,
        payload: point.payload || {},
      })),
    });

    console.log(
      `✅ Upserted ${points.length} vectors to collection: ${collectionName}`
    );
  } catch (error) {
    console.error(`Error upserting vectors to ${collectionName}:`, error);
    throw error;
  }
}

interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}

/**
 * Search for similar vectors in a collection
 * @param collectionName - Name of the collection
 * @param queryVector - Query vector to search for
 * @param topK - Number of results to return (default: 5)
 * @param scoreThreshold - Minimum similarity score (default: 0.7)
 */
export async function searchVectors(
  collectionName: string,
  queryVector: number[],
  topK: number = 5,
  scoreThreshold: number = 0.7
): Promise<SearchResult[]> {
  const client = getQdrantClient();

  try {
    const searchResults = await client.search(collectionName, {
      vector: queryVector,
      limit: topK,
      score_threshold: scoreThreshold,
      with_payload: true,
    });

    return searchResults.map((result) => ({
      id: result.id.toString(),
      score: result.score,
      payload: result.payload as Record<string, any>,
    }));
  } catch (error) {
    console.error(`Error searching vectors in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Delete vectors from a collection
 * @param collectionName - Name of the collection
 * @param ids - Array of vector IDs to delete
 */
export async function deleteVectors(
  collectionName: string,
  ids: string[]
): Promise<void> {
  const client = getQdrantClient();

  if (!ids || ids.length === 0) {
    console.warn(`⚠️  No vector IDs for deletion from ${collectionName}`);
    return;
  }

  try {
    await client.delete(collectionName, {
      wait: true,
      points: ids,
    });

    console.log(`✅ Deleted ${ids.length} vectors from ${collectionName}`);
  } catch (error: any) {
    console.error(
      `❌ Failed to delete vectors from ${collectionName}: ${error.message}`
    );
    throw new Error(
      `Failed to delete vectors from Qdrant collection ${collectionName}: ${error.message}`
    );
  }
}

/**
 * Delete vectors from a collection by metadata filter
 * Useful for deleting vectors when we don't have the exact IDs stored
 * @param collectionName - Name of the collection
 * @param filter - Metadata filter (e.g., { fileId: 'abc123' })
 */
export async function deleteVectorsByFilter(
  collectionName: string,
  filter: Record<string, any>
): Promise<number> {
  const client = getQdrantClient();

  try {
    const result = await client.delete(collectionName, {
      wait: true,
      filter: {
        must: Object.entries(filter).map(([key, value]) => ({
          key,
          match: { value },
        })),
      },
    });

    console.log(
      `✅ Deleted vectors by filter (${JSON.stringify(
        filter
      )}) from ${collectionName}`
    );
    return result.operation_id || 0;
  } catch (error: any) {
    console.error(
      `❌ Failed to delete vectors by filter from ${collectionName}: ${error.message}`
    );
    throw new Error(
      `Failed to delete vectors by filter from Qdrant collection ${collectionName}: ${error.message}`
    );
  }
}

/**
 * Get collection info
 * @param collectionName - Name of the collection
 */
export async function getCollectionInfo(collectionName: string): Promise<any> {
  const client = getQdrantClient();

  try {
    const info = await client.getCollection(collectionName);
    return info;
  } catch (error) {
    console.error(
      `Error getting collection info for ${collectionName}:`,
      error
    );
    throw error;
  }
}
