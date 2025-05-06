import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "../../../../../lib/prisma";
import { put as putBlob } from "@vercel/blob";
import { extractStixWithGemini, extractStixWithDeepSeek } from "../../../../../lib/stixExtractor";

// Set maximum API execution duration to 60 seconds (maximum Vercel allows)
export const maxDuration = 60;

// Choose which extraction model to use
const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL || 'deepseek';

// Background extraction queue and status tracking
type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';
type ExtractionJob = {
  documentId: string;
  status: ExtractionStatus;
  error?: string;
  progress: number;
  startTime: number;
};

// In-memory job tracking (would use Redis or similar in production)
const extractionJobs = new Map<string, ExtractionJob>();

// Process a STIX extraction job in the background
async function processExtraction(documentId: string, userId: string, textContent: string) {
  try {
    console.log(`Starting STIX extraction for document ${documentId} using ${EXTRACTION_MODEL}`);
    
    // Update job status
    extractionJobs.set(documentId, {
      documentId,
      status: 'processing',
      progress: 10,
      startTime: Date.now()
    });
    
    // Extract STIX bundle using the selected model
    let stixBundle;
    
    if (EXTRACTION_MODEL === 'gemini') {
      stixBundle = await extractStixWithGemini(textContent);
    } else {
      stixBundle = await extractStixWithDeepSeek(textContent);
    }
    
    console.log(`Extracted STIX with ${EXTRACTION_MODEL}: ${stixBundle.objects.length} objects`);
    
    // Update job progress
    extractionJobs.set(documentId, {
      ...extractionJobs.get(documentId)!,
      progress: 70
    });
    
    // Save the STIX bundle to blob storage
    const fileName = `documents/${userId}/stix/${documentId}.json`;
    const stixBlob = await putBlob(
      fileName,
      JSON.stringify(stixBundle),
      { 
        contentType: "application/json",
        access: "public",
        allowOverwrite: true
      }
    );
    
    // Update the document record with STIX URL
    await prisma.document.update({
      where: { id: documentId },
      data: {
        stixBundleUrl: stixBlob.url
      }
    });
    
    // Mark job as completed
    extractionJobs.set(documentId, {
      ...extractionJobs.get(documentId)!,
      status: 'completed',
      progress: 100
    });
    
    console.log(`STIX extraction completed for document ${documentId}`);
  } catch (error) {
    console.error(`Error in STIX extraction for document ${documentId}:`, error);
    
    // Mark job as failed
    extractionJobs.set(documentId, {
      ...extractionJobs.get(documentId)!,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      progress: 0
    });
  }
}

// GET endpoint to retrieve extraction status or completed STIX bundle
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    const documentId = params.id;
    
    // First check if there's an ongoing extraction job
    const job = extractionJobs.get(documentId);
    if (job) {
      if (job.status === 'processing' || job.status === 'pending') {
        // If job is still processing, return status
        return NextResponse.json({
          status: job.status,
          progress: job.progress,
          documentId
        });
      } else if (job.status === 'failed') {
        // If job failed, return the error
        return NextResponse.json({
          status: 'failed',
          error: job.error || 'Unknown error during extraction',
          documentId
        }, { status: 500 });
      }
      // If completed, continue to return the actual STIX bundle below
    }
    
    // Find the document and ensure it belongs to the current user
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId
      }
    });
    
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    
    // If document doesn't have STIX URL yet, start extraction in background
    if (!document.stixBundleUrl) {
      // Get text content from document
      let textContent = '';
      
      if (document.textUrl) {
        try {
          const response = await fetch(document.textUrl);
          if (response.ok) {
            textContent = await response.text();
          } else {
            console.error(`Failed to fetch text content: ${response.status}`);
          }
        } catch (error) {
          console.error(`Failed to fetch text content from ${document.textUrl}`);
          return NextResponse.json({
            status: 'failed', 
            error: 'Failed to fetch document content',
            documentId
          }, { status: 500 });
        }
      }
      
      if (!textContent) {
        return NextResponse.json(
          { error: "No text content available for extraction" },
          { status: 400 }
        );
      }
      
      // Truncate text content if it's too large
      const MAX_CHARACTERS = 15000;
      if (textContent.length > MAX_CHARACTERS) {
        console.log(`Text content too large (${textContent.length} chars), truncating to ${MAX_CHARACTERS} chars`);
        textContent = textContent.substring(0, MAX_CHARACTERS);
      }
      
      // Create a new extraction job and start processing in the background
      extractionJobs.set(documentId, {
        documentId,
        status: 'pending',
        progress: 0,
        startTime: Date.now()
      });
      
      // Start extraction in background without awaiting
      processExtraction(documentId, userId, textContent).catch(error => {
        console.error(`Background extraction error for ${documentId}:`, error);
      });
      
      // Return immediate response that processing has begun
      return NextResponse.json({
        status: 'pending',
        progress: 0,
        documentId,
        message: 'STIX extraction started in background'
      });
    }
    
    // If we already have a STIX URL, fetch and return the bundle
    try {
      const response = await fetch(document.stixBundleUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch STIX bundle: ${response.status}`);
      }
      
      const stixBundle = await response.json();
      return NextResponse.json(stixBundle);
    } catch (error) {
      console.error('Error fetching STIX bundle:', error);
      return NextResponse.json(
        { error: "Failed to fetch STIX bundle" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in extraction API:', error);
    return NextResponse.json(
      { error: "Internal server error during extraction" },
      { status: 500 }
    );
  }
}
