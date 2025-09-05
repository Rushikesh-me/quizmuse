import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withErrorHandling, createErrorResponse, createSuccessResponse } from '@/lib/api-utils';
import { DEFAULT_TTL } from '@/lib/session-utils';

export const runtime = 'edge';

/**
 * Cleanup API endpoint for removing expired documents
 * This can be called manually or by a cron job
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createErrorResponse(
      'Supabase configuration is missing',
      500
    );
  }

  const { sessionId, force = false } = await req.json();
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    let deletedCount = 0;
    const now = Date.now();

    if (sessionId) {
      // Clean up specific session documents
      const { data: sessionDocs, error: sessionError } = await supabase
        .from('documents')
        .select('id, metadata')
        .eq('metadata->>sessionId', sessionId);

      if (sessionError) {
        throw new Error(`Failed to fetch session documents: ${sessionError.message}`);
      }

      if (sessionDocs && sessionDocs.length > 0) {
        const { error: deleteError } = await supabase
          .from('documents')
          .delete()
          .eq('metadata->>sessionId', sessionId);

        if (deleteError) {
          throw new Error(`Failed to delete session documents: ${deleteError.message}`);
        }

        deletedCount = sessionDocs.length;
      }
    } else {
      // Clean up all expired documents
      const expiredThreshold = now - DEFAULT_TTL;
      
      const { data: expiredDocs, error: fetchError } = await supabase
        .from('documents')
        .select('id, metadata')
        .lt('metadata->>lastAccessed', expiredThreshold.toString());

      if (fetchError) {
        throw new Error(`Failed to fetch expired documents: ${fetchError.message}`);
      }

      if (expiredDocs && expiredDocs.length > 0) {
        const { error: deleteError } = await supabase
          .from('documents')
          .delete()
          .lt('metadata->>lastAccessed', expiredThreshold.toString());

        if (deleteError) {
          throw new Error(`Failed to delete expired documents: ${deleteError.message}`);
        }

        deletedCount = expiredDocs.length;
      }
    }

    return createSuccessResponse(
      {
        deletedCount,
        sessionId: sessionId || 'all',
        timestamp: now
      },
      `Successfully cleaned up ${deletedCount} documents`
    );

  } catch (error) {
    return createErrorResponse(
      'Failed to cleanup documents',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

/**
 * GET endpoint to check cleanup status
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createErrorResponse(
      'Supabase configuration is missing',
      500
    );
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const now = Date.now();
    const expiredThreshold = now - DEFAULT_TTL;

    // Get total document count
    const { count: totalCount, error: totalError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      throw new Error(`Failed to get total count: ${totalError.message}`);
    }

    // Get expired document count
    const { count: expiredCount, error: expiredError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .lt('metadata->>lastAccessed', expiredThreshold.toString());

    if (expiredError) {
      throw new Error(`Failed to get expired count: ${expiredError.message}`);
    }

    return createSuccessResponse({
      totalDocuments: totalCount || 0,
      expiredDocuments: expiredCount || 0,
      activeDocuments: (totalCount || 0) - (expiredCount || 0),
      ttl: DEFAULT_TTL,
      lastChecked: now
    });

  } catch (error) {
    return createErrorResponse(
      'Failed to get cleanup status',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});
