import { StateGraph, START, END } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';

import { QuizStateAnnotation, QuizQuestion } from './state.js';
import {
  ensureQuizConfiguration,
  QuizConfigurationAnnotation,
} from './configuration.js';
import { QUIZ_GENERATION_PROMPT, QUIZ_EXPLANATION_PROMPT } from './prompts.js';
import { makeRetriever, makeSectionAwareRetriever } from '../shared/retrieval.js';
import { loadChatModel } from '../shared/utils.js';
import { formatDocs } from '../retrieval_graph/utils.js';
import { 
  analyzeContentForQuestions,
  getUsedQuestions,
  getSectionContent,
  generateExternalQuestions,
  storeQuizQuestions,
  storeQuizSession,
  generateContentHash
} from '../shared/quiz-service.js';

// Schema for structured quiz output
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
 * Analyze content and get used questions for section-based quiz
 */
async function analyzeQuizContent(
  state: typeof QuizStateAnnotation.State,
  _config: RunnableConfig,
): Promise<typeof QuizStateAnnotation.Update> {
  try {
    
    // Get used questions to prevent repetition
    const usedQuestionIds = await getUsedQuestions(state.sessionId, state.sectionIds);
    
    // Analyze content for each section using hybrid approach
    let totalContent = '';
    let totalEstimatedQuestions = 0;
    let sectionsWithContent = 0;
    
    for (const sectionId of state.sectionIds) {
      const sectionContent = await getSectionContent(state.sessionId, sectionId);
      
      if (sectionContent && sectionContent.trim().length > 0) {
        totalContent += sectionContent + '\n';
        sectionsWithContent++;
        
        const analysis = analyzeContentForQuestions(sectionContent, state.numQuestions);
        totalEstimatedQuestions += analysis.estimatedQuestions;
        
      } else {
      }
    }
    
    const contentAnalysis = analyzeContentForQuestions(totalContent, state.numQuestions);
    
    // Adjust analysis based on sections with content
    if (sectionsWithContent === 0) {
      contentAnalysis.needsExternalQuestions = true;
      contentAnalysis.externalQuestionCount = state.numQuestions;
      contentAnalysis.estimatedQuestions = 0;
    }
    
    
    return {
      contentAnalysis: contentAnalysis as any,
      usedQuestionIds: usedQuestionIds as any,
    };
  } catch (error) {
    return {
      contentAnalysis: null as any,
      usedQuestionIds: [] as any,
    };
  }
}

/**
 * Retrieve relevant documents for quiz generation using simplified approach
 */
async function retrieveQuizContent(
  state: typeof QuizStateAnnotation.State,
  config: RunnableConfig,
): Promise<{ documents: any[] }> {
  try {
    
    // Use simplified section-aware retriever if section IDs are provided
    const retriever = state.sectionIds && state.sectionIds.length > 0
      ? await makeSectionAwareRetriever(config, state.sectionIds, state.sessionId)
      : await makeRetriever(config);
    
    const query = state.query || 'general knowledge quiz';
    
    const documents = await retriever.invoke(query);
    
    
    // Log sample document metadata for debugging
    if (documents.length > 0) {
      console.log('Sample document metadata:', {
        sectionId: documents[0].metadata?.sectionId,
        sectionTitle: documents[0].metadata?.sectionTitle,
        sessionId: documents[0].metadata?.sessionId,
        hasContent: !!documents[0].pageContent,
        contentLength: documents[0].pageContent?.length || 0,
        contentPreview: documents[0].pageContent?.substring(0, 100) + '...'
      });
      
      // Log all document sections for debugging
      const sectionIds = [...new Set(documents.map(doc => doc.metadata?.sectionId))];
      console.log('Document section IDs:', sectionIds);
    } else {
      console.log('No documents found:', {
        sectionIds: state.sectionIds,
        sessionId: state.sessionId,
        query: state.query
      });
    }

    return { documents };
  } catch (error) {
    // Fall back to regular retrieval
    const retriever = await makeRetriever(config);
    const documents = await retriever.invoke(
      state.query || 'general knowledge quiz',
    );
    return { documents };
  }
}

/**
 * Generate quiz questions from retrieved documents and external sources
 */
async function generateQuiz(
  state: typeof QuizStateAnnotation.State,
  config: RunnableConfig,
): Promise<{ questions: QuizQuestion[] }> {
  const configuration = ensureQuizConfiguration(config);
  const model = await loadChatModel(configuration.quizModel);
  
  let allQuestions: QuizQuestion[] = [];
  
  try {
    // Generate questions from document content
    if (state.documents && state.documents.length > 0) {
      const content = formatDocs(state.documents);
      const contentHash = generateContentHash(content, state.sectionIds.join(','));
      
      
      const numQuestions = Math.min(
        state.numQuestions || 5,
        configuration.maxQuestions,
      );

      const formattedPrompt = await QUIZ_GENERATION_PROMPT.invoke({
        content,
        numQuestions,
        difficulty: state.difficulty || 'medium',
      });

      const response = await model
        .withStructuredOutput(QuizSchema)
        .invoke(formattedPrompt);

      // Filter out used questions
      const newQuestions = response.questions.filter(
        (q: any) => !state.usedQuestionIds.includes(q.id)
      );

      // Store document-based questions
      for (const sectionId of state.sectionIds) {
        await storeQuizQuestions(
          state.sessionId,
          sectionId,
          newQuestions,
          state.difficulty,
          'document',
          contentHash
        );
      }

      allQuestions.push(...newQuestions);
    } else {
    }

    // Generate external questions if needed or if no documents were found
    const needsExternalQuestions = state.contentAnalysis?.needsExternalQuestions || 
                                  (state.documents && state.documents.length === 0) ||
                                  allQuestions.length === 0;
    
    if (needsExternalQuestions) {
      const externalQuestionCount = state.contentAnalysis?.externalQuestionCount || 
                                   (state.numQuestions - allQuestions.length) ||
                                   state.numQuestions;
      
      
      // Extract topic from section titles instead of query
      let topic = 'general knowledge';
      if (state.sectionIds && state.sectionIds.length > 0) {
        // Try to get section titles from the TOC
        try {
          const { getSessionTOC } = await import('../shared/toc-service.js');
          const sessionTOC = await getSessionTOC(state.sessionId);
          if (sessionTOC && sessionTOC.unifiedTocData) {
            const sectionTitles = state.sectionIds
              .map(sectionId => {
                const section = sessionTOC.unifiedTocData.find((s: any) => s.id === sectionId);
                return section ? section.title : sectionId;
              })
              .filter(title => title && !title.startsWith('section_'));
            
            if (sectionTitles.length > 0) {
              topic = sectionTitles.join(' and ');
            }
          }
        } catch (error) {
          // Fallback to section IDs
          topic = state.sectionIds.join(' and ');
        }
      } else {
        topic = state.query || 'general knowledge';
      }
      
      
      const externalQuestions = await generateExternalQuestions(
        topic,
        externalQuestionCount,
        state.difficulty
      );

      // Store external questions
      for (const sectionId of state.sectionIds) {
        await storeQuizQuestions(
          state.sessionId,
          sectionId,
          externalQuestions,
          state.difficulty,
          'external'
        );
      }

      allQuestions.push(...externalQuestions);
    }

    // If we still don't have enough questions, generate more from available content
    if (allQuestions.length < state.numQuestions) {
      const remainingQuestions = state.numQuestions - allQuestions.length;
      
      const additionalQuestions = await generateAdditionalQuestions(
        state,
        model,
        remainingQuestions
      );
      
      allQuestions.push(...additionalQuestions);
    }

    // Limit to requested number of questions
    allQuestions = allQuestions.slice(0, state.numQuestions);
    
    // Store quiz session
    const questionIds = allQuestions.map(q => q.id);
    await storeQuizSession(
      state.sessionId,
      state.sectionIds,
      state.numQuestions,
      state.difficulty,
      questionIds
    );

    return { questions: allQuestions };
    
  } catch (error) {
    throw new Error('Failed to generate quiz questions. Please try again.');
  }
}

/**
 * Generate additional questions from available content
 */
async function generateAdditionalQuestions(
  state: typeof QuizStateAnnotation.State,
  model: any,
  numQuestions: number
): Promise<QuizQuestion[]> {
  try {
    // Get content from all sections
    let totalContent = '';
    for (const sectionId of state.sectionIds) {
      const sectionContent = await getSectionContent(state.sessionId, sectionId);
      totalContent += sectionContent + '\n';
    }

    if (!totalContent.trim()) {
      return [];
    }

    const formattedPrompt = await QUIZ_GENERATION_PROMPT.invoke({
      content: totalContent,
      numQuestions,
      difficulty: state.difficulty || 'medium',
    });

    const response = await model
      .withStructuredOutput(QuizSchema)
      .invoke(formattedPrompt);

    // Filter out used questions
    const newQuestions = response.questions.filter(
      (q: any) => !state.usedQuestionIds.includes(q.id)
    );

    return newQuestions;
  } catch (error) {
    return [];
  }
}

/**
 * Generate detailed explanation for a quiz answer
 */
async function generateExplanation(
  state: typeof QuizStateAnnotation.State,
  config: RunnableConfig,
  questionIndex: number,
  userAnswer: number,
): Promise<string> {
  const configuration = ensureQuizConfiguration(config);
  const model = await loadChatModel(configuration.quizModel);

  const question = state.questions[questionIndex];
  if (!question) return 'Question not found.';

  const formattedPrompt = await QUIZ_EXPLANATION_PROMPT.invoke({
    question: question.question,
    userAnswer: question.options[userAnswer],
    correctAnswer: question.options[question.correctAnswer],
    originalExplanation: question.explanation,
  });

  const response = await model.invoke(formattedPrompt);
  return response.content as string;
}

// Build the quiz graph
const builder = new StateGraph(QuizStateAnnotation, QuizConfigurationAnnotation)
  .addNode('analyzeQuizContent', analyzeQuizContent)
  .addNode('retrieveQuizContent', retrieveQuizContent)
  .addNode('generateQuiz', generateQuiz)
  .addEdge(START, 'analyzeQuizContent')
  .addEdge('analyzeQuizContent', 'retrieveQuizContent')
  .addEdge('retrieveQuizContent', 'generateQuiz')
  .addEdge('generateQuiz', END);

export const graph = builder.compile().withConfig({
  runName: 'QuizGraph',
});

// Export explanation generation as a separate function
export { generateExplanation };
