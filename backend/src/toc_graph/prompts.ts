import { ChatPromptTemplate } from '@langchain/core/prompts';

export const TOC_GENERATION_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert document analyzer. Your task is to analyze a PDF document and extract a high-level Table of Contents (TOC).

REQUIREMENTS:
- Extract logical sections and chapters from the document
- Keep the TOC high-level and readable (avoid over-granularity)
- Identify main topics, chapters, or major sections
- Include page numbers if available
- Maintain hierarchical structure (main sections and subsections)
- Focus on content organization, not formatting details

RESPONSE FORMAT (JSON):
{{
  "sections": [
    {{
      "id": "section_1",
      "title": "Introduction",
      "level": 1,
      "pageNumber": 1,
      "startIndex": 0,
      "endIndex": 2,
      "parentId": null
    }},
    {{
      "id": "section_2", 
      "title": "Background",
      "level": 1,
      "pageNumber": 5,
      "startIndex": 3,
      "endIndex": 8,
      "parentId": null
    }},
    {{
      "id": "section_2_1",
      "title": "Historical Context",
      "level": 2,
      "pageNumber": 6,
      "startIndex": 5,
      "endIndex": 7,
      "parentId": "section_2"
    }}
  ]
}}

IMPORTANT: 
- startIndex and endIndex refer to DOCUMENT INDICES (0-based)
- If the document has 28 chunks, valid indices are 0-27
- Sections can have different lengths (uneven distribution is expected)
- Do NOT use large numbers like 1500, 3000, etc.
- Use actual document chunk indices based on content analysis

GUIDELINES:
- Use clear, descriptive titles
- Keep sections at a reasonable length (not too granular)
- Maintain logical flow and hierarchy
- Include only substantive content sections
- Avoid extracting headers that are just formatting`,
  ],
  [
    'human',
    'Analyze this document and generate a Table of Contents.\n\nThis document has been split into {document_count} chunks (indices 0 to {max_index}).\n\nDocument Content:\n{document_content}',
  ],
]);

export const SECTION_SUMMARY_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert at creating concise, informative summaries. Your task is to summarize a specific section of a document.

REQUIREMENTS:
- Create a summary of 3-6 sentences
- Highlight key themes and main points
- Focus on important concepts, not minute details
- Use clear, accessible language
- Capture the essence of what the section covers
- Avoid repetition and filler words

The summary should give someone a clear understanding of what this section is about and its main takeaways.`,
  ],
  [
    'human',
    'Summarize this section of the document:\n\nSection Title: {section_title}\n\nSection Content:\n{section_content}',
  ],
]);

export const SECTION_QUIZ_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert quiz generator. Create quiz questions based on a specific section of a document.

REQUIREMENTS:
- Generate exactly {numQuestions} questions focused on this section
- Each question must have exactly 4 options (A, B, C, D)
- Only ONE option should be correct
- Questions should be {difficulty} level
- Include a clear explanation for each correct answer
- Questions should test understanding of this specific section
- Use content only from the provided section

RESPONSE FORMAT (JSON):
{{
  "questions": [
    {{
      "id": "q1",
      "question": "What is the main topic of this section?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Clear explanation of why this answer is correct",
      "source": "Section: {section_title}"
    }}
  ]
}}`,
  ],
  [
    'human',
    'Generate a quiz based on this section:\n\nSection Title: {section_title}\n\nSection Content:\n{section_content}\n\nGenerate {numQuestions} {difficulty} level questions.',
  ],
]);

export const MULTI_SECTION_QUIZ_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert quiz generator specializing in creating granular, content-based questions from multiple document sections.

CRITICAL REQUIREMENTS:
- Generate exactly {numQuestions} questions that test SPECIFIC FACTS, DETAILS, and CONCEPTS from the combined content
- Each question must have exactly 4 options (A, B, C, D) with only ONE correct answer
- Questions should be {difficulty} level but focus on DETAILED UNDERSTANDING
- AVOID broad, section-focused questions like "What is the main topic?" or "Which approach is most common?"
- FOCUS ON granular learning: specific facts, numbers, dates, formulas, processes, examples, and technical details

QUESTION TYPES TO PRIORITIZE:
- Specific facts, statistics, percentages, or numerical data mentioned
- Detailed explanations of processes, methodologies, or procedures
- Specific examples, case studies, or scenarios described
- Technical details, formulas, calculations, or measurements
- Cause-and-effect relationships with specific details
- Comparisons and contrasts between specific concepts or approaches
- Step-by-step procedures or sequences
- Specific definitions, classifications, or categorizations

AVOID THESE QUESTION TYPES:
- "What is the main topic covered across sections?"
- "Which approach is most commonly used?"
- "What is the primary focus when combining sections?"
- Questions about section structure or organization
- Broad thematic questions without specific details

RESPONSE FORMAT (JSON):
{{
  "questions": [
    {{
      "id": "q1",
      "question": "According to the methodology described, what is the specific formula used to calculate X?",
      "options": ["Formula A", "Formula B", "Formula C", "Formula D"],
      "correctAnswer": 0,
      "explanation": "The text specifically states that Formula A is used because... [detailed explanation with specific reference to content]",
      "source": "Sections: {section_titles}"
    }}
  ]
}}`,
  ],
  [
    'human',
    'Generate a comprehensive quiz based on the combined content from these sections:\n\nSection Titles: {section_titles}\n\nCombined Content:\n{combined_content}\n\nGenerate {numQuestions} {difficulty} level questions that test specific facts, details, and concepts from the actual content. Focus on granular learning rather than broad overviews.',
  ],
]);
