import { AgentConfiguration, IndexConfiguration } from '@/types/graphTypes';

type StreamConfigurables = AgentConfiguration;
type IndexConfigurables = IndexConfiguration;
type QuizConfigurables = {
  quizModel: string;
  retrieverProvider: string;
  k: number;
  maxQuestions: number;
};

type TOCConfigurables = {
  tocModel: string;
  summaryModel: string;
  maxSections: number;
  minSectionLength: number;
  includeSubsections: boolean;
  maxDepth: number;
  similarityThreshold: number; // For section grouping
  enableSmartGrouping: boolean;
};

export const retrievalAssistantStreamConfig: StreamConfigurables = {
  queryModel: 'openai/gpt-4o-mini',
  retrieverProvider: 'supabase',
  k: 5,
  filterKwargs: {}, // Will be set dynamically based on session
};

/**
 * The configuration for the indexing/ingestion process.
 */
export const indexConfig: IndexConfigurables = {
  useSampleDocs: false,
  retrieverProvider: 'supabase',
};



export const quizConfig: QuizConfigurables = {
  quizModel: 'openai/gpt-4o-mini',
  retrieverProvider: 'supabase',
  k: 10, // Retrieve more documents for better quiz content
  maxQuestions: 15,
  filterKwargs: {}, // Will be set dynamically based on session
};

export const tocConfig: TOCConfigurables = {
  tocModel: 'openai/gpt-4o-mini',
  summaryModel: 'openai/gpt-4o-mini',
  maxSections: 20,
  minSectionLength: 500,
  includeSubsections: true,
  maxDepth: 3,
  similarityThreshold: 0.8, // 80% similarity for grouping
  enableSmartGrouping: true,
};