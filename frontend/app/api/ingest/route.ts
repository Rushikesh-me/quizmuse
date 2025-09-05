// app/api/ingest/route.ts
import { indexConfig } from '@/constants/graphConfigs';
import { langGraphServerClient } from '@/lib/langgraph-server';
import { processPDF } from '@/lib/pdf';
import { Document } from '@langchain/core/documents';
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, createErrorResponse, createSuccessResponse, ValidationPatterns } from '@/lib/api-utils';
import { addSessionMetadata } from '@/lib/session-utils';

// Configuration constants
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB
const ALLOWED_FILE_TYPES = ['application/pdf'];

export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!process.env.LANGGRAPH_INGESTION_ASSISTANT_ID) {
    return createErrorResponse(
      'LANGGRAPH_INGESTION_ASSISTANT_ID is not set in your environment variables',
      500
    );
  }

  const formData = await request.formData();
  const files: File[] = [];

  for (const [key, value] of formData.entries()) {
    if (key === 'files' && value instanceof File) {
      files.push(value);
    }
  }
  const tags = JSON.parse((formData.get('tags') as string) || '[]');
  const sessionId = formData.get('sessionId') as string;

  // Validate files
  const fileCountError = ValidationPatterns.fileCount(files, 5);
  if (fileCountError) {
    return createErrorResponse(fileCountError, 400);
  }

  const fileTypeError = ValidationPatterns.fileType(files, ALLOWED_FILE_TYPES);
  if (fileTypeError) {
    return createErrorResponse(fileTypeError, 400);
  }

  const fileSizeError = ValidationPatterns.fileSize(files, MAX_FILE_SIZE);
  if (fileSizeError) {
    return createErrorResponse(fileSizeError, 400);
  }

  // Process all PDFs into Documents with session metadata
  const allDocs: Document[] = [];
  for (const file of files) {
    try {
      const docs = await processPDF(file);
      // Add session metadata to each document
      const docsWithSession = docs.map(doc => ({
        ...doc,
        metadata: addSessionMetadata(doc, sessionId)
      }));
      allDocs.push(...docsWithSession);
    } catch (error: any) {
      // Continue processing other files; errors are logged
    }
  }

  if (!allDocs.length) {
    return createErrorResponse('No valid documents extracted from uploaded files', 500);
  }

  // Run the ingestion graph
  const thread = await langGraphServerClient.createThread();
  const ingestionRun = await langGraphServerClient.client.runs.wait(
    thread.thread_id,
    'ingestion_graph',
    {
      input: {
        docs: allDocs,
        tags,
        sessionId: sessionId || thread.thread_id,
        filename: files[0]?.name || 'unknown.pdf',
      },
      config: {
        configurable: {
          ...indexConfig,
        },
      },
    },
  );

  return createSuccessResponse(
    {
      threadId: thread.thread_id,
      sessionId,
      documentCount: allDocs.length
    },
    'Documents ingested successfully'
  );
});
