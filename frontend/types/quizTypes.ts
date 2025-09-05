export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  source?: string;
}

export interface QuizState {
  questions: QuizQuestion[];
  currentQuestion: number;
  score: number;
  userAnswers: (number | null)[];
  completed: boolean;
  showFeedback: boolean;
  selectedAnswer: number | null;
}

export interface QuizConfig {
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topic?: string;
}

export interface QuizGenerationRequest {
  query: string;
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
  threadId?: string;
}

export interface QuizGenerationResponse {
  questions: QuizQuestion[];
  threadId: string;
}
