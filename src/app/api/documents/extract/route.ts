import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import prisma from "../../../../../lib/prisma";
import { extractStixWithGemini } from "../../../../../lib/geminiExtractor";
import { uploadStixBundle } from "../../../../../lib/stixExtractor";

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
    
    // Get data from request
    const data = await request.json();
    const { documentId, textContent } = data;
    
    if (!documentId || !textContent) {
      return NextResponse.json(
        { error: "Document ID and text content are required" },
        { status: 400 }
      );
    }
    
    // Find the document to get its filename
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId
      }
    });
    
    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }
    
    // Extract STIX objects using Gemini only (for better consistency)
    console.log(`[STIX Extraction] Starting extraction for document: ${documentId}`);
    const stixBundle = await extractStixWithGemini(textContent, document.fileName);
    
    // Upload the STIX bundle
    const stixBundleUrl = await uploadStixBundle(stixBundle, userId, documentId);
    
    // Update the document with the STIX bundle URL
    // Since stixBundleUrl is defined in the schema but might not be recognized by TypeScript
    // we cast the data object to any to avoid type errors
    await prisma.document.update({
      where: {
        id: documentId
      },
      data: {
        // Cast to any to work around TS type issues with Prisma schema
        stixBundleUrl: stixBundleUrl as any
      }
    });
    
    return NextResponse.json({
      success: true,
      documentId,
      stixBundleUrl
    });
  } catch (error) {
    console.error("Error in STIX extraction:", error);
    return NextResponse.json(
      { error: "Failed to extract STIX data" },
      { status: 500 }
    );
  }
}
