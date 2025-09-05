import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'crypto';

/**
 * Quiz Management Service for section-based quiz generation with repetition prevention
 */

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Zod schemas for validation
const QuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().min(0).max(3),
  explanation: z.string(),
  source: z.string().optional(),
});

const QuizSessionSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  sectionIds: z.array(z.string()),
  numQuestions: z.number(),
  difficulty: z.string(),
  questionsUsed: z.array(z.string()),
  createdAt: z.date(),
});

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  source?: string;
}

export interface QuizSession {
  id: string;
  sessionId: string;
  sectionIds: string[];
  numQuestions: number;
  difficulty: string;
  questionsUsed: string[];
  createdAt: Date;
}

export interface ContentAnalysis {
  contentLength: number;
  estimatedQuestions: number;
  needsExternalQuestions: boolean;
  externalQuestionCount: number;
}

/**
 * Analyze content size and determine question generation strategy
 */
export function analyzeContentForQuestions(
  content: string,
  requestedQuestions: number
): ContentAnalysis {
  const contentLength = content.length;
  
  // Estimate questions based on content length
  // Rough estimate: 1 question per 500-800 characters of content
  const estimatedQuestions = Math.max(1, Math.floor(contentLength / 600));
  
  const needsExternalQuestions = estimatedQuestions < requestedQuestions;
  const externalQuestionCount = needsExternalQuestions 
    ? Math.max(0, requestedQuestions - estimatedQuestions)
    : 0;

  return {
    contentLength,
    estimatedQuestions,
    needsExternalQuestions,
    externalQuestionCount,
  };
}

/**
 * Generate a hash for content to identify similar content
 */
export function generateContentHash(content: string, sectionId: string): string {
  const combined = `${sectionId}:${content}`;
  return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

/**
 * Store quiz questions in database
 */
export async function storeQuizQuestions(
  sessionId: string,
  sectionId: string,
  questions: QuizQuestion[],
  difficulty: string,
  questionType: 'document' | 'external' | 'generated' = 'document',
  contentHash?: string
): Promise<void> {
  try {
    const questionsToStore = questions.map(q => ({
      session_id: sessionId,
      section_id: sectionId,
      question_id: q.id,
      question_text: q.question,
      options: q.options,
      correct_answer: q.correctAnswer,
      explanation: q.explanation,
      source: q.source || null,
      difficulty,
      question_type: questionType,
      content_hash: contentHash || null,
    }));

    const { error } = await supabase
      .from('quiz_questions')
      .upsert(questionsToStore, {
        onConflict: 'session_id,section_id,question_id',
        ignoreDuplicates: false
      });

    if (error) {
      throw new Error(`Failed to store quiz questions: ${error.message}`);
    }

  } catch (error) {
    throw error;
  }
}

/**
 * Get previously used questions for a session and section
 */
export async function getUsedQuestions(
  sessionId: string,
  sectionIds: string[]
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('quiz_questions')
      .select('question_id')
      .eq('session_id', sessionId)
      .in('section_id', sectionIds);

    if (error) {
      return [];
    }

    return data?.map(q => q.question_id) || [];
  } catch (error) {
    return [];
  }
}

/**
 * Store quiz session information
 */
export async function storeQuizSession(
  sessionId: string,
  sectionIds: string[],
  numQuestions: number,
  difficulty: string,
  questionsUsed: string[]
): Promise<QuizSession> {
  try {
    const { data, error } = await supabase
      .from('quiz_sessions')
      .insert({
        session_id: sessionId,
        section_ids: sectionIds,
        num_questions: numQuestions,
        difficulty,
        questions_used: questionsUsed,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store quiz session: ${error.message}`);
    }

    const validatedData = QuizSessionSchema.parse({
      id: data.id,
      sessionId: data.session_id,
      sectionIds: data.section_ids,
      numQuestions: data.num_questions,
      difficulty: data.difficulty,
      questionsUsed: data.questions_used,
      createdAt: new Date(data.created_at),
    });

    return validatedData;
  } catch (error) {
    throw error;
  }
}

/**
 * Get available questions for a section (excluding used ones)
 */
export async function getAvailableQuestions(
  sessionId: string,
  sectionId: string,
  difficulty: string,
  limit: number = 10
): Promise<QuizQuestion[]> {
  try {
    const { data, error } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('section_id', sectionId)
      .eq('difficulty', difficulty)
      .limit(limit);

    if (error) {
      return [];
    }

    return data?.map(q => ({
      id: q.question_id,
      question: q.question_text,
      options: q.options,
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
      source: q.source,
    })) || [];
  } catch (error) {
    return [];
  }
}

/**
 * Generate external questions when content is insufficient
 */
export async function generateExternalQuestions(
  topic: string,
  numQuestions: number,
  difficulty: string
): Promise<QuizQuestion[]> {
  try {
    
    const { loadChatModel } = await import('./utils.js');
    const { ChatPromptTemplate } = await import('@langchain/core/prompts');
    
    const model = await loadChatModel('openai/gpt-4o-mini');
    
    const externalQuizPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are an expert quiz generator. Generate {numQuestions} {difficulty} level multiple-choice questions about {topic}.

REQUIREMENTS:
- Generate exactly {numQuestions} questions
- Each question must have exactly 4 options (A, B, C, D)
- Only ONE option should be correct
- Questions should be {difficulty} level
- Include a clear explanation for each correct answer
- Focus on practical knowledge and common scenarios
- Use real-world examples when possible
- Make questions specific to {topic}

RESPONSE FORMAT (JSON):
{{
  "questions": [
    {{
      "id": "ext_q1",
      "question": "What is the main purpose of {topic}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Clear explanation of why this answer is correct",
      "source": "External knowledge base"
    }}
  ]
}}`,
      ],
      [
        'human',
        `Generate {numQuestions} {difficulty} level questions about {topic}. Focus on practical, real-world scenarios and common use cases. Make sure all questions are specifically about {topic}.`,
      ],
    ]);

    const response = await model
      .withStructuredOutput(z.object({
        questions: z.array(QuizQuestionSchema),
      }))
      .invoke(await externalQuizPrompt.invoke({
        numQuestions,
        difficulty,
        topic
      }));

    
    // Validate the response
    if (!response.questions || response.questions.length === 0) {
      return [];
    }

    return response.questions;
  } catch (error) {
    return [];
  }
}



/**
 * Get section content for analysis
 */
export async function getSectionContent(
  sessionId: string,
  sectionId: string
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('content')
      .eq('metadata->>sessionId', sessionId)
      .eq('metadata->>sectionId', sectionId)
      .not('content', 'is', null);

    if (error) {
      return '';
    }

    // Combine all content from the section
    const content = data?.map(doc => doc.content).join('\n') || '';
    return content;
  } catch (error) {
    return '';
  }
}
