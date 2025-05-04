import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

// Specify the worker source path
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@3.4.120/legacy/build/pdf.worker.min.js`;

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
        // Load the PDF file
        const pdfData = new Uint8Array(file);
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;
        
        let extractedText = '';
        
        // Extract text from each page
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const textItems = textContent.items.map((item: any) => 
            item.str ? item.str : ''
          ).join(' ');
          
          extractedText += textItems + '\n';
        }
        
        return extractedText || 'No text extracted from PDF';
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
