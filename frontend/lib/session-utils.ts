import { v4 as uuidv4 } from 'uuid';

/**
 * Session management utilities for document cleanup and isolation
 */

export interface SessionMetadata {
  sessionId: string;
  uploadTimestamp: number;
  lastAccessed: number;
  ttl: number; // Time to live in milliseconds
  userId?: string;
}

export interface DocumentMetadata {
  uuid: string;
  filename?: string;
  source?: string;
  pdf?: any;
  loc?: any;
  // Session-specific metadata
  sessionId: string;
  uploadTimestamp: number;
  lastAccessed: number;
  ttl: number;
  userId?: string;
}

/**
 * Default TTL for documents (48 hours)
 */
export const DEFAULT_TTL = 1 * 60 * 60 * 1000; // 1 hours in milliseconds

/**
 * Creates session metadata for a new session
 */
export function createSessionMetadata(userId?: string): SessionMetadata {
  const now = Date.now();
  return {
    sessionId: uuidv4(),
    uploadTimestamp: now,
    lastAccessed: now,
    ttl: DEFAULT_TTL,
    userId
  };
}

/**
 * Adds session metadata to document metadata
 */
export function addSessionMetadata(
  document: any,
  sessionId: string,
  userId?: string
): DocumentMetadata {
  const now = Date.now();
  return {
    ...document.metadata,
    sessionId,
    uploadTimestamp: now,
    lastAccessed: now,
    ttl: DEFAULT_TTL,
    userId
  };
}

/**
 * Updates the last accessed timestamp for a document
 */
export function updateLastAccessed(metadata: DocumentMetadata): DocumentMetadata {
  return {
    ...metadata,
    lastAccessed: Date.now()
  };
}

/**
 * Checks if a document has expired based on its TTL
 */
export function isDocumentExpired(metadata: DocumentMetadata): boolean {
  const now = Date.now();
  return (now - metadata.lastAccessed) > metadata.ttl;
}

/**
 * Creates a filter for retrieving documents by session
 */
export function createSessionFilter(sessionId: string) {
  return {
    sessionId
  };
}

/**
 * Creates a filter for retrieving documents by section
 */
export function createSectionFilter(sectionId: string) {
  return {
    sectionId
  };
}

/**
 * Creates a filter for retrieving documents by multiple sections
 */
export function createMultiSectionFilter(sectionIds: string[]) {
  return {
    sectionId: sectionIds // This will be handled as an array in the retriever
  };
}

/**
 * Creates a combined filter for session and section
 */
export function createSessionSectionFilter(sessionId: string, sectionId: string) {
  return {
    sessionId,
    sectionId
  };
}

/**
 * Creates a combined filter for session and multiple sections
 */
export function createSessionMultiSectionFilter(sessionId: string, sectionIds: string[]) {
  return {
    sessionId,
    sectionId: sectionIds // This will be handled as an array in the retriever
  };
}

/**
 * Creates a filter for retrieving documents by user
 */
export function createUserFilter(userId: string) {
  return {
    userId
  };
}

/**
 * Creates a filter for retrieving non-expired documents
 */
export function createNonExpiredFilter() {
  const now = Date.now();
  return {
    lastAccessed: { $gte: now - DEFAULT_TTL }
  };
}

/**
 * Combines multiple filters
 */
export function combineFilters(...filters: Record<string, any>[]) {
  return filters.reduce((combined, filter) => ({ ...combined, ...filter }), {});
}
