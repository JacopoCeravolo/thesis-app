import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";
import prisma from "../../../../lib/prisma";

export async function GET() {
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
    
    // Query all documents directly using the PrismaClient
    // @ts-expect-error - We know the document model exists
    const documents = await prisma.document.findMany({
      where: {
        userId,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });
    
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
