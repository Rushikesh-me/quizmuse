import { createClient } from '@supabase/supabase-js';

/**
 * Frontend TOC Service for database operations
 */

// Environment setup
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase configuration is missing');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
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
  } catch (error) {
    throw new Error(`Failed to delete TOC for ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all document TOCs for a session
 */
export async function getAllDocumentTOCs(sessionId: string): Promise<DocumentTOC[]> {
  try {
    const { data, error } = await supabase
      .from('document_toc')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    return (data || []).map(item => ({
      id: item.id,
      sessionId: item.session_id,
      filename: item.filename,
      fileHash: item.file_hash,
      tocData: item.toc_data,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    }));
  } catch (error) {
    throw new Error(`Failed to get document TOCs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
