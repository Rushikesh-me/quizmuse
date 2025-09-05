import { createClient } from '@supabase/supabase-js';
import { DEFAULT_TTL } from './session-utils';

/**
 * Comprehensive cleanup service that combines time-based and heartbeat-based cleanup
 */

export interface CleanupStats {
  totalDocuments: number;
  expiredDocuments: number;
  activeDocuments: number;
  sessionsCleaned: number;
  lastCleanup: number;
}

export interface CleanupOptions {
  force?: boolean;
  sessionId?: string;
  dryRun?: boolean;
}

export class CleanupService {
  private supabase: any;
  private activeSessions: Map<string, number> = new Map();

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Register an active session
   */
  registerSession(sessionId: string): void {
    this.activeSessions.set(sessionId, Date.now());
  }

  /**
   * Remove a session from active tracking
   */
  removeSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): string[] {
    const now = Date.now();
    const active: string[] = [];
    
    for (const [sessionId, lastSeen] of this.activeSessions.entries()) {
      if (now - lastSeen < DEFAULT_TTL) {
        active.push(sessionId);
      } else {
        this.activeSessions.delete(sessionId);
      }
    }
    
    return active;
  }

  /**
   * Clean up expired documents based on TTL
   */
  async cleanupExpiredDocuments(options: CleanupOptions = {}): Promise<CleanupStats> {
    const now = Date.now();
    const expiredThreshold = now - DEFAULT_TTL;
    let deletedCount = 0;
    let sessionsCleaned = 0;

    try {
      if (options.sessionId) {
        // Clean up specific session
        const { data: sessionDocs, error: sessionError } = await this.supabase
          .from('documents')
          .select('id, metadata')
          .eq('metadata->>sessionId', options.sessionId);

        if (sessionError) {
          throw new Error(`Failed to fetch session documents: ${sessionError.message}`);
        }

        if (sessionDocs && sessionDocs.length > 0) {
          if (!options.dryRun) {
            const { error: deleteError } = await this.supabase
              .from('documents')
              .delete()
              .eq('metadata->>sessionId', options.sessionId);

            if (deleteError) {
              throw new Error(`Failed to delete session documents: ${deleteError.message}`);
            }
          }

          deletedCount = sessionDocs.length;
          sessionsCleaned = 1;
        }
      } else {
        // Clean up all expired documents
        const { data: expiredDocs, error: fetchError } = await this.supabase
          .from('documents')
          .select('id, metadata')
          .lt('metadata->>lastAccessed', expiredThreshold.toString());

        if (fetchError) {
          throw new Error(`Failed to fetch expired documents: ${fetchError.message}`);
        }

        if (expiredDocs && expiredDocs.length > 0) {
          if (!options.dryRun) {
            const { error: deleteError } = await this.supabase
              .from('documents')
              .delete()
              .lt('metadata->>lastAccessed', expiredThreshold.toString());

            if (deleteError) {
              throw new Error(`Failed to delete expired documents: ${deleteError.message}`);
            }
          }

          deletedCount = expiredDocs.length;
          
          // Count unique sessions cleaned
          const uniqueSessions = new Set(
            expiredDocs.map((doc: any) => doc.metadata?.sessionId).filter(Boolean)
          );
          sessionsCleaned = uniqueSessions.size;
        }
      }

      // Get current stats
      const { count: totalCount } = await this.supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

      const { count: expiredCount } = await this.supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .lt('metadata->>lastAccessed', expiredThreshold.toString());

      return {
        totalDocuments: totalCount || 0,
        expiredDocuments: expiredCount || 0,
        activeDocuments: (totalCount || 0) - (expiredCount || 0),
        sessionsCleaned,
        lastCleanup: now
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Clean up documents from inactive sessions
   */
  async cleanupInactiveSessions(options: CleanupOptions = {}): Promise<CleanupStats> {
    const activeSessions = this.getActiveSessions();
    const now = Date.now();
    let deletedCount = 0;
    let sessionsCleaned = 0;

    try {
      // Get all documents with session metadata
      const { data: allDocs, error: fetchError } = await this.supabase
        .from('documents')
        .select('id, metadata')
        .not('metadata->>sessionId', 'is', null);

      if (fetchError) {
        throw new Error(`Failed to fetch documents: ${fetchError.message}`);
      }

      if (allDocs && allDocs.length > 0) {
        // Find documents from inactive sessions
        const inactiveSessionDocs = allDocs.filter((doc: any) => {
          const sessionId = doc.metadata?.sessionId;
          return sessionId && !activeSessions.includes(sessionId);
        });

        if (inactiveSessionDocs.length > 0) {
          if (!options.dryRun) {
            const inactiveSessionIds = [...new Set(
              inactiveSessionDocs.map((doc: any) => doc.metadata.sessionId)
            )];

            const { error: deleteError } = await this.supabase
              .from('documents')
              .delete()
              .in('metadata->>sessionId', inactiveSessionIds);

            if (deleteError) {
              throw new Error(`Failed to delete inactive session documents: ${deleteError.message}`);
            }
          }

          deletedCount = inactiveSessionDocs.length;
          sessionsCleaned = new Set(
            inactiveSessionDocs.map((doc: any) => doc.metadata.sessionId)
          ).size;
        }
      }

      // Get current stats
      const { count: totalCount } = await this.supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

      const { count: expiredCount } = await this.supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .lt('metadata->>lastAccessed', (now - DEFAULT_TTL).toString());

      return {
        totalDocuments: totalCount || 0,
        expiredDocuments: expiredCount || 0,
        activeDocuments: (totalCount || 0) - (expiredCount || 0),
        sessionsCleaned,
        lastCleanup: now
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform comprehensive cleanup (both time-based and session-based)
   */
  async performComprehensiveCleanup(options: CleanupOptions = {}): Promise<CleanupStats> {
    // First, clean up expired documents
    const expiredStats = await this.cleanupExpiredDocuments(options);
    
    // Then, clean up inactive sessions
    const inactiveStats = await this.cleanupInactiveSessions(options);
    
    // Return combined stats
    return {
      totalDocuments: inactiveStats.totalDocuments,
      expiredDocuments: inactiveStats.expiredDocuments,
      activeDocuments: inactiveStats.activeDocuments,
      sessionsCleaned: expiredStats.sessionsCleaned + inactiveStats.sessionsCleaned,
      lastCleanup: Date.now()
    };
  }

  /**
   * Get cleanup statistics without performing cleanup
   */
  async getCleanupStats(): Promise<CleanupStats> {
    const now = Date.now();
    const expiredThreshold = now - DEFAULT_TTL;

    try {
      const { count: totalCount } = await this.supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

      const { count: expiredCount } = await this.supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .lt('metadata->>lastAccessed', expiredThreshold.toString());

      const activeSessions = this.getActiveSessions();

      return {
        totalDocuments: totalCount || 0,
        expiredDocuments: expiredCount || 0,
        activeDocuments: (totalCount || 0) - (expiredCount || 0),
        sessionsCleaned: 0,
        lastCleanup: now
      };

    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
export const cleanupService = new CleanupService();
