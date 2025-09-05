import { Annotation } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  ensureBaseConfiguration,
  BaseConfigurationAnnotation,
} from '../shared/configuration.js';

/**
 * Configuration for quiz generation
 */
export const QuizConfigurationAnnotation = Annotation.Root({
  ...BaseConfigurationAnnotation.spec,

  /**
   * The model to use for quiz generation
   */
    quizModel: Annotation<string>({
    value: (_prev, next) => next,
    default: () => 'openai/gpt-4o-mini',
  }),

  /**
   * Maximum number of questions per quiz
   */
    maxQuestions: Annotation<number>({
    value: (_prev, next) => next,
    default: () => 10,
  }),
});

export function ensureQuizConfiguration(
  config: RunnableConfig,
): typeof QuizConfigurationAnnotation.State {
  const baseConfig = ensureBaseConfiguration(config);
  const configurable = (config?.configurable || {}) as Partial<
    typeof QuizConfigurationAnnotation.State
  >;

  return {
    ...baseConfig,
    quizModel: configurable.quizModel || 'openai/gpt-4o-mini',
    maxQuestions: configurable.maxQuestions || 10,
  };
}
