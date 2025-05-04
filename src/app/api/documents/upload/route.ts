import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
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
        { error: "Unsupported file type. Allowed types: PDF, DOCX, DOC, TXT, JSON" },
        { status: 400 }
      );
    }
    
    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Upload file and extract text
    const { originalUrl, textUrl, fileSize } = await uploadDocumentWithText(
      fileBuffer,
      file.name,
      file.type,
      userId
    );
    
    // Save document metadata to database
    // @ts-ignore - We know the document model exists
    const document = await prisma.document.create({
      data: {
        fileName: file.name,
        originalUrl,
        textUrl,
        fileType: file.type,
        fileSize,
        userId,
      },
    });
    
    return NextResponse.json(
      { message: "Document uploaded successfully", document },
      { status: 201 }
    );
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
