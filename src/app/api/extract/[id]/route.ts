import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import prisma from "../../../../../lib/prisma";
import { put } from "@vercel/blob";
import { v4 as uuidv4 } from "uuid";
import { extractStixWithGemini, extractStixWithDeepSeek } from "../../../../../lib/stixExtractor";

// Global toggle for extraction model (can be changed to 'deepseek' to switch models)
const EXTRACTION_MODEL = 'deepseek';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    const documentId = params.id;
    
    // Find the document and ensure it belongs to the current user
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
      },
    });
    
    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }
    
    // Start STIX extraction process
    console.log(`Starting STIX extraction for document ${documentId} using ${EXTRACTION_MODEL}`);
    
    // Get document text content for extraction
    let textContent = "";
    
    if (document.textUrl) {
      // Fetch text content from the URL
      const textResponse = await fetch(document.textUrl);
      if (textResponse.ok) {
        textContent = await textResponse.text();
      } else {
        console.error(`Failed to fetch text content from ${document.textUrl}`);
      }
    }
    
    if (!textContent) {
      return NextResponse.json(
        { error: "No text content available for extraction" },
        { status: 400 }
      );
    }
    
    // Truncate text content if it's too large (most LLMs have context limits)
    const MAX_CHARACTERS = 15000;
    if (textContent.length > MAX_CHARACTERS) {
      console.log(`Text content too large (${textContent.length} chars), truncating to ${MAX_CHARACTERS} chars`);
      textContent = textContent.substring(0, MAX_CHARACTERS);
    }
    
    // Extract STIX bundle using the selected model
    let stixBundle;
    
    try {
      if (EXTRACTION_MODEL === 'gemini') {
        console.log("Extracting STIX with Gemini...");
        stixBundle = await extractStixWithGemini(textContent);
      } else {
        console.log("Extracting STIX with DeepSeek...");
        stixBundle = await extractStixWithDeepSeek(textContent);
      }
      
      console.log(`Extracted STIX with ${EXTRACTION_MODEL}: ${stixBundle.objects.length} objects`);
    } catch (error) {
      console.error(`Error extracting with ${EXTRACTION_MODEL}:`, error);
      return NextResponse.json(
        { error: `Failed to extract STIX data with ${EXTRACTION_MODEL}` },
        { status: 500 }
      );
    }
    
    // Save to blob storage
    const bundleContent = JSON.stringify(stixBundle, null, 2);
    const stixBlob = await put(
      `documents/${userId}/stix/${documentId}.json`, 
      bundleContent,
      {
        contentType: 'application/json',
        access: 'public',
        allowOverwrite: true,
      }
    );
    
    // Update document record with STIX bundle URL
    await prisma.document.update({
      where: {
        id: documentId
      },
      data: {
        stixBundleUrl: stixBlob.url
      } as any // Type assertion for TypeScript
    });
    
    // Return the STIX bundle
    return NextResponse.json({
      success: true,
      documentId,
      stixBundleUrl: stixBlob.url,
      stixBundle,
      extractionModel: EXTRACTION_MODEL
    });
    
  } catch (error) {
    console.error("Error in STIX extraction:", error);
    return NextResponse.json(
      { error: "Failed to extract STIX data" },
      { status: 500 }
    );
  }
}
