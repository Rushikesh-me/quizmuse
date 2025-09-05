export interface TOCSection {
  id: string;
  title: string;
  level: number; // 1 for main sections, 2 for subsections, etc.
  pageNumber?: number;
  startIndex?: number; // Character index in document
  endIndex?: number; // Character index in document
  parentId?: string | null; // For hierarchical structure
  summary?: string; // Generated summary of the section
  filename: string; // Document attribution
  originalId: string; // Original section ID from individual TOC
  groupId?: string; // For grouped sections
}

export interface UnifiedTOCSection extends TOCSection {
  relatedSections: TOCSection[]; // Other sections in the same group
  isGrouped: boolean;
}

export interface DocumentTOC {
  id: string;
  sessionId: string;
  filename: string;
  fileHash: string;
  tocData: TOCSection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionTOC {
  id: string;
  sessionId: string;
  unifiedTocData: UnifiedTOCSection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TOCState {
  sections: TOCSection[];
  selectedSection: string | null;
  sectionSummaries: Record<string, string>;
  isLoading: boolean;
  error: string | null;
}

export interface TOCGenerationRequest {
  threadId: string;
}

export interface TOCGenerationResponse {
  toc: TOCSection[];
  threadId: string;
}

export interface SectionSummaryRequest {
  sectionId: string;
  threadId: string;
}

export interface SectionSummaryResponse {
  summary: string;
  sectionId: string;
  threadId: string;
}

export interface SectionQuizRequest {
  sectionId: string;
  numQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  threadId: string;
}

export interface SectionQuizResponse {
  questions: any[]; // QuizQuestion[] from quizTypes
  sectionId: string;
  threadId: string;
}

export interface MultiSectionQuizRequest {
  sectionIds: string[];
  numQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  threadId: string;
}

export interface MultiSectionQuizResponse {
  questions: any[]; // QuizQuestion[] from quizTypes
  sectionIds: string[];
  threadId: string;
}
