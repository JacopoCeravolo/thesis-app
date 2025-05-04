import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { put } from '@vercel/blob';
import { STIXBundle, STIXObject } from './stixExtractor';
import fs from 'fs';
import path from 'path';

/**
 * Extract STIX objects from document content using Gemini API
 */
export async function extractStixWithGemini(
  documentContent: string,
  documentName: string,
): Promise<STIXBundle> {
  // Initialize the Gemini API client
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  try {
    // Read the extraction prompt
    const promptPath = path.join(process.cwd(), 'prompts', 'one-shot-extraction.txt');
    const systemPrompt = fs.readFileSync(promptPath, 'utf-8');
    
    // Prepare content for extraction
    const content = `Text:\n${documentContent}`;
    
    // Get response from Gemini
    const result = await model.generateContent([systemPrompt, content]);
    const response = result.response;
    const responseText = response.text();
    
    // Clean and parse the JSON response
    const cleanedJson = cleanJsonResponse(responseText);
    let stixObjects: STIXObject[] = [];
    
    try {
      stixObjects = JSON.parse(cleanedJson);
    } catch (error) {
      console.error('Error parsing STIX JSON:', error);
      // Return empty objects if parsing fails
      stixObjects = [];
    }
    
    // Add UUIDs to all objects
    stixObjects = addUuidToIds(stixObjects);
    
    // Create the bundle
    const bundle: STIXBundle = {
      type: 'bundle',
      id: `bundle--${uuidv4()}`,
      objects: stixObjects
    };
    
    return bundle;
  } catch (error) {
    console.error('Error during STIX extraction with Gemini:', error);
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
  // Remove markdown code block markers if present
  let cleanedText = responseText.replace(/^```json|```$|^```/gm, '').trim();
  return cleanedText;
}

/**
 * Add UUIDs to 'id' fields in STIX objects
 */
function addUuidToIds(stixData: STIXObject[]): STIXObject[] {
  return stixData.map(item => {
    // If item already has an id with UUID, keep it
    if (item.id && item.id.includes('--') && item.id.split('--')[1].length > 8) {
      return item;
    }
    
    // Otherwise generate a new UUID
    const objectType = item.type;
    const newId = `${objectType}--${uuidv4()}`;
    return { ...item, id: newId };
  });
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
