import { ChatPromptTemplate } from '@langchain/core/prompts';

export const QUIZ_GENERATION_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert quiz generator. Create high-quality multiple-choice questions based on the provided content.

REQUIREMENTS:
- Generate exactly {numQuestions} questions
- Each question must have exactly 4 options (A, B, C, D)
- Only ONE option should be correct
- Questions should be {difficulty} level
- Include a clear explanation for each correct answer
- Questions should test understanding, not just memorization
- Use content from the provided documents

RESPONSE FORMAT (JSON):
{{
  "questions": [
    {{
      "id": "q1",
      "question": "What is the main topic discussed?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Clear explanation of why this answer is correct",
      "source": "Brief reference to source content"
    }}
  ]
}}`,
  ],
  [
    'human',
    'Based on this content, generate a quiz:\n\n{content}\n\nGenerate {numQuestions} {difficulty} level questions.',
  ],
]);

export const QUIZ_EXPLANATION_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a helpful tutor providing detailed explanations for quiz answers.
    
When a user answers incorrectly, provide:
1. Why their answer was wrong
2. Why the correct answer is right
3. Additional context to help them understand

Keep explanations clear, encouraging, and educational.`,
  ],
  [
    'human',
    `Question: {question}
User selected: {userAnswer}
Correct answer: {correctAnswer}
Original explanation: {originalExplanation}

Please provide a detailed, encouraging explanation.`,
  ],
]);
