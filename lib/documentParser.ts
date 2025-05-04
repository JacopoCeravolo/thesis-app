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
        // For PDFs, we'll use a simplified approach that works on serverless
        // This is less accurate but Vercel-compatible
        const pdfText = file.toString('utf-8');
        
        // Extract text content by looking for text markers in the PDF
        // This is a basic approach that works for text-based PDFs
        const extractedText = extractTextFromPdf(pdfText);
        
        if (extractedText.length > 100) {
          return extractedText;
        }
        
        // If little text is found, return a fallback message
        return "PDF content extracted (limited text found). If this is a scanned document, text extraction may be limited.";
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        // Fallback to simple buffer conversion if PDF parsing fails
        try {
          return file.toString('utf-8');
        } catch (e) {
          return 'Unable to parse PDF content';
        }
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

/**
 * Simple text extraction from PDF buffer using regex patterns
 */
function extractTextFromPdf(pdfText: string): string {
  // This is a simplified approach that looks for text elements in the PDF
  // It's not perfect but works for basic text extraction without native dependencies
  let extractedText = '';
  
  // Look for text between parentheses after 'TJ' or 'Tj' operators
  const textMatches = pdfText.match(/\((.*?)\)\s*(TJ|Tj)/g) || [];
  for (const match of textMatches) {
    // Extract the text between parentheses
    const text = match.match(/\((.*?)\)/) || [];
    if (text[1]) {
      extractedText += text[1] + ' ';
    }
  }
  
  // Remove special PDF encoding characters
  extractedText = extractedText.replace(/\\(\d{3}|n|r|t|f|b|\\|\(|\))/g, ' ');
  
  return extractedText.trim();
}
