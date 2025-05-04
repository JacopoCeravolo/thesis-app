import { put } from '@vercel/blob';
import { extractTextFromDocument } from './documentParser';

/**
 * Upload a file to Vercel Blob Storage and extract its text content
 */
export async function uploadDocumentWithText(
  file: Buffer,
  fileName: string,
  fileType: string,
  userId: string
): Promise<{ originalUrl: string; textUrl: string; fileSize: number }> {
  try {
    // Upload the original document
    const originalBlob = await put(`documents/${userId}/${fileName}`, file, {
      contentType: fileType,
      access: 'public',
      allowOverwrite: true,
    });

    // Extract text from the document
    const textContent = await extractTextFromDocument(file, fileType);
    
    // Create a text file name
    const textFileName = `${fileName.split('.')[0]}.txt`;
    
    // Upload the extracted text as a separate file
    const textBlob = await put(`documents/${userId}/text/${textFileName}`, textContent, {
      contentType: 'text/plain',
      access: 'public',
      allowOverwrite: true,
    });

    return {
      originalUrl: originalBlob.url,
      textUrl: textBlob.url,
      fileSize: file.length,
    };
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
}
