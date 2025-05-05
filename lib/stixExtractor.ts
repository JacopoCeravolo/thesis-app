import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

/**
 * Load a prompt from a text file
 */
function loadPromptFromFile(promptFileName: string, textContent: string): string {
  try {
    // Get the prompt file path
    const promptPath = path.join(process.cwd(), 'prompts', promptFileName);
    
    // Read the prompt file
    const promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    
    // Replace the placeholder with the actual text content
    return promptTemplate.replace('[TEXT_CONTENT]', textContent);
  } catch (error) {
    console.error(`Error loading prompt from ${promptFileName}:`, error);
    throw new Error(`Failed to load prompt file: ${promptFileName}`);
  }
}

/**
 * Extract STIX objects from text content using Gemini API
 */
export async function extractStixWithGemini(textContent: string): Promise<any> {
  try {
    console.log("Starting STIX extraction with Gemini...");
    
    // Get the API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    // Load the prompt from file
    const prompt = loadPromptFromFile('stix-extraction-gemini.txt', textContent);
    console.log(`Loaded Gemini prompt (${prompt.length} chars)`);
    
    // Endpoint for Gemini 2.0 Flash
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    
    console.log("Sending request to Gemini API...");
    // Call the Gemini API
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096
        }
      })
    });
    
    if (!response.ok) {
      const errorDetail = await response.text();
      console.error("Gemini API error:", errorDetail);
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText} - ${errorDetail}`);
    }
    
    const data = await response.json();
    console.log("Gemini API response received");
    
    // Parse the STIX content from the response
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const responseText = data.candidates[0].content.parts[0].text;
      console.log("Raw Gemini response:", responseText.substring(0, 500) + "...");
      
      // Extract the JSON content (handle potential markdown code blocks)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, responseText];
      
      const cleanJson = jsonMatch[1].trim();
      
      try {
        const stixObjects = JSON.parse(cleanJson);
        console.log(`Successfully parsed ${stixObjects.length} STIX objects from Gemini response`);
        
        // Count object types for logging
        const typeCounts = stixObjects.reduce((counts: any, obj: any) => {
          counts[obj.type] = (counts[obj.type] || 0) + 1;
          return counts;
        }, {});
        console.log("STIX object types extracted:", typeCounts);
        
        return createStixBundle(stixObjects);
      } catch (parseError) {
        console.error("Failed to parse JSON from Gemini response:", parseError);
        console.error("Problem JSON:", cleanJson.substring(0, 500) + "...");
        throw new Error("Failed to parse STIX JSON from Gemini response");
      }
    }
    
    throw new Error('Failed to extract STIX content from Gemini response');
  } catch (error) {
    console.error('Error extracting STIX with Gemini:', error);
    throw error;
  }
}

/**
 * Extract STIX objects from text content using DeepSeek API via OpenRouter
 */
export async function extractStixWithDeepSeek(textContent: string): Promise<any> {
  try {
    console.log("Starting STIX extraction with DeepSeek...");
    
    // Get the API key from environment variables
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY not found in environment variables');
    }

    // Load the prompt from file
    const prompt = loadPromptFromFile('stix-extraction-deepseek.txt', textContent);
    console.log(`Loaded DeepSeek prompt (${prompt.length} chars)`);

    // OpenRouter endpoint for DeepSeek
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    
    console.log("Sending request to DeepSeek API via OpenRouter...");
    // Call the DeepSeek API via OpenRouter
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://thesis-app.com',
        'X-Title': 'STIX Extractor'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat:free',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      const errorDetail = await response.text();
      console.error("DeepSeek API error:", errorDetail);
      throw new Error(`DeepSeek API request failed: ${response.status} ${response.statusText} - ${errorDetail}`);
    }
    
    const data = await response.json();
    console.log("DeepSeek API response received");
    
    // Parse the STIX content from the response
    if (data?.choices?.[0]?.message?.content) {
      const responseText = data.choices[0].message.content;
      console.log("Raw DeepSeek response:", responseText.substring(0, 500) + "...");
      
      // Extract the JSON content (handle potential markdown code blocks)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, responseText];
      
      const cleanJson = jsonMatch[1].trim();
      
      try {
        const stixObjects = JSON.parse(cleanJson);
        console.log(`Successfully parsed ${stixObjects.length} STIX objects from DeepSeek response`);
        
        // Count object types for logging
        const typeCounts = stixObjects.reduce((counts: any, obj: any) => {
          counts[obj.type] = (counts[obj.type] || 0) + 1;
          return counts;
        }, {});
        console.log("STIX object types extracted:", typeCounts);
        
        return createStixBundle(stixObjects);
      } catch (parseError) {
        console.error("Failed to parse JSON from DeepSeek response:", parseError);
        console.error("Problem JSON:", cleanJson.substring(0, 500) + "...");
        throw new Error("Failed to parse STIX JSON from DeepSeek response");
      }
    }
    
    throw new Error('Failed to extract STIX content from DeepSeek response');
  } catch (error) {
    console.error('Error extracting STIX with DeepSeek:', error);
    throw error;
  }
}

/**
 * Create a STIX bundle from extracted objects
 */
function createStixBundle(stixObjects: any[]): any {
  const bundle = {
    type: "bundle",
    id: `bundle--${uuidv4()}`,
    objects: stixObjects
  };
  
  console.log(`Created STIX bundle with ${stixObjects.length} objects`);
  return bundle;
}

/**
 * Merge results from multiple LLM extractions
 */
export function mergeStixBundles(bundles: any[]): any {
  // Use a map to track unique objects by ID
  const uniqueObjects = new Map();
  
  // Process each bundle
  for (const bundle of bundles) {
    if (bundle?.objects && Array.isArray(bundle.objects)) {
      for (const obj of bundle.objects) {
        if (obj.id) {
          // Only add if not already present
          if (!uniqueObjects.has(obj.id)) {
            uniqueObjects.set(obj.id, obj);
          }
        }
      }
    }
  }
  
  // Create a new bundle with unique objects
  const mergedBundle = {
    type: "bundle",
    id: `bundle--${uuidv4()}`,
    objects: Array.from(uniqueObjects.values())
  };
  
  console.log(`Merged ${bundles.length} STIX bundles into one with ${mergedBundle.objects.length} unique objects`);
  return mergedBundle;
}
