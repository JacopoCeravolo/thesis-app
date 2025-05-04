import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import prisma from "../../../../../lib/prisma";
import { uploadDocumentWithText } from "../../../../../lib/blobStorage";
import { uploadStixBundle } from "../../../../../lib/stixExtractor";
import { extractStixWithGemini } from "../../../../../lib/geminiExtractor";

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'application/json' // For STIX bundles
];

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
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
    
    // Get form data with the file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 5MB limit" },
        { status: 400 }
      );
    }
    
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed types: PDF, DOCX, DOC, TXT, JSON` },
        { status: 400 }
      );
    }
    
    // Get the file details
    const fileName = file.name;
    const fileType = file.type;
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Upload the document and get storage URLs
    const { originalUrl, textUrl, fileSize } = await uploadDocumentWithText(
      fileBuffer,
      fileName,
      fileType,
      userId
    );
    
    // Extract text for STIX generation
    let textContent = '';
    try {
      const textResponse = await fetch(textUrl);
      if (textResponse.ok) {
        textContent = await textResponse.text();
        console.log(`Successfully fetched text content (${textContent.length} characters)`);
      } else {
        console.error("Failed to fetch text content, status:", textResponse.status);
      }
    } catch (error) {
      console.error("Error fetching text content for STIX extraction:", error);
    }
    
    // Make sure we have text content before attempting STIX extraction
    if (!textContent) {
      console.warn("No text content extracted, STIX extraction may fail");
    }
    
    // Extract STIX objects using Gemini
    const stixBundle = await extractStixWithGemini(textContent, fileName);
    
    // Upload the STIX bundle
    const stixBundleUrl = await uploadStixBundle(stixBundle, userId, fileName);
    
    // Create document record in database
    // @ts-expect-error - We know the document model exists
    const document = await prisma.document.create({
      data: {
        fileName,
        fileSize,
        fileType,
        originalUrl,
        textUrl,
        stixBundleUrl,
        userId,
      },
    });
    
    return NextResponse.json({ 
      message: "Document uploaded successfully",
      document
    }, { status: 201 });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
