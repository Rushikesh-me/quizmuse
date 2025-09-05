import { Annotation } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  BaseConfigurationAnnotation,
  ensureBaseConfiguration,
} from '../shared/configuration.js';

/**
 * Configuration for TOC generation
 */
export const TOCConfigurationAnnotation = Annotation.Root({
  ...BaseConfigurationAnnotation.spec,

  /**
   * Model to use for TOC analysis
   */
  tocModel: Annotation<string>({
    value: (_prev, next) => next,
    default: () => 'openai/gpt-4o-mini',
  }),

  /**
   * Model to use for section summarization
   */
  summaryModel: Annotation<string>({
    value: (_prev, next) => next,
    default: () => 'openai/gpt-4o-mini',
  }),

  /**
   * Maximum number of sections to extract
   */
  maxSections: Annotation<number>({
    value: (_prev, next) => next,
    default: () => 20,
  }),

  /**
   * Minimum section length (in characters)
   */
  minSectionLength: Annotation<number>({
    value: (_prev, next) => next,
    default: () => 500,
  }),

  /**
   * Whether to include subsections
   */
  includeSubsections: Annotation<boolean>({
    value: (_prev, next) => next,
    default: () => true,
  }),

  /**
   * Maximum hierarchy depth
   */
  maxDepth: Annotation<number>({
    value: (_prev, next) => next,
    default: () => 3,
  }),
});

export function ensureTOCConfiguration(
  config: RunnableConfig,
): typeof TOCConfigurationAnnotation.State {
  const baseConfig = ensureBaseConfiguration(config);
  const configurable = (config?.configurable || {}) as Partial<
    typeof TOCConfigurationAnnotation.State
  >;

  return {
    ...baseConfig,
    tocModel: configurable.tocModel || 'openai/gpt-4o-mini',
    summaryModel: configurable.summaryModel || 'openai/gpt-4o-mini',
    maxSections: configurable.maxSections || 20,
    minSectionLength: configurable.minSectionLength || 500,
    includeSubsections: configurable.includeSubsections ?? true,
    maxDepth: configurable.maxDepth || 3,
  };
}
