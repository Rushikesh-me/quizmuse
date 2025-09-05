import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, createErrorResponse, createSuccessResponse, ValidationPatterns } from '@/lib/api-utils';

export const runtime = 'edge';

// In-memory session tracking (in production, use Redis or database)
const activeSessions = new Map<string, {
  lastHeartbeat: number;
  userId?: string;
}>();

// Cleanup interval for inactive sessions (5 minutes)
const HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute

// Start cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastHeartbeat > HEARTBEAT_TIMEOUT) {
      activeSessions.delete(sessionId);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Heartbeat endpoint for tracking active sessions
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const { sessionId, userId } = await req.json();

  // Validate sessionId
  const sessionIdError = ValidationPatterns.threadId(sessionId);
  if (sessionIdError) {
    return createErrorResponse(sessionIdError, 400);
  }

  const now = Date.now();
  
  // Update or create session tracking
  activeSessions.set(sessionId, {
    lastHeartbeat: now,
    userId
  });

  return createSuccessResponse({
    sessionId,
    lastHeartbeat: now,
    status: 'active'
  });
});

/**
 * GET endpoint to check session status
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return createErrorResponse('Session ID is required', 400);
  }

  const session = activeSessions.get(sessionId);
  const now = Date.now();

  if (!session) {
    return createSuccessResponse({
      sessionId,
      status: 'inactive',
      lastHeartbeat: null
    });
  }

  const isActive = (now - session.lastHeartbeat) < HEARTBEAT_TIMEOUT;

  return createSuccessResponse({
    sessionId,
    status: isActive ? 'active' : 'inactive',
    lastHeartbeat: session.lastHeartbeat,
    userId: session.userId
  });
});

/**
 * DELETE endpoint to manually remove a session
 */
export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const { sessionId } = await req.json();

  const sessionIdError = ValidationPatterns.threadId(sessionId);
  if (sessionIdError) {
    return createErrorResponse(sessionIdError, 400);
  }

  const existed = activeSessions.has(sessionId);
  activeSessions.delete(sessionId);

  return createSuccessResponse({
    sessionId,
    removed: existed,
    message: existed ? 'Session removed' : 'Session not found'
  });
});
