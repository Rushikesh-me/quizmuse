import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/langgraph-server';
import { retrievalAssistantStreamConfig } from '@/constants/graphConfigs';
import { createSessionFilter, createSessionSectionFilter } from '@/lib/session-utils';

export const runtime = 'edge';

export async function POST(req: Request) {

  try {
    const { message, threadId, selectedSection } = await req.json();
    if (!message) {
      return new NextResponse(
        JSON.stringify({ error: 'Message is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (!threadId) {
      return new NextResponse(
        JSON.stringify({ error: 'Thread ID is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (!process.env.LANGGRAPH_RETRIEVAL_ASSISTANT_ID) {
      return new NextResponse(
        JSON.stringify({
          error: 'LANGGRAPH_RETRIEVAL_ASSISTANT_ID is not set',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    try {
      const assistantId = process.env.LANGGRAPH_RETRIEVAL_ASSISTANT_ID;
      const serverClient = createServerClient();

      // For now, just use session filtering
      const filterKwargs = createSessionFilter(threadId);

      const stream = await serverClient.client.runs.stream(
        threadId,
        assistantId,
        {
          input: { 
            query: message,
            selectedSection: selectedSection || null
          },
          streamMode: ['messages', 'updates'],
          config: {
            configurable: {
              ...retrievalAssistantStreamConfig,
              filterKwargs,
            },
          },
        },
      );

      // Set up response as a stream
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            // Forward each chunk from the graph to the client
            for await (const chunk of stream) {
              // Only send relevant chunks
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
              );
            }
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: 'Streaming error occurred' })}\n\n`,
              ),
            );
          } finally {
            controller.close();
          }
        },
      });

      // Return the stream with appropriate headers
      return new Response(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } catch (error) {
      // Handle streamRun errors
      return new NextResponse(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    // Handle JSON parsing errors
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
