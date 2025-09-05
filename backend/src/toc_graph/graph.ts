import { StateGraph, START, END } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';

import { TOCStateAnnotation, TOCSection } from './state.js';
import { ensureTOCConfiguration, TOCConfigurationAnnotation } from './configuration.js';
import { TOC_GENERATION_PROMPT, SECTION_SUMMARY_PROMPT, SECTION_QUIZ_PROMPT, MULTI_SECTION_QUIZ_PROMPT } from './prompts.js';
import { loadChatModel } from '../shared/utils.js';
import { formatDocs } from '../retrieval_graph/utils.js';
import { makeRetriever } from '../shared/retrieval.js';

// Schema for structured TOC output
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

/**
 * Retrieve documents for TOC generation
 */
async function retrieveDocuments(
  _state: typeof TOCStateAnnotation.State,
  config: RunnableConfig,
): Promise<{ documents: any[] }> {
  const retriever = await makeRetriever(config);
  // Retrieve all documents for TOC generation
  const documents = await retriever.invoke('document structure table of contents');
  return { documents };
}

// Schema for quiz questions (reused from quiz graph)
const QuizSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      options: z.array(z.string()).length(4),
      correctAnswer: z.number().min(0).max(3),
      explanation: z.string(),
      source: z.string().optional(),
    }),
  ),
});

/**
 * Generate Table of Contents from documents
 */
async function generateTOC(
  state: typeof TOCStateAnnotation.State,
  config: RunnableConfig,
): Promise<{ toc: TOCSection[] }> {
  const configuration = ensureTOCConfiguration(config);
  const model = await loadChatModel(configuration.tocModel);

  const content = formatDocs(state.documents);

  if (!content || content.trim().length === 0) {
    throw new Error(
      'No content available for TOC generation. Please upload and ingest PDF documents first.',
    );
  }

  const formattedPrompt = await TOC_GENERATION_PROMPT.invoke({
    document_content: content,
  });

  try {
    const response = await model
      .withStructuredOutput(TOCSchema)
      .invoke(formattedPrompt);

    // Process and validate the TOC sections
    const toc: TOCSection[] = response.sections.map((section: any, index: number) => ({
      ...section,
      id: section.id || `section_${index + 1}`,
      level: Math.min(section.level, configuration.maxDepth),
    }));

    return { toc };
  } catch (error) {
    throw new Error('Failed to generate table of contents. Please try again.');
  }
}

/**
 * Generate summary for a specific section
 */
async function generateSectionSummary(
  state: typeof TOCStateAnnotation.State,
  config: RunnableConfig,
  sectionId: string,
): Promise<{ summary: string }> {
  const configuration = ensureTOCConfiguration(config);
  const model = await loadChatModel(configuration.summaryModel);

  const section = state.toc.find(s => s.id === sectionId);
  if (!section) {
    throw new Error(`Section with ID ${sectionId} not found`);
  }

  // Extract section content from documents
  const content = formatDocs(state.documents);
  let sectionContent = '';
  
  if (section.startIndex !== undefined && section.endIndex !== undefined) {
    sectionContent = content.substring(section.startIndex, section.endIndex);
  } else {
    // Fallback: search for section content by title
    const lines = content.split('\n');
    let inSection = false;
    const sectionLines: string[] = [];
    
    for (const line of lines) {
      if (line.toLowerCase().includes(section.title.toLowerCase())) {
        inSection = true;
        continue;
      }
      if (inSection && line.trim() && !line.match(/^[A-Z][A-Z\s]+$/)) {
        sectionLines.push(line);
        if (sectionLines.length > 20) break; // Limit section length
      }
    }
    sectionContent = sectionLines.join('\n');
  }

  if (!sectionContent.trim()) {
    throw new Error(`No content found for section: ${section.title}`);
  }

  const formattedPrompt = await SECTION_SUMMARY_PROMPT.invoke({
    section_title: section.title,
    section_content: sectionContent,
  });

  try {
    const response = await model.invoke(formattedPrompt);
    return { summary: response.content as string };
  } catch (error) {
    throw new Error(`Failed to generate summary for section: ${section.title}`);
  }
}

/**
 * Generate quiz questions for a specific section
 */
async function generateSectionQuiz(
  state: typeof TOCStateAnnotation.State,
  config: RunnableConfig,
  sectionId: string,
  numQuestions: number = 5,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
): Promise<{ questions: any[] }> {
  const configuration = ensureTOCConfiguration(config);
  const model = await loadChatModel(configuration.summaryModel);

  const section = state.toc.find(s => s.id === sectionId);
  if (!section) {
    throw new Error(`Section with ID ${sectionId} not found`);
  }

  // Extract section content (same logic as summary generation)
  const content = formatDocs(state.documents);
  let sectionContent = '';
  
  if (section.startIndex !== undefined && section.endIndex !== undefined) {
    sectionContent = content.substring(section.startIndex, section.endIndex);
  } else {
    const lines = content.split('\n');
    let inSection = false;
    const sectionLines: string[] = [];
    
    for (const line of lines) {
      if (line.toLowerCase().includes(section.title.toLowerCase())) {
        inSection = true;
        continue;
      }
      if (inSection && line.trim() && !line.match(/^[A-Z][A-Z\s]+$/)) {
        sectionLines.push(line);
        if (sectionLines.length > 30) break;
      }
    }
    sectionContent = sectionLines.join('\n');
  }

  if (!sectionContent.trim()) {
    throw new Error(`No content found for section: ${section.title}`);
  }

  const formattedPrompt = await SECTION_QUIZ_PROMPT.invoke({
    section_title: section.title,
    section_content: sectionContent,
    numQuestions,
    difficulty,
  });

  try {
    const response = await model
      .withStructuredOutput(QuizSchema)
      .invoke(formattedPrompt);

    return { questions: response.questions };
  } catch (error) {
    throw new Error(`Failed to generate quiz for section: ${section.title}`);
  }
}

/**
 * Generate quiz questions for multiple sections combined
 */
async function generateMultiSectionQuiz(
  state: typeof TOCStateAnnotation.State,
  config: RunnableConfig,
  sectionIds: string[],
  numQuestions: number = 5,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
): Promise<{ questions: any[] }> {
  const configuration = ensureTOCConfiguration(config);
  const model = await loadChatModel(configuration.summaryModel);

  // Find all specified sections
  const sections = sectionIds.map(id => {
    const section = state.toc.find(s => s.id === id);
    if (!section) {
      throw new Error(`Section with ID ${id} not found`);
    }
    return section;
  });

  // Extract and combine content from all sections
  const content = formatDocs(state.documents);
  const combinedContent: string[] = [];
  const sectionTitles: string[] = [];

  for (const section of sections) {
    sectionTitles.push(section.title);
    let sectionContent = '';
    
    if (section.startIndex !== undefined && section.endIndex !== undefined) {
      sectionContent = content.substring(section.startIndex, section.endIndex);
    } else {
      // Fallback: search for section content by title
      const lines = content.split('\n');
      let inSection = false;
      const sectionLines: string[] = [];
      
      for (const line of lines) {
        if (line.toLowerCase().includes(section.title.toLowerCase())) {
          inSection = true;
          continue;
        }
        if (inSection && line.trim() && !line.match(/^[A-Z][A-Z\s]+$/)) {
          sectionLines.push(line);
          if (sectionLines.length > 50) break; // More content for multi-section
        }
      }
      sectionContent = sectionLines.join('\n');
    }

    if (sectionContent.trim()) {
      combinedContent.push(`=== ${section.title} ===\n${sectionContent}\n`);
    }
  }

  if (combinedContent.length === 0) {
    throw new Error(`No content found for the specified sections: ${sectionIds.join(', ')}`);
  }

  const finalCombinedContent = combinedContent.join('\n\n');

  const formattedPrompt = await MULTI_SECTION_QUIZ_PROMPT.invoke({
    section_titles: sectionTitles.join(', '),
    combined_content: finalCombinedContent,
    numQuestions,
    difficulty,
  });

  try {
    const response = await model
      .withStructuredOutput(QuizSchema)
      .invoke(formattedPrompt);

    return { questions: response.questions };
  } catch (error) {
    throw new Error(`Failed to generate quiz for sections: ${sectionTitles.join(', ')}`);
  }
}

// Define the graph
const builder = new StateGraph(
  TOCStateAnnotation,
  TOCConfigurationAnnotation,
)
  .addNode('retrieveDocuments', retrieveDocuments)
  .addNode('generateTOC', generateTOC)
  .addEdge(START, 'retrieveDocuments')
  .addEdge('retrieveDocuments', 'generateTOC')
  .addEdge('generateTOC', END);

export const graph = builder.compile().withConfig({
  runName: 'TOCGraph',
});

// Export utility functions for direct use
export { generateSectionSummary, generateSectionQuiz, generateMultiSectionQuiz };
