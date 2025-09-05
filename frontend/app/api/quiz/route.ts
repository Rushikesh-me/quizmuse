import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/langgraph-server';
import { createSessionFilter, createSessionMultiSectionFilter } from '@/lib/session-utils';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { query, numQuestions, difficulty, threadId, sectionIds } = await req.json();

    // Handle section-based quiz generation
    if (sectionIds && Array.isArray(sectionIds) && sectionIds.length > 0) {
      return await handleSectionBasedQuiz(sectionIds, numQuestions, difficulty, threadId);
    }

    // Handle general quiz generation (original functionality)
    if (!query) {
      return NextResponse.json(
        { error: 'Query/topic is required for general quiz generation' },
        { status: 400 },
      );
    }

    const assistantId = process.env.LANGGRAPH_QUIZ_ASSISTANT_ID || 'quiz_graph';
    const serverClient = createServerClient();
    let quizThreadId = threadId;

    // Create new thread if not provided
    if (!quizThreadId) {
      const thread = await serverClient.createThread();
      quizThreadId = thread.thread_id;
    }

    try {
      const result = await serverClient.client.runs.wait(
        quizThreadId,
        assistantId,
        {
          input: {
            query,
            numQuestions: numQuestions || 5,
            difficulty: difficulty || 'medium',
          },
          config: {
            configurable: {
              quizModel: 'openai/gpt-4o-mini',
              retrieverProvider: 'supabase',
              k: 10, // Retrieve more docs for better quiz content
              maxQuestions: 10,
              filterKwargs: createSessionFilter(quizThreadId),
            },
          },
        },
      );

      return NextResponse.json({
        questions: (result as any).questions || [],
        threadId: quizThreadId,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to generate quiz. Please ensure PDFs are uploaded and ingested first.',
        },
        { status: 500 },
      );
    }

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// Handle section-based quiz generation
async function handleSectionBasedQuiz(
  sectionIds: string[],
  numQuestions: number = 5,
  difficulty: string = 'medium',
  threadId: string
) {
  try {
    
    const assistantId = process.env.LANGGRAPH_QUIZ_ASSISTANT_ID || 'quiz_graph';
    const serverClient = createServerClient();
    let quizThreadId = threadId;

    // Create new thread if not provided
    if (!quizThreadId) {
      const thread = await serverClient.createThread();
      quizThreadId = thread.thread_id;
    }

    // Create section-specific query
    const sectionQuery = `Generate quiz questions based on the content from sections: ${sectionIds.join(', ')}. Focus on specific facts, details, and concepts from these sections.`;

    const result = await serverClient.client.runs.wait(
      quizThreadId,
      assistantId,
      {
        input: {
          query: sectionQuery,
          sessionId: quizThreadId, // Pass session ID for question storage
          sectionIds: sectionIds, // Pass section IDs for filtering
          numQuestions: numQuestions || 5,
          difficulty: difficulty || 'medium',
        },
        config: {
          configurable: {
            quizModel: 'openai/gpt-4o-mini',
            retrieverProvider: 'supabase',
            k: 20, // Retrieve more docs for better section coverage
            maxQuestions: 20, // Allow more questions for external generation
            filterKwargs: createSessionMultiSectionFilter(quizThreadId, sectionIds),
          },
        },
      },
    );


    return NextResponse.json({
      questions: (result as any).questions || [],
      sectionIds,
      threadId: quizThreadId,
      contentAnalysis: (result as any).contentAnalysis || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to generate section-based quiz. Please ensure PDFs are uploaded and ingested first.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Endpoint for getting quiz explanations
export async function PUT(req: NextRequest) {
  try {
    const { questionIndex, userAnswer, threadId } = await req.json();

    // This could call the generateExplanation function
    // For now, return a simple response
    return NextResponse.json({
      explanation: 'Detailed explanation would be generated here.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate explanation' },
      { status: 500 },
    );
  }
}
