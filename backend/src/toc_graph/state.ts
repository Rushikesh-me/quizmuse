import { Annotation } from '@langchain/langgraph';
import { Document } from '@langchain/core/documents';

/**
 * Table of Contents section structure
 */
export interface TOCSection {
  id: string;
  title: string;
  level: number; // 1 for main sections, 2 for subsections, etc.
  pageNumber?: number;
  startIndex?: number; // Character index in document
  endIndex?: number; // Character index in document
  parentId?: string | null; // For hierarchical structure
  summary?: string; // Generated summary of the section
}

/**
 * Table of Contents generation state
 */
export const TOCStateAnnotation = Annotation.Root({
  /**
   * The documents to analyze for TOC generation
   */
  documents: Annotation<Document[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),

  /**
   * Generated table of contents
   */
  toc: Annotation<TOCSection[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),

  /**
   * Currently selected section for context
   */
  selectedSection: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),

  /**
   * Section summaries cache
   */
  sectionSummaries: Annotation<Record<string, string>>({
    value: (_prev, next) => next,
    default: () => ({}),
  }),

  /**
   * Messages for conversation context
   */
  messages: Annotation<any[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),
});

export type TOCStateType = typeof TOCStateAnnotation.State;
