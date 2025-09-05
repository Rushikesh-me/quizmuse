import { VectorStoreRetriever } from '@langchain/core/vectorstores';
import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { createClient } from '@supabase/supabase-js';
import { RunnableConfig } from '@langchain/core/runnables';
import { Document } from '@langchain/core/documents';

import {
  BaseConfigurationAnnotation,
  ensureBaseConfiguration,
} from './configuration.js';

/**
 * Simplified section-aware retriever that uses direct database queries
 */
class SimplifiedSectionRetriever extends VectorStoreRetriever {
  private sectionIds: string[] | null = null;
  private sessionId: string | null = null;
  private supabaseClient: any;

  constructor(vectorStore: any, _config: any, sectionIds?: string[], sessionId?: string) {
    super(vectorStore);
    this.sectionIds = sectionIds || null;
    this.sessionId = sessionId || null;
    this.supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    try {

      if (!this.sectionIds || this.sectionIds.length === 0 || !this.sessionId) {
        // Fall back to regular retrieval if no sections or session specified
        return super._getRelevantDocuments(query);
      }

      // Query documents directly from database by section and session
      let queryBuilder = this.supabaseClient
        .from('documents')
        .select('content, metadata')
        .eq('metadata->>sessionId', this.sessionId)
        .not('content', 'is', null);

      // Add section filtering
      if (this.sectionIds.length === 1) {
        queryBuilder = queryBuilder.eq('metadata->>sectionId', this.sectionIds[0]);
      } else {
        queryBuilder = queryBuilder.in('metadata->>sectionId', this.sectionIds);
      }

      const { data, error } = await queryBuilder.limit(this.k * 2); // Get more docs for better coverage

      if (error) {
        return super._getRelevantDocuments(query);
      }

      if (!data || data.length === 0) {
        return [];
      }


      // Convert to Document format
      const documents = data.map((doc: any) => ({
        pageContent: doc.content,
        metadata: {
          ...doc.metadata,
          source: 'direct_database_query'
        }
      }));

      // Log sample document for debugging
      if (documents.length > 0) {
        console.log('Sample document from direct query:', {
          sectionId: documents[0].metadata?.sectionId,
          sectionTitle: documents[0].metadata?.sectionTitle,
          sessionId: documents[0].metadata?.sessionId,
          contentLength: documents[0].pageContent?.length || 0
        });
      }

      return documents;
    } catch (error) {
      // Fall back to regular retrieval
      return super._getRelevantDocuments(query);
    }
  }
}



export async function makeSupabaseRetriever(
  configuration: typeof BaseConfigurationAnnotation.State,
): Promise<VectorStoreRetriever> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not defined',
    );
  }
  const embeddings = new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
  });
  const supabaseClient = createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );
  
  
  // Use standard retriever for all queries
  const vectorStore = new SupabaseVectorStore(embeddings, {
    client: supabaseClient,
    tableName: 'documents',
    queryName: 'match_documents',
  });
  
  const retriever = vectorStore.asRetriever({
    k: configuration.k,
    filter: configuration.filterKwargs,
  });
  
  return retriever;
}

export async function makeRetriever(
  config: RunnableConfig,
): Promise<VectorStoreRetriever> {
  const configuration = ensureBaseConfiguration(config);
  switch (configuration.retrieverProvider) {
    case 'supabase':
      return makeSupabaseRetriever(configuration);
    default:
      throw new Error(
        `Unsupported retriever provider: ${configuration.retrieverProvider}`,
      );
  }
}

/**
 * Create a simplified section-aware retriever for quiz generation
 */
export async function makeSectionAwareRetriever(
  config: RunnableConfig,
  sectionIds?: string[],
  sessionId?: string
): Promise<VectorStoreRetriever> {
  const configuration = ensureBaseConfiguration(config);
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not defined',
    );
  }

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const supabaseClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );


  const vectorStore = new SupabaseVectorStore(embeddings, {
    client: supabaseClient,
    tableName: 'documents',
    queryName: 'match_documents',
  });

  // Create simplified section-aware retriever
  const retriever = new SimplifiedSectionRetriever(
    vectorStore,
    {
      k: configuration.k,
      filter: configuration.filterKwargs,
    },
    sectionIds,
    sessionId
  );

  return retriever;
}
