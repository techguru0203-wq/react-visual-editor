import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';

/**
 * Create embeddings instance for query
 */
function createQueryEmbeddingsInstance(): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small',
    timeout: Number(process.env.OPENAI_EMBEDDINGS_TIMEOUT_MS || '120000'),
  });
}

interface SearchResult {
  text: string;
  score: number;
  fileId: string;
  fileName: string;
  metadata: Record<string, any>;
}

/**
 * Search knowledge base for relevant information using langchain
 * @param knowledgeBaseId - ID of the knowledge base to search
 * @param query - Search query
 * @param topK - Number of results to return (default: 5, increased for better recall)
 */
export async function searchKnowledgeBase(
  knowledgeBaseId: string,
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  try {
    const collectionName = `kb_${knowledgeBaseId}`;
    console.log(`Searching in collection: ${collectionName}`);

    // Create embeddings instance
    const embeddings = createQueryEmbeddingsInstance();

    // Connect to existing Qdrant collection
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: process.env.QDRANT_DATABASE_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName,
      }
    );

    // Perform similarity search with scores
    const searchResults = await vectorStore.similaritySearchWithScore(
      query,
      topK
    );

    console.log(`Raw search results count: ${searchResults.length}`);
    if (searchResults.length > 0) {
      const scores = searchResults.map(([_, s]) => s);
      console.log(
        `Score range: ${Math.min(...scores).toFixed(3)} - ${Math.max(
          ...scores
        ).toFixed(3)}`
      );
      console.log(`All scores: ${scores.map((s) => s.toFixed(3)).join(', ')}`);
    }

    // More flexible threshold strategy:
    // - Use 0.3 as base threshold (lower for better recall)
    // - If no results pass threshold, return at least the top result
    const scoreThreshold = 0.3;

    let filteredResults = searchResults.filter(
      ([_doc, score]) => score >= scoreThreshold
    );

    // If no results pass threshold but we have results, take at least the top one
    if (filteredResults.length === 0 && searchResults.length > 0) {
      console.log(
        `⚠️  No results above threshold ${scoreThreshold}, returning top result`
      );
      filteredResults = [searchResults[0]];
    } else if (filteredResults.length < searchResults.length) {
      const filtered = searchResults.length - filteredResults.length;
      console.log(
        `Filtered out ${filtered} results below threshold ${scoreThreshold}`
      );
    }

    const results: SearchResult[] = filteredResults.map(([doc, score]) => ({
      text: doc.pageContent,
      score,
      fileId: doc.metadata.fileId as string,
      fileName: doc.metadata.fileName as string,
      metadata: {
        chunkIndex: doc.metadata.chunkIndex,
        knowledgeBaseId: doc.metadata.knowledgeBaseId,
      },
    }));

    console.log(`Found ${results.length} relevant results`);
    return results;
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    throw error;
  }
}

/**
 * Get context for chat from knowledge base
 * @param knowledgeBaseId - ID of the knowledge base
 * @param query - User query
 * @param topK - Number of context chunks to retrieve
 */
export async function getKnowledgeContext(
  knowledgeBaseId: string,
  query: string,
  topK: number = 3
): Promise<string> {
  try {
    const results = await searchKnowledgeBase(knowledgeBaseId, query, topK);

    if (results.length === 0) {
      return '';
    }

    // Format context with source information
    const context = results
      .map(
        (result, index) =>
          `[Source ${index + 1}: ${result.fileName} (relevance: ${(
            result.score * 100
          ).toFixed(1)}%)]\n${result.text}`
      )
      .join('\n\n---\n\n');

    return context;
  } catch (error) {
    console.error('Error getting knowledge context:', error);
    return '';
  }
}

interface ChatWithKnowledgeBaseInput {
  knowledgeBaseId: string;
  userMessage: string;
  userId: string;
  chatSessionId?: string;
  systemPrompt?: string;
}

interface ChatResponse {
  message: string;
  chatSessionId: string;
  sources: SearchResult[];
}

/**
 * Chat with knowledge base using RAG (Retrieval-Augmented Generation)
 * @param input - Chat input parameters
 */
export async function chatWithKnowledgeBase(
  input: ChatWithKnowledgeBaseInput
): Promise<ChatResponse> {
  const { knowledgeBaseId, userMessage, userId, chatSessionId, systemPrompt } =
    input;

  try {
    // 1. Search knowledge base for relevant context
    // Increase search results for better context coverage
    const searchResults = await searchKnowledgeBase(
      knowledgeBaseId,
      userMessage,
      5
    );

    // 2. Format context from search results
    let context = '';
    if (searchResults.length > 0) {
      context = searchResults
        .map(
          (result, index) =>
            `[Source ${index + 1}: ${result.fileName}]\n${result.text}`
        )
        .join('\n\n---\n\n');
    }

    // 3. Generate chat session if needed
    let sessionId = chatSessionId;
    if (!sessionId) {
      sessionId = `kb_${knowledgeBaseId}_${userId}_${Date.now()}`;
    }

    // 4. Build prompt with context
    const baseSystemPrompt = `You are a helpful AI assistant that answers questions based on the provided knowledge base context. 
    
Instructions:
- Use the context provided below to answer the user's question accurately and comprehensively
- If the context contains relevant information, cite the sources in your response
- If the context doesn't contain enough information to answer the question, politely say so and suggest what information might be needed
- Be concise but thorough in your responses
- Always maintain a professional and helpful tone
- **CRITICAL**: Do NOT use emojis, icons, or special Unicode characters (like ✨, 🚀, 🤖, etc.) in your responses. Keep responses simple with only standard text characters, letters, numbers, and common punctuation marks.`;
    const activeSystemPrompt =
      systemPrompt && systemPrompt.trim().length > 0
        ? systemPrompt
        : baseSystemPrompt;

    const userPrompt = context
      ? `Context from knowledge base:

${context}

---

User question: ${userMessage}

Please answer based on the context above.`
      : `I don't have any relevant information in the knowledge base to answer your question: "${userMessage}". 

Please try rephrasing your question or ask about topics that are covered in the uploaded documents.`;

    // 5. Call OpenAI to generate response using langchain
    const chatModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1000,
    });

    const response = await chatModel.invoke([
      { role: 'system', content: activeSystemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const aiMessage =
      (response.content as string) || 'Sorry, I could not generate a response.';

    return {
      message: aiMessage,
      chatSessionId: sessionId,
      sources: searchResults,
    };
  } catch (error) {
    console.error('Error in chatWithKnowledgeBase:', error);
    throw error;
  }
}
