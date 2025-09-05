import { createClient } from '@supabase/supabase-js';
import { Document } from '@langchain/core/documents';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { loadChatModel } from './utils.js';
import { formatDocs } from '../retrieval_graph/utils.js';
import { TOC_GENERATION_PROMPT } from '../toc_graph/prompts.js';

/**
 * TOC Management Service for hybrid section-based TOC with smart grouping
 */

// Environment setup
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase configuration is missing');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Type definitions
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

export interface UnifiedTOCSection extends TOCSection {
  relatedSections: TOCSection[];
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

// Configuration
const TOC_CONFIG = {
  similarityThreshold: 0.8,
  maxSections: 20,
  minSectionLength: 500,
  includeSubsections: true,
  maxDepth: 3,
  enableSmartGrouping: true,
};

// TOC schema for structured output
const TOCSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      level: z.number().min(1).max(5),
      pageNumber: z.number().optional(),
      startIndex: z.number().optional(),
      endIndex: z.number().optional(),
      parentId: z.string().nullable().optional(),
    }),
  ),
});

// Zod schemas for validation
const TOCSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  level: z.number(),
  pageNumber: z.number().optional(),
  startIndex: z.number().optional(),
  endIndex: z.number().optional(),
  parentId: z.string().nullable().optional(),
  filename: z.string(),
  originalId: z.string(),
  groupId: z.string().optional(),
});

const DocumentTOCSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  filename: z.string(),
  fileHash: z.string(),
  tocData: z.array(TOCSectionSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Generate file hash for deduplication
 */
function generateFileHash(content: string, filename: string): string {
  return crypto
    .createHash('sha256')
    .update(content + filename)
    .digest('hex');
}

/**
 * Calculate text similarity using simple string comparison
 * In production, you might want to use more sophisticated similarity algorithms
 */
function calculateSimilarity(text1: string, text2: string): number {
  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);
  
  if (norm1 === norm2) return 1.0;
  
  // Simple Jaccard similarity
  const words1 = new Set(norm1.split(/\s+/));
  const words2 = new Set(norm2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Detect section overlaps and create groups
 */
function detectSectionOverlaps(sections: TOCSection[]): Map<string, TOCSection[]> {
  const groups = new Map<string, TOCSection[]>();
  const processed = new Set<string>();
  
  for (const section of sections) {
    if (processed.has(section.id)) continue;
    
    const group: TOCSection[] = [section];
    processed.add(section.id);
    
    // Find similar sections
    for (const otherSection of sections) {
      if (processed.has(otherSection.id)) continue;
      
      const similarity = calculateSimilarity(section.title, otherSection.title);
      if (similarity >= TOC_CONFIG.similarityThreshold) {
        group.push(otherSection);
        processed.add(otherSection.id);
      }
    }
    
    if (group.length > 1) {
      const groupId = uuidv4();
      group.forEach(s => s.groupId = groupId);
      groups.set(groupId, group);
    }
  }
  
  return groups;
}

/**
 * Generate individual TOC for a single PDF using AI-powered analysis
 */
export async function generateIndividualTOC(
  documents: Document[],
  filename: string,
  sessionId: string
): Promise<TOCSection[]> {
  try {
    // Validate inputs
    if (!Array.isArray(documents) || !filename || !sessionId) {
      throw new Error('Invalid inputs for TOC generation');
    }


    // Use AI to generate TOC from document content
    const model = await loadChatModel('openai/gpt-4o-mini');
    const content = formatDocs(documents);

    if (!content || content.trim().length === 0) {
      throw new Error('No content available for TOC generation');
    }

    const formattedPrompt = await TOC_GENERATION_PROMPT.invoke({
      document_content: content,
      document_count: documents.length,
      max_index: documents.length - 1,
    });

    try {
      const response = await model
        .withStructuredOutput(TOCSchema)
        .invoke(formattedPrompt);

      // Validate AI response
      if (!response || !response.sections || !Array.isArray(response.sections)) {
        throw new Error('Invalid AI response format');
      }

      // Convert AI-generated sections to our TOC format
      const sections: TOCSection[] = response.sections.map((section: any, index: number) => {
        // Calculate proper document boundaries if not provided by AI
        let startIndex = section.startIndex;
        let endIndex = section.endIndex;
        
        if (startIndex === undefined || endIndex === undefined) {
          // Calculate boundaries based on document count and section index
          const documentsPerSection = Math.ceil(documents.length / response.sections.length);
          startIndex = index * documentsPerSection;
          endIndex = Math.min((index + 1) * documentsPerSection - 1, documents.length - 1);
          
        } else {
          // Validate and normalize AI boundaries to match actual document count
          const maxDocIndex = documents.length - 1;
          if (startIndex > maxDocIndex || endIndex > maxDocIndex || startIndex > endIndex) {
            
            // Use calculated boundaries when AI boundaries are invalid
            const documentsPerSection = Math.floor(documents.length / response.sections.length);
            const remainingDocuments = documents.length % response.sections.length;
            
            startIndex = index * documentsPerSection + Math.min(index, remainingDocuments);
            endIndex = startIndex + documentsPerSection - 1;
            
            // Give extra documents to the last few sections
            if (index >= response.sections.length - remainingDocuments) {
              endIndex += 1;
            }
            
            // Ensure endIndex doesn't exceed document count
            endIndex = Math.min(endIndex, documents.length - 1);
            
          } else {
            // AI boundaries are valid - use them as-is
          }
        }
        
        return {
          id: section.id || `section_${index + 1}`,
          title: section.title || `Section ${index + 1}`,
          level: Math.min(Math.max(section.level || 1, 1), 3), // Limit to 1-3 levels
          pageNumber: section.pageNumber,
          startIndex,
          endIndex,
          parentId: section.parentId,
          filename,
          originalId: `section_${index}`,
        };
      });

      // Validate that we have meaningful sections
      if (sections.length === 0) {
        throw new Error('AI generated no sections');
      }

      return sections;
    } catch (error) {
      // Fallback to basic TOC generation if AI fails
      return generateBasicTOC(documents, filename);
    }
  } catch (error) {
    throw new Error(`Failed to generate TOC for ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract title from document content
 */
function extractTitleFromContent(content: string): string | null {
  // Simple title extraction - look for first line that looks like a title
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  for (const line of lines.slice(0, 5)) { // Check first 5 lines
    if (line.length > 10 && line.length < 100 && !line.includes('.')) {
      return line;
    }
  }
  
  return null;
}

/**
 * Fallback basic TOC generation function
 */
function generateBasicTOC(documents: Document[], filename: string): TOCSection[] {
  const sections: TOCSection[] = [];
  
  // Group documents by page and create sections
  const pageGroups = new Map<number, Document[]>();
  documents.forEach(doc => {
    const pageNum = doc.metadata?.loc?.pageNumber || 1;
    if (!pageGroups.has(pageNum)) {
      pageGroups.set(pageNum, []);
    }
    pageGroups.get(pageNum)!.push(doc);
  });
  
  // Create sections from page groups with proper document boundaries
  let sectionIndex = 0;
  let currentDocIndex = 0;
  
  for (const [pageNum, pageDocs] of pageGroups) {
    if (pageDocs.length === 0) continue;
    
    // Extract title from first document in page
    const firstDoc = pageDocs[0];
    const title = extractTitleFromContent(firstDoc.pageContent) || `Section ${sectionIndex + 1}`;
    
    const section: TOCSection = {
      id: uuidv4(),
      title,
      level: 1,
      pageNumber: pageNum,
      startIndex: currentDocIndex,
      endIndex: currentDocIndex + pageDocs.length - 1,
      parentId: null,
      filename,
      originalId: `section_${sectionIndex}`,
    };
    
    sections.push(section);
    currentDocIndex += pageDocs.length;
    sectionIndex++;
  }
  
  return sections;
}

/**
 * Tag documents with section metadata for filtering
 */
export function tagDocumentsWithSectionMetadata(
  documents: Document[],
  tocSections: TOCSection[],
  sessionId: string,
  threadId: string
): Document[] {
  if (!tocSections || tocSections.length === 0) {
    return documents;
  }


  // Sort sections by startIndex to ensure proper ordering
  const sortedSections = [...tocSections].sort((a, b) => (a.startIndex || 0) - (b.startIndex || 0));

  const taggedDocuments = documents.map((doc, docIndex) => {
    // Find which section this document belongs to
    const section = findSectionForDocument(docIndex, sortedSections);
    
    // Add section metadata to document
    const updatedMetadata = {
      ...doc.metadata,
      // Existing session metadata
      sessionId,
      threadId,
      // New section metadata
      sectionId: section?.id || null,
      sectionTitle: section?.title || null,
      sectionLevel: section?.level || null,
      sectionFilename: section?.filename || null,
      documentIndex: docIndex,
      totalDocuments: documents.length,
    };

    // Log section assignment for debugging
    if (docIndex < 5 || docIndex % 50 === 0) { // Log first 5 and every 50th document
    }
    
    // Log if document is assigned to a section that doesn't exist
    if (section && !sortedSections.find(s => s.id === section.id)) {
    }

    return {
      ...doc,
      metadata: updatedMetadata,
    };
  });

  // Log section distribution summary
  const sectionDistribution = new Map<string, number>();
  taggedDocuments.forEach(doc => {
    const sectionId = doc.metadata.sectionId;
    if (sectionId) {
      sectionDistribution.set(sectionId, (sectionDistribution.get(sectionId) || 0) + 1);
    }
  });
  
  sectionDistribution.forEach((_count, _sectionId) => {
    // This was used for debugging but is no longer needed
  });

  return taggedDocuments;
}

/**
 * Find the appropriate section for a document based on its index
 */
function findSectionForDocument(docIndex: number, sortedSections: TOCSection[]): TOCSection | null {
  // If no sections, return null
  if (sortedSections.length === 0) {
    return null;
  }

  // Find the section that contains this document index
  for (let i = sortedSections.length - 1; i >= 0; i--) {
    const section = sortedSections[i];
    const startIndex = section.startIndex || 0;
    const endIndex = section.endIndex || Number.MAX_SAFE_INTEGER;
    
    if (docIndex >= startIndex && docIndex <= endIndex) {
      return section;
    }
  }

  // If no section found, assign to the first section as fallback
  return sortedSections[0] || null;
}

/**
 * Store individual TOC in database
 */
export async function storeDocumentTOC(
  sessionId: string,
  filename: string,
  documents: Document[],
  tocData: TOCSection[]
): Promise<DocumentTOC> {
  try {
    // Generate file hash
    const content = documents.map(doc => doc.pageContent).join('\n');
    const fileHash = generateFileHash(content, filename);
    
    // Prepare data for database
    const tocRecord = {
      session_id: sessionId,
      filename,
      file_hash: fileHash,
      toc_data: tocData,
    };
    
    // Insert or update TOC record
    const { data, error } = await supabase
      .from('document_toc')
      .upsert(tocRecord, { 
        onConflict: 'session_id,file_hash',
        ignoreDuplicates: false 
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    // Validate response
    const validatedData = DocumentTOCSchema.parse({
      id: data.id,
      sessionId: data.session_id,
      filename: data.filename,
      fileHash: data.file_hash,
      tocData: data.toc_data,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    });
    
    return validatedData;
  } catch (error) {
    throw new Error(`Failed to store TOC for ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update session TOC with smart grouping
 */
export async function updateSessionTOC(sessionId: string): Promise<SessionTOC> {
  try {
    // Get all document TOCs for this session
    const { data: documentTOCs, error: fetchError } = await supabase
      .from('document_toc')
      .select('*')
      .eq('session_id', sessionId);
    
    if (fetchError) {
      throw new Error(`Failed to fetch document TOCs: ${fetchError.message}`);
    }
    
    if (!documentTOCs || documentTOCs.length === 0) {
      // Create empty session TOC
      const emptyTOC = {
        session_id: sessionId,
        unified_toc_data: [],
      };
      
      const { data, error } = await supabase
        .from('session_toc')
        .upsert(emptyTOC, { onConflict: 'session_id' })
        .select()
        .single();
      
      if (error) throw new Error(`Database error: ${error.message}`);
      
      return {
        id: data.id,
        sessionId: data.session_id,
        unifiedTocData: [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    }
    
    // Flatten all sections from all documents
    const allSections: TOCSection[] = [];
    documentTOCs.forEach(docTOC => {
      const sections = docTOC.toc_data.map((section: any) => ({
        ...section,
        filename: docTOC.filename,
      }));
      allSections.push(...sections);
    });
    
    // Apply smart grouping if enabled
    let unifiedSections: UnifiedTOCSection[];
    
    if (TOC_CONFIG.enableSmartGrouping) {
      const groups = detectSectionOverlaps(allSections);
      unifiedSections = createUnifiedSections(allSections, groups);
    } else {
      unifiedSections = allSections.map(section => ({
        ...section,
        relatedSections: [],
        isGrouped: false,
      }));
    }
    
    // Store unified TOC
    const unifiedTOC = {
      session_id: sessionId,
      unified_toc_data: unifiedSections,
    };
    
    const { data, error } = await supabase
      .from('session_toc')
      .upsert(unifiedTOC, { onConflict: 'session_id' })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    return {
      id: data.id,
      sessionId: data.session_id,
      unifiedTocData: data.unified_toc_data,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } catch (error) {
    throw new Error(`Failed to update session TOC: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create unified sections with grouping information
 */
function createUnifiedSections(
  sections: TOCSection[],
  groups: Map<string, TOCSection[]>
): UnifiedTOCSection[] {
  const unifiedSections: UnifiedTOCSection[] = [];
  const processed = new Set<string>();
  
  // Add grouped sections
  for (const [, groupSections] of groups) {
    const primarySection = groupSections[0];
    const relatedSections = groupSections.slice(1);
    
    unifiedSections.push({
      ...primarySection,
      relatedSections,
      isGrouped: true,
    });
    
    groupSections.forEach(section => processed.add(section.id));
  }
  
  // Add ungrouped sections
  sections.forEach(section => {
    if (!processed.has(section.id)) {
      unifiedSections.push({
        ...section,
        relatedSections: [],
        isGrouped: false,
      });
    }
  });
  
  // Sort by page number and level
  return unifiedSections.sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) {
      return (a.pageNumber || 0) - (b.pageNumber || 0);
    }
    return a.level - b.level;
  });
}

/**
 * Get session TOC
 */
export async function getSessionTOC(sessionId: string): Promise<SessionTOC | null> {
  try {
    const { data, error } = await supabase
      .from('session_toc')
      .select('*')
      .eq('session_id', sessionId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null;
      }
      throw new Error(`Database error: ${error.message}`);
    }
    
    return {
      id: data.id,
      sessionId: data.session_id,
      unifiedTocData: data.unified_toc_data,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } catch (error) {
    throw new Error(`Failed to get session TOC: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete document TOC
 */
export async function deleteDocumentTOC(sessionId: string, filename: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('document_toc')
      .delete()
      .eq('session_id', sessionId)
      .eq('filename', filename);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    // Update session TOC after deletion
    await updateSessionTOC(sessionId);
  } catch (error) {
    throw new Error(`Failed to delete TOC for ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get individual document TOC
 */
export async function getDocumentTOC(sessionId: string, filename: string): Promise<DocumentTOC | null> {
  try {
    const { data, error } = await supabase
      .from('document_toc')
      .select('*')
      .eq('session_id', sessionId)
      .eq('filename', filename)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null;
      }
      throw new Error(`Database error: ${error.message}`);
    }
    
    return {
      id: data.id,
      sessionId: data.session_id,
      filename: data.filename,
      fileHash: data.file_hash,
      tocData: data.toc_data,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } catch (error) {
    throw new Error(`Failed to get TOC for ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
