import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import prisma from "../../../../../lib/prisma";
import { uploadDocumentWithText } from "../../../../../lib/blobStorage";

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
    
    // Verify that the user exists in the database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
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
    
    // Extract text for later STIX generation
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
    
    // Create document record in database immediately (without waiting for STIX extraction)
    // @ts-expect-error - We know the document model exists
    const document = await prisma.document.create({
      data: {
        fileName,
        fileSize,
        fileType,
        originalUrl,
        textUrl,
        userId,
        uploadedAt: new Date(),
      }
    });
    
    // Return the document info immediately
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        fileSize: document.fileSize,
        fileType: document.fileType,
        originalUrl: document.originalUrl,
        textUrl: document.textUrl,
        textContent: textContent,
      },
      textContent: textContent
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
