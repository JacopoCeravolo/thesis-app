import { v4 as uuidv4 } from 'uuid';
import { STIXBundle } from './stixExtractor';
import { extractStixWithDeepseek } from './deepseekExtractor';
import { extractStixWithGemini } from './geminiExtractor';

/**
 * Extract STIX objects with fallback mechanism
 * First tries DeepSeek, then falls back to Gemini if that fails
 */
export async function extractStixWithFallback(
  documentContent: string,
  documentName: string,
): Promise<STIXBundle> {
  try {
    console.log('[STIX Extraction] Attempting extraction with DeepSeek...');
    // First try with DeepSeek
    const deepseekBundle = await extractStixWithDeepseek(documentContent, documentName);
    
    // Check if we got any STIX objects
    if (deepseekBundle.objects && deepseekBundle.objects.length > 0) {
      console.log('[STIX Extraction] Successfully extracted STIX with DeepSeek');
      return deepseekBundle;
    }
    
    // If DeepSeek returned an empty bundle, try Gemini
    console.log('[STIX Extraction] DeepSeek returned empty bundle, falling back to Gemini...');
    return await extractStixWithGemini(documentContent, documentName);
    
  } catch (error) {
    console.error('[STIX Extraction] DeepSeek extraction failed, falling back to Gemini:', error);
    
    try {
      // Try with Gemini as fallback
      return await extractStixWithGemini(documentContent, documentName);
    } catch (geminiError) {
      console.error('[STIX Extraction] Both DeepSeek and Gemini extraction failed:', geminiError);
      
      // Return an empty bundle if both methods fail
      return {
        type: 'bundle',
        id: `bundle--${uuidv4()}`,
        objects: []
      };
    }
  }
}
