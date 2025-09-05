import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/langgraph-server';
import { tocConfig } from '@/constants/graphConfigs';
import { createSessionFilter } from '@/lib/session-utils';
import { withErrorHandling, createErrorResponse, createSuccessResponse, ValidationPatterns } from '@/lib/api-utils';
import { getSessionTOC, getDocumentTOC, deleteDocumentTOC } from '../../../lib/toc-service';

export const runtime = 'edge';

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { threadId, view = 'session', filename } = await req.json();

  // Validate threadId
  const threadIdError = ValidationPatterns.threadId(threadId);
  if (threadIdError) {
    return createErrorResponse(threadIdError, 400);
  }

  try {
    if (view === 'individual' && filename) {
      // Get individual document TOC
      const documentTOC = await getDocumentTOC(threadId, filename);
      
      if (!documentTOC) {
        return createErrorResponse(`No TOC found for file: ${filename}`, 404);
      }

      return createSuccessResponse({
        toc: documentTOC.tocData,
        filename: documentTOC.filename,
        view: 'individual',
        threadId,
      });
    } else {
      // Get session TOC (default)
      const sessionTOC = await getSessionTOC(threadId);
      
      if (!sessionTOC) {
        return createSuccessResponse({
          toc: [],
          view: 'session',
          threadId,
          message: 'No TOC data available. Upload PDFs to generate TOC.',
        });
      }

      return createSuccessResponse({
        toc: sessionTOC.unifiedTocData,
        view: 'session',
        threadId,
        lastUpdated: sessionTOC.updatedAt,
      });
    }
  } catch (error) {
    return createErrorResponse(
      'Failed to retrieve TOC data',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

// Endpoint for deleting document TOC
export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const { threadId, filename } = await req.json();

  // Validate required fields
  const threadIdError = ValidationPatterns.threadId(threadId);
  if (threadIdError) {
    return createErrorResponse(threadIdError, 400);
  }

  if (!filename || typeof filename !== 'string') {
    return createErrorResponse('Filename is required', 400);
  }

  try {
    await deleteDocumentTOC(threadId, filename);
    
    return createSuccessResponse({
      message: `TOC deleted for file: ${filename}`,
      threadId,
      filename,
    });
  } catch (error) {
    return createErrorResponse(
      'Failed to delete TOC',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

// Endpoint for getting section summary (placeholder for future implementation)
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const { sectionId, threadId } = await req.json();

  if (!sectionId || !threadId) {
    return createErrorResponse('Section ID and Thread ID are required', 400);
  }

  // Placeholder for future section summary implementation
  return createSuccessResponse({
    summary: 'Section summary functionality will be implemented in the next step.',
    sectionId,
    threadId,
  });
});
