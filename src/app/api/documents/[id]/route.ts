import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import prisma from "../../../../../lib/prisma";

export async function GET(
  request: Request,
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
    // @ts-expect-error - We know the document model exists
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
    
    // Get the text content if available
    let textContent = null;
    if (document.textUrl) {
      try {
        const textResponse = await fetch(document.textUrl);
        if (textResponse.ok) {
          textContent = await textResponse.text();
        }
      } catch (error) {
        console.error("Error fetching text content:", error);
      }
    }
    
    return NextResponse.json({
      document: {
        ...document,
        textContent,
      },
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
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
    // @ts-expect-error - We know the document model exists
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
    
    // Delete document from database
    // @ts-expect-error - We know the document model exists
    await prisma.document.delete({
      where: {
        id: documentId,
      },
    });
    
    return NextResponse.json({ 
      message: "Document deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
