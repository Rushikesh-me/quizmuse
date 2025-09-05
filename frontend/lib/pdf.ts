import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Document } from '@langchain/core/documents';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

/**
 * Processes a PDF file by parsing it into Document objects.
 * @param file - The PDF file to process.
 * @returns An array of Document objects extracted from the PDF.
 */
export async function processPDF(file: File): Promise<Document[]> {
  const buffer = await bufferFile(file);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-'));
  const tempFilePath = path.join(tempDir, file.name);

  try {
    await fs.writeFile(tempFilePath, buffer);
    const loader = new PDFLoader(tempFilePath);
    const docs = await loader.load();

    // Add filename to metadata for each document
    docs.forEach((doc) => {
      doc.metadata.filename = file.name;
    });

    return docs;
  } finally {
    // Clean up temporary files
    await fs
      .unlink(tempFilePath)
      .catch(() => {});
    await fs
      .rmdir(tempDir)
      .catch(() => {});
  }
}

/**
 * Converts a File object to a Buffer.
 * @param file - The uploaded file.
 * @returns A Buffer containing the file content.
 */
async function bufferFile(file: File): Promise<Buffer> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer;
  } catch (error) {
    throw new Error('Failed to read file content.');
  }
}
