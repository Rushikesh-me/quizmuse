import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, createErrorResponse, createSuccessResponse } from '@/lib/api-utils';
import { cleanupService } from '@/lib/cleanup-service';

export const runtime = 'edge';

/**
 * Comprehensive cleanup endpoint that combines time-based and session-based cleanup
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const { 
    sessionId, 
    force = false, 
    dryRun = false,
    strategy = 'comprehensive' // 'expired', 'inactive', 'comprehensive'
  } = await req.json();

  try {
    let stats;

    switch (strategy) {
      case 'expired':
        stats = await cleanupService.cleanupExpiredDocuments({ 
          sessionId, 
          force, 
          dryRun 
        });
        break;
      
      case 'inactive':
        stats = await cleanupService.cleanupInactiveSessions({ 
          sessionId, 
          force, 
          dryRun 
        });
        break;
      
      case 'comprehensive':
      default:
        stats = await cleanupService.performComprehensiveCleanup({ 
          sessionId, 
          force, 
          dryRun 
        });
        break;
    }

    return createSuccessResponse(
      {
        ...stats,
        strategy,
        dryRun,
        sessionId: sessionId || 'all'
      },
      `Cleanup completed: ${stats.sessionsCleaned} sessions, ${stats.expiredDocuments} documents`
    );

  } catch (error) {
    return createErrorResponse(
      'Failed to perform comprehensive cleanup',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

/**
 * GET endpoint to check cleanup status and statistics
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  try {
    const stats = await cleanupService.getCleanupStats();
    const activeSessions = cleanupService.getActiveSessions();

    return createSuccessResponse({
      ...stats,
      activeSessions: activeSessions.length,
      activeSessionIds: activeSessions
    });

  } catch (error) {
    return createErrorResponse(
      'Failed to get cleanup status',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});
