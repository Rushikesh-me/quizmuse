/**
 * This "graph" simply exposes an endpoint for a user to upload docs to be indexed.
 */

import { RunnableConfig } from '@langchain/core/runnables';
import { StateGraph, END, START } from '@langchain/langgraph';
import fs from 'fs/promises';

import { IndexStateAnnotation } from './state.js';
import { makeRetriever } from '../shared/retrieval.js';
import {
  ensureIndexConfiguration,
  IndexConfigurationAnnotation,
} from './configuration.js';
import { reduceDocs } from '../shared/state.js';
import { 
  generateIndividualTOC, 
  storeDocumentTOC, 
  updateSessionTOC,
  tagDocumentsWithSectionMetadata
} from '../shared/toc-service.js';

async function ingestDocs(
  state: typeof IndexStateAnnotation.State,
  config?: RunnableConfig,
): Promise<typeof IndexStateAnnotation.Update> {
  if (!config) {
    throw new Error('Configuration required to run index_docs.');
  }

  const configuration = ensureIndexConfiguration(config);
  let docs = state.docs;

  if (!docs || docs.length === 0) {
    if (configuration.useSampleDocs) {
      const fileContent = await fs.readFile(configuration.docsFile, 'utf-8');
      const serializedDocs = JSON.parse(fileContent);
      docs = reduceDocs([], serializedDocs);
    } else {
      throw new Error('No sample documents to index.');
    }
  } else {
    docs = reduceDocs([], docs);
  }

  // Don't store documents yet - we need to tag them with section metadata first
  // Documents will be stored in generateTOC after section tagging
  return {};
}

async function generateTOC(
  state: typeof IndexStateAnnotation.State,
  config?: RunnableConfig,
): Promise<typeof IndexStateAnnotation.Update> {
  if (!config) {
    throw new Error('Configuration required to run generateTOC.');
  }

  const docs = state.docs;
  const sessionId = state.sessionId;
  const filename = state.filename;

  if (!docs || docs.length === 0) {
    return { docs: 'delete' };
  }

  if (!sessionId || !filename) {
    return { docs: 'delete' };
  }


  try {
    // Generate individual TOC for this PDF
    const tocData = await generateIndividualTOC(docs, filename, sessionId);
    
    // Tag documents with section metadata for filtering
    const taggedDocs = tagDocumentsWithSectionMetadata(docs, tocData, sessionId, sessionId);
    
    // Store tagged documents in vector database
    const retriever = await makeRetriever(config);
    await retriever.addDocuments(taggedDocs);
    
    // Store individual TOC in database
    await storeDocumentTOC(sessionId, filename, taggedDocs, tocData);
    
    // Update session TOC with smart grouping
    await updateSessionTOC(sessionId);
    
    
    return { 
      tocGenerated: true,
      tocData: tocData,
      docs: 'delete' // Delete docs after TOC generation is complete
    } as typeof IndexStateAnnotation.Update;
  } catch (error) {
    // Don't fail the entire ingestion if TOC generation fails
    return { 
      tocGenerated: false,
      tocError: error instanceof Error ? error.message : 'Unknown error',
      docs: 'delete' // Still delete docs even if TOC generation fails
    } as typeof IndexStateAnnotation.Update;
  }
}

// Define the graph
const builder = new StateGraph(
  IndexStateAnnotation,
  IndexConfigurationAnnotation,
)
  .addNode('ingestDocs', ingestDocs)
  .addNode('generateTOC', generateTOC)
  .addEdge(START, 'ingestDocs')
  .addEdge('ingestDocs', 'generateTOC')
  .addEdge('generateTOC', END);

// Compile into a graph object that you can invoke and deploy.
export const graph = builder
  .compile()
  .withConfig({ runName: 'IngestionGraph' });
