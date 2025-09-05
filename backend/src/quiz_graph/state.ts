import { Annotation } from '@langchain/langgraph';
import { Document } from '@langchain/core/documents';
import { BaseMessage } from '@langchain/core/messages';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  source?: string;
}

export interface QuizState {
  questions: QuizQuestion[];
  currentQuestion: number;
  score: number;
  userAnswers: number[];
  completed: boolean;
}

/**
 * Quiz generation and management state
 */
export const QuizStateAnnotation = Annotation.Root({
  /**
   * The user's query/topic for quiz generation
   */
  query: Annotation<string>,

  /**
   * Session ID for quiz generation
   */
  sessionId: Annotation<string>({
    value: (_prev, next) => next,
    default: () => '',
  }),

  /**
   * Section IDs for section-based quiz generation
   */
  sectionIds: Annotation<string[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),

  /**
   * Retrieved documents to base questions on
   */
  documents: Annotation<Document[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),

  /**
   * Generated quiz questions
   */
  questions: Annotation<QuizQuestion[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),

  /**
   * Number of questions to generate
   */
  numQuestions: Annotation<number>({
    value: (_prev, next) => next,
    default: () => 5,
  }),

  /**
   * Difficulty level (easy, medium, hard)
   */
  difficulty: Annotation<'easy' | 'medium' | 'hard'>({
    value: (_prev, next) => next,
    default: () => 'medium',
  }),

  /**
   * Content analysis results
   */
  contentAnalysis: Annotation<any>({
    value: (_prev, next) => next,
    default: () => null,
  }),

  /**
   * Used question IDs to prevent repetition
   */
  usedQuestionIds: Annotation<string[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),

  /**
   * Messages for the conversation
   */
  messages: Annotation<BaseMessage[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),
});

export type QuizStateType = typeof QuizStateAnnotation.State;
