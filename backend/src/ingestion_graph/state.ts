import { Annotation } from '@langchain/langgraph';
import { Document } from '@langchain/core/documents';
import { reduceDocs } from '../shared/state.js';

// Import TOC types
export interface TOCSection {
  id: string;
  title: string;
  level: number;
  pageNumber?: number;
  startIndex?: number;
  endIndex?: number;
  parentId?: string | null;
  filename: string;
  originalId: string;
  groupId?: string;
}

/**
 * Represents the state for document indexing and retrieval.
 *
 * This interface defines the structure of the index state, which includes
 * the documents to be indexed and the retriever used for searching
 * these documents.
 */
export const IndexStateAnnotation = Annotation.Root({
  /**
   * A list of documents that the agent can index.
   */
  docs: Annotation<
    Document[],
    Document[] | { [key: string]: any }[] | string[] | string | 'delete'
  >({
    default: () => [],
    reducer: reduceDocs,
  }),
  
  /**
   * Session ID for TOC generation and storage
   */
  sessionId: Annotation<string>({
    default: () => '',
    reducer: (x, y) => y ?? x,
  }),
  
  /**
   * Filename for TOC generation and storage
   */
  filename: Annotation<string>({
    default: () => '',
    reducer: (x, y) => y ?? x,
  }),
  
  /**
   * TOC generation status
   */
  tocGenerated: Annotation<boolean>({
    default: () => false,
    reducer: (x, y) => y ?? x,
  }),
  
  /**
   * Generated TOC data
   */
  tocData: Annotation<TOCSection[]>({
    default: () => [],
    reducer: (x, y) => y ?? x,
  }),
  
  /**
   * TOC generation error
   */
  tocError: Annotation<string>({
    default: () => '',
    reducer: (x, y) => y ?? x,
  }),
});

export type IndexStateType = typeof IndexStateAnnotation.State;
