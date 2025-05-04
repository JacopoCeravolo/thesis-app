import mammoth from 'mammoth';

/**
 * Extract text content from various document types
 */
export async function extractTextFromDocument(
  file: Buffer,
  fileType: string
): Promise<string> {
  try {
    // Handle different file types
    if (fileType === 'application/pdf') {
      try {
        // For PDFs, we'll return a placeholder until we implement a more reliable PDF parser
        // We could use alternatives like pdf.js-extract or pdfjs-dist in the future
        return "PDF content extraction temporarily disabled. PDF uploaded successfully but text extraction is in progress.";
        
        // The previous implementation was causing initialization errors:
        // const pdfData = await pdfParse(file);
        // return pdfData.text || 'No text extracted from PDF';
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        return 'Unable to parse PDF content';
      }
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword'
    ) {
      try {
        // Extract text from Word document
        const result = await mammoth.extractRawText({ buffer: file });
        return result.value || 'No text extracted from document';
      } catch (docError) {
        console.error('Word document parsing error:', docError);
        return 'Unable to parse Word document content';
      }
    } else if (fileType === 'text/plain') {
      // Already text
      return file.toString('utf-8');
    } else if (fileType === 'application/json') {
      // For STIX bundles, just return the JSON as text
      return file.toString('utf-8');
    } else {
      return `Unsupported file type: ${fileType}. Text extraction not available.`;
    }
  } catch (error) {
    console.error('Error extracting text from document:', error);
    // Return a fallback message instead of throwing
    return `Failed to extract text from the document. Please try again with a different file.`;
  }
}
