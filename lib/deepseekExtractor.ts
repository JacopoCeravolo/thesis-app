import { v4 as uuidv4 } from 'uuid';
import { put } from '@vercel/blob';
import { STIXBundle, STIXObject } from './stixExtractor';
import fs from 'fs';
import path from 'path';

// DeepSeek model configuration
const DEEPSEEK_API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek/deepseek-chat:free';

/**
 * Extract STIX objects from document content using DeepSeek API
 */
export async function extractStixWithDeepseek(
  documentContent: string,
  documentName: string,
): Promise<STIXBundle> {
  console.log(`[STIX Extraction] Starting extraction for document: ${documentName}`);
  console.log(`[STIX Extraction] Document content length: ${documentContent.length} characters`);
  
  // Initialize the DeepSeek API headers
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[STIX Extraction] DEEPSEEK_API_KEY is not set in environment variables');
    throw new Error('DEEPSEEK_API_KEY is not set in environment variables');
  }
  console.log('[STIX Extraction] Successfully retrieved DeepSeek API key');

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  console.log('[STIX Extraction] Initialized DeepSeek API headers');

  try {
    // Read the extraction prompt
    const promptPath = path.join(process.cwd(), 'prompts', 'one-shot-extraction.txt');
    console.log(`[STIX Extraction] Reading prompt from: ${promptPath}`);
    
    let systemPrompt;
    try {
      systemPrompt = fs.readFileSync(promptPath, 'utf-8');
      console.log(`[STIX Extraction] Successfully loaded prompt (${systemPrompt.length} characters)`);
    } catch (error: any) {
      console.error(`[STIX Extraction] Error reading prompt file:`, error);
      throw new Error(`Failed to read prompt file: ${error.message}`);
    }
    
    // Prepare content for extraction
    const content = `Text:\n${documentContent}`;
    console.log(`[STIX Extraction] Prepared content for DeepSeek (total length: ${content.length} characters)`);
    
    // Prepare request payload
    const requestData = {
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: content }
      ],
      temperature: 0.1,
      max_tokens: 4000
    };
    
    // Call DeepSeek API
    console.log('[STIX Extraction] Calling DeepSeek API...');
    const startTime = Date.now();
    
    const response = await fetch(DEEPSEEK_API_ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestData),
    });
    
    const endTime = Date.now();
    console.log(`[STIX Extraction] DeepSeek API call completed in ${endTime - startTime}ms`);
    
    if (!response.ok) {
      console.error(`[STIX Extraction] DeepSeek API responded with status: ${response.status}`);
      const errorText = await response.text();
      console.error(`[STIX Extraction] Error response: ${errorText}`);
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }
    
    // Extract response data
    const responseData = await response.json();
    console.log('[STIX Extraction] Raw DeepSeek response:', JSON.stringify(responseData));
    
    // Extract text from response
    const responseText = responseData.choices[0].message.content;
    console.log(`[STIX Extraction] Response text length: ${responseText?.length || 0} characters`);
    
    // Check for empty response
    if (!responseText || responseText.trim() === '') {
      console.error('[STIX Extraction] DeepSeek API returned an empty response');
      throw new Error('DeepSeek API returned an empty response');
    }
    
    console.log('[STIX Extraction] Response text preview:', responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
    
    // Clean up and parse the JSON response
    console.log('[STIX Extraction] Cleaning and parsing JSON response...');
    const cleanedText = cleanJsonResponse(responseText);
    console.log('[STIX Extraction] Cleaned text:', cleanedText.substring(0, 500) + (cleanedText.length > 500 ? '...' : ''));
    
    let stixData;
    try {
      stixData = JSON.parse(cleanedText);
      console.log('[STIX Extraction] Successfully parsed JSON response');
    } catch (error: any) {
      console.error('[STIX Extraction] Failed to parse JSON response:', error);
      console.log('[STIX Extraction] Failed JSON content:', cleanedText);
      
      // Attempt to recover from truncated JSON
      if (error.message.includes('Unexpected end of JSON input')) {
        console.log('[STIX Extraction] Detected truncated JSON, attempting to repair...');
        try {
          // Try to fix truncated array by adding closing bracket
          if (cleanedText.trim().startsWith('[')) {
            // Count opening and closing brackets to see if they're unbalanced
            const openBrackets = (cleanedText.match(/\[/g) || []).length;
            const closeBrackets = (cleanedText.match(/\]/g) || []).length;
            
            if (openBrackets > closeBrackets) {
              // Add missing closing brackets
              const missingBrackets = openBrackets - closeBrackets;
              const repairedJson = cleanedText + ']'.repeat(missingBrackets);
              console.log('[STIX Extraction] Added missing closing brackets to repair JSON');
              
              // Try parsing the repaired JSON
              stixData = JSON.parse(repairedJson);
              console.log('[STIX Extraction] Successfully parsed repaired JSON');
            }
          } 
          // Try to fix truncated object by adding closing brace
          else if (cleanedText.trim().startsWith('{')) {
            // Count opening and closing braces to see if they're unbalanced
            const openBraces = (cleanedText.match(/\{/g) || []).length;
            const closeBraces = (cleanedText.match(/\}/g) || []).length;
            
            if (openBraces > closeBraces) {
              // Add missing closing braces
              const missingBraces = openBraces - closeBraces;
              const repairedJson = cleanedText + '}'.repeat(missingBraces);
              console.log('[STIX Extraction] Added missing closing braces to repair JSON');
              
              // Try parsing the repaired JSON
              stixData = JSON.parse(repairedJson);
              console.log('[STIX Extraction] Successfully parsed repaired JSON');
            }
          }
          
          // If we still don't have valid stixData after repair attempts
          if (!stixData) {
            console.log('[STIX Extraction] Could not repair JSON automatically, attempting to extract valid JSON subset');
            
            // Try to extract the objects that are complete
            const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
            const objects = cleanedText.match(objectRegex);
            
            if (objects && objects.length > 0) {
              console.log(`[STIX Extraction] Found ${objects.length} complete JSON objects`);
              
              // Try to parse each object and keep the valid ones
              const validObjects = objects
                .map(obj => {
                  try {
                    return JSON.parse(obj);
                  } catch {
                    return null;
                  }
                })
                .filter(Boolean);
              
              if (validObjects.length > 0) {
                console.log(`[STIX Extraction] Successfully extracted ${validObjects.length} valid objects`);
                stixData = validObjects;
              }
            }
          }
          
          // If all recovery attempts failed, create an empty array
          if (!stixData) {
            console.warn('[STIX Extraction] All JSON recovery attempts failed, using empty array');
            stixData = [];
          }
        } catch (recoveryError) {
          console.error('[STIX Extraction] Failed to recover truncated JSON:', recoveryError);
          stixData = [];
        }
      } else {
        // For other types of JSON errors, just use an empty array
        console.warn(`[STIX Extraction] JSON error wasn't a truncation issue: ${error.message}`);
        stixData = [];
      }
    }

    // Create a STIX bundle from the response
    const bundleId = `bundle--${uuidv4()}`;
    console.log(`[STIX Extraction] Creating STIX bundle with ID: ${bundleId}`);
    
    // If the response is already a bundle, just ensure it has all required fields
    let bundle: STIXBundle;
    if (stixData.type === 'bundle' && Array.isArray(stixData.objects)) {
      console.log(`[STIX Extraction] Response is already a STIX bundle with ${stixData.objects.length} objects`);
      bundle = stixData;
      bundle.id = bundle.id || bundleId;
    } else if (Array.isArray(stixData)) {
      // If the response is an array of STIX objects, create a bundle
      console.log(`[STIX Extraction] Response is an array of ${stixData.length} STIX objects`);
      bundle = {
        type: 'bundle',
        id: bundleId,
        objects: stixData
      };
    } else {
      console.warn('[STIX Extraction] Response format is unexpected, creating empty bundle');
      bundle = {
        type: 'bundle',
        id: bundleId,
        objects: []
      };
    }
    
    // Check if we have any objects
    if (bundle.objects.length === 0) {
      console.warn('[STIX Extraction] No STIX objects found in the response');
    } else {
      console.log(`[STIX Extraction] Found ${bundle.objects.length} STIX objects`);
      // Log the first few object types
      const objectTypes = bundle.objects.slice(0, 5).map(obj => obj.type);
      console.log('[STIX Extraction] First few object types:', objectTypes);
    }
    
    console.log('[STIX Extraction] STIX extraction completed successfully');
    return bundle;
  } catch (error) {
    console.error('[STIX Extraction] Error during STIX extraction with DeepSeek:', error);
    // Return an empty bundle if extraction fails
    return {
      type: 'bundle',
      id: `bundle--${uuidv4()}`,
      objects: []
    };
  }
}

/**
 * Clean JSON response from LLM output
 */
function cleanJsonResponse(responseText: string): string {
  console.log('[STIX Extraction] Cleaning JSON response...');
  
  // Remove markdown code block markers if present
  let cleanedText = responseText.replace(/^```json|```$|^```/gm, '').trim();
  
  // If the response doesn't start with { or [, try to find the beginning of the JSON
  if (!cleanedText.startsWith('{') && !cleanedText.startsWith('[')) {
    console.log('[STIX Extraction] JSON doesn\'t start with { or [, searching for JSON start');
    const jsonStartIndexObject = cleanedText.indexOf('{');
    const jsonStartIndexArray = cleanedText.indexOf('[');
    
    // Find the earliest valid JSON start
    let jsonStartIndex = -1;
    if (jsonStartIndexObject >= 0 && jsonStartIndexArray >= 0) {
      jsonStartIndex = Math.min(jsonStartIndexObject, jsonStartIndexArray);
    } else if (jsonStartIndexObject >= 0) {
      jsonStartIndex = jsonStartIndexObject;
    } else if (jsonStartIndexArray >= 0) {
      jsonStartIndex = jsonStartIndexArray;
    }
    
    if (jsonStartIndex >= 0) {
      console.log(`[STIX Extraction] Found JSON start at index ${jsonStartIndex}`);
      cleanedText = cleanedText.substring(jsonStartIndex);
    } else {
      console.warn('[STIX Extraction] No JSON start found in response');
    }
  }
  
  return cleanedText;
}

/**
 * Upload STIX bundle to Vercel Blob Storage
 */
export async function uploadStixBundle(
  stixBundle: STIXBundle,
  userId: string,
  documentId: string
): Promise<string> {
  const bundleContent = JSON.stringify(stixBundle, null, 2);
  
  // Upload the STIX bundle as a JSON file
  const stixBlob = await put(
    `documents/${userId}/stix/${documentId}.json`, 
    bundleContent,
    {
      contentType: 'application/json',
      access: 'public',
      allowOverwrite: true,
    }
  );

  return stixBlob.url;
}
