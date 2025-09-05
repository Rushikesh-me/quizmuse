'use client';
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, RotateCcw, Trophy } from 'lucide-react';
import { QuizQuestion, QuizState, QuizConfig } from '@/types/quizTypes';
import { TOCSection } from '@/types/tocTypes';

interface QuizComponentProps {
  threadId?: string | null;
  tocData?: TOCSection[];
  onComplete?: (score: number, total: number) => void;
}

const QuizComponent: React.FC<QuizComponentProps> = ({
  threadId,
  tocData = [],
  onComplete,
}) => {
  const [quizState, setQuizState] = useState<QuizState>({
    questions: [],
    currentQuestion: 0,
    score: 0,
    userAnswers: [],
    completed: false,
    showFeedback: false,
    selectedAnswer: null,
  });

  const [config, setConfig] = useState<QuizConfig>({
    numQuestions: 5,
    difficulty: 'medium',
    topic: '',
  });

  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [quizStarted, setQuizStarted] = useState(false);

  const generateQuiz = useCallback(async () => {
    if (selectedSections.length === 0) {
      setError('Please select at least one section for the quiz.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Use the single quiz API route for both single and multi-section quizzes
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectionIds: selectedSections,
          numQuestions: config.numQuestions,
          difficulty: config.difficulty,
          threadId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate quiz');
      }

      const data = await response.json();
      // Quiz generated successfully

      if (!data.questions || data.questions.length === 0) {
        throw new Error(
          'No questions generated. Please ensure PDFs are uploaded first.',
        );
      }

      setQuizState({
        questions: data.questions,
        currentQuestion: 0,
        score: 0,
        userAnswers: new Array(data.questions.length).fill(null),
        completed: false,
        showFeedback: false,
        selectedAnswer: null,
      });

      setQuizStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quiz');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSections, config, threadId, tocData]);

  const handleAnswerSelect = (optionIndex: number) => {
    if (quizState.showFeedback) return;

    setQuizState((prev) => ({
      ...prev,
      selectedAnswer: optionIndex,
    }));
  };

  const submitAnswer = () => {
    if (quizState.selectedAnswer === null) return;

    const currentQuestion = quizState.questions[quizState.currentQuestion];
    const isCorrect =
      quizState.selectedAnswer === currentQuestion.correctAnswer;

    const newUserAnswers = [...quizState.userAnswers];
    newUserAnswers[quizState.currentQuestion] = quizState.selectedAnswer;

    setQuizState((prev) => ({
      ...prev,
      showFeedback: true,
      score: prev.score + (isCorrect ? 1 : 0),
      userAnswers: newUserAnswers,
    }));
  };

  const nextQuestion = () => {
    const nextIndex = quizState.currentQuestion + 1;

    if (nextIndex >= quizState.questions.length) {
      // Quiz completed
      setQuizState((prev) => ({
        ...prev,
        completed: true,
      }));
      onComplete?.(
        quizState.score +
          (quizState.selectedAnswer ===
          quizState.questions[quizState.currentQuestion].correctAnswer
            ? 1
            : 0),
        quizState.questions.length,
      );
    } else {
      setQuizState((prev) => ({
        ...prev,
        currentQuestion: nextIndex,
        showFeedback: false,
        selectedAnswer: null,
      }));
    }
  };

  const handleSectionToggle = (sectionId: string) => {
    setSelectedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const restartQuiz = () => {
    setQuizState({
      questions: [],
      currentQuestion: 0,
      score: 0,
      userAnswers: [],
      completed: false,
      showFeedback: false,
      selectedAnswer: null,
    });
    setSelectedSections([]);
    setQuizStarted(false);
    setError('');
  };

  // Quiz setup screen
  if (!quizStarted) {
    return (
      <div className="flex justify-center items-start p-8 min-h-full">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-3xl font-semibold text-foreground">
              <Trophy className="h-6 w-6 text-yellow-500" />
              Start a Quiz
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {tocData.length === 0 ? (
              <div className="text-center p-6 text-muted-foreground italic">
                <p>No table of contents available. Please upload and process PDFs first.</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Select Sections for Quiz</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose one or more sections to generate questions from:
                  </p>
                  
                  <div className="flex flex-col gap-2 max-h-72 overflow-y-auto mb-4 border border-border rounded-lg p-3">
                    {tocData.map((section) => (
                      <div
                        key={section.id}
                        className={`flex items-center justify-between p-3 bg-card border border-border rounded-lg cursor-pointer transition-all duration-200 hover:bg-secondary hover:border-border ${
                          selectedSections.includes(section.id) 
                            ? 'bg-secondary text-foreground border-border' 
                            : ''
                        }`}
                        onClick={() => handleSectionToggle(section.id)}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm leading-tight mb-1">{section.title}</div>
                          {section.pageNumber && (
                            <div className={`text-xs opacity-80 ${
                              selectedSections.includes(section.id) 
                                ? 'text-foreground opacity-90' 
                                : 'text-muted-foreground'
                            }`}>
                              Page {section.pageNumber}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-center w-6 h-6">
                          {selectedSections.includes(section.id) && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedSections.length > 0 && (
                    <div className="p-2 bg-secondary rounded-lg text-center text-sm text-muted-foreground mb-4">
                      <p>
                        {selectedSections.length} section{selectedSections.length > 1 ? 's' : ''} selected
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="numQuestions" className="text-base font-medium text-foreground">
                      Number of Questions
                    </label>
                    <select
                      id="numQuestions"
                      value={config.numQuestions}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          numQuestions: parseInt(e.target.value),
                        }))
                      }
                      className="w-full p-3 border border-border rounded-lg bg-card text-foreground text-base font-sans transition-all duration-200 appearance-none bg-no-repeat bg-right-3 bg-center bg-[length:16px] pr-8 focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      disabled={isLoading}
                    >
                      <option value={5}>5 Questions</option>
                      <option value={10}>10 Questions</option>
                      <option value={15}>15 Questions</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="difficulty" className="text-base font-medium text-foreground">
                      Difficulty Level
                    </label>
                    <select
                      id="difficulty"
                      value={config.difficulty}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          difficulty: e.target.value as 'easy' | 'medium' | 'hard',
                        }))
                      }
                      className="w-full p-3 border border-border rounded-lg bg-card text-foreground text-base font-sans transition-all duration-200 appearance-none bg-no-repeat bg-right-3 bg-center bg-[length:16px] pr-8 focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      disabled={isLoading}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                {error && <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-base">{error}</div>}

                <Button
                  onClick={generateQuiz}
                  disabled={isLoading || selectedSections.length === 0}
                  className="w-full gap-2 px-6 py-3 text-lg font-semibold rounded-lg transition-all duration-300 shadow-sm hover:-translate-y-0.5 hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin loading-spinner" />
                      Generating Quiz...
                    </>
                  ) : (
                    `Generate Quiz from ${selectedSections.length} Section${selectedSections.length !== 1 ? 's' : ''}`
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Quiz completed screen
  if (quizState.completed) {
    const percentage = Math.round(
      (quizState.score / quizState.questions.length) * 100,
    );

    return (
      <div className="flex justify-center items-start p-8 min-h-full">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-3xl font-semibold text-foreground text-center">
              <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              Quiz Completed!
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 text-center">
            <div className="text-6xl font-bold text-primary leading-tight">
              {quizState.score}/{quizState.questions.length}
            </div>
            <div className="text-2xl text-muted-foreground">You scored {percentage}%</div>

            <Badge
              variant={
                percentage >= 80
                  ? 'default'
                  : percentage >= 60
                    ? 'secondary'
                    : 'destructive'
              }
              className="text-lg px-4 py-2"
            >
              {percentage >= 80
                ? 'Excellent!'
                : percentage >= 60
                  ? 'Good Job!'
                  : 'Keep Practicing!'}
            </Badge>

            <div className="w-full flex flex-col gap-2 max-h-48 overflow-y-auto mt-4">
              {quizState.questions.map((question, index) => (
                <div key={question.id} className="flex items-center gap-3 text-left text-base p-2 bg-muted/10 rounded-sm">
                  {quizState.userAnswers[index] === question.correctAnswer ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>
                    Q{index + 1}: {question.question}
                  </span>
                </div>
              ))}
            </div>

            <Button onClick={restartQuiz} className="gap-2 mt-4">
              <RotateCcw className="mr-2 h-4 w-4" />
              Take Another Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Quiz question screen
  const currentQuestion = quizState.questions[quizState.currentQuestion];

  return (
    <div className="flex justify-center items-start p-8 min-h-full">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <CardTitle>
              Question {quizState.currentQuestion + 1} of{' '}
              {quizState.questions.length}
            </CardTitle>
            <Badge variant="outline" className="text-base">
              Score: {quizState.score}/
              {quizState.currentQuestion + (quizState.showFeedback ? 1 : 0)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-8">
          <div className="text-xl font-medium leading-normal text-foreground">{currentQuestion.question}</div>

          <div className="flex flex-col gap-3">
            {currentQuestion.options.map((option, index) => {
              let buttonClass = 'w-full p-4 text-left border-2 rounded-xl transition-all duration-300  cursor-pointer font-sans ';

              if (quizState.showFeedback) {
                if (index === currentQuestion.correctAnswer) {
                  buttonClass += 'border-green-500 bg-green-500/10 text-green-500';
                } else if (
                  index === quizState.selectedAnswer &&
                  index !== currentQuestion.correctAnswer
                ) {
                  buttonClass += 'border-destructive bg-destructive/10 text-destructive';
                } else {
                  buttonClass += 'border-border bg-muted/5 text-muted-foreground';
                }
              } else {
                if (quizState.selectedAnswer === index) {
                  buttonClass += 'border-primary bg-primary/10 text-primary';
                } else {
                  buttonClass += 'border-border text-foreground hover:border-muted-foreground hover:bg-muted/5';
                }
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={quizState.showFeedback}
                  className={buttonClass}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-base">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <span className="flex-1 text-base leading-normal">{option}</span>
                    {quizState.showFeedback &&
                      index === currentQuestion.correctAnswer && (
                        <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />
                      )}
                    {quizState.showFeedback &&
                      index === quizState.selectedAnswer &&
                      index !== currentQuestion.correctAnswer && (
                        <XCircle className="h-5 w-5 text-red-500 ml-auto" />
                      )}
                  </div>
                </button>
              );
            })}
          </div>

          {quizState.showFeedback && (
            <div className="p-6 bg-muted/5 border border-border rounded-xl">
              <h4 className="text-lg font-semibold text-foreground m-0 mb-2">Explanation:</h4>
              <p className="text-foreground leading-normal m-0 mb-2">{currentQuestion.explanation}</p>
              {currentQuestion.source && (
                <p className="text-base text-muted-foreground m-0">
                  Source: {currentQuestion.source}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {!quizState.showFeedback ? (
              <Button
                onClick={submitAnswer}
                disabled={quizState.selectedAnswer === null}
                className="flex-1"
              >
                Submit Answer
              </Button>
            ) : (
              <Button onClick={nextQuestion} className="flex-1">
                {quizState.currentQuestion + 1 >= quizState.questions.length
                  ? 'Finish Quiz'
                  : 'Next Question'}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={restartQuiz}
              className="flex-shrink-0"
            >
              Restart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizComponent;
