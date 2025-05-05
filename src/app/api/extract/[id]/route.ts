import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import prisma from "../../../../../lib/prisma";
import { put } from "@vercel/blob";
import { v4 as uuidv4 } from "uuid";

// Generate a STIX bundle with slight variations based on document ID
function generateStixBundle(documentId: string) {
  const bundleId = `bundle--${uuidv4()}`;
  return {
    type: "bundle",
    id: bundleId,
    document_id: documentId,
    generated_at: new Date().toISOString(),
    objects: [
      {
        type: "threat-actor",
        id: "threat-actor--d0372943-1579-4117-ae8c-2ba3897081a9",
        name: "Wizard Spider",
        description: "Wizard Spider is a financially motivated criminal group that has been conducting ransomware campaigns since 2018."
      },
      {
        type: "malware",
        id: `malware--${uuidv4().substring(0, 8)}`,
        name: "TrickBot",
        description: "TrickBot is a modular banking trojan first observed in 2016 and regularly updated."
      },
      {
        type: "attack-pattern",
        id: `attack-pattern--${uuidv4().substring(0, 8)}`,
        name: "Phishing",
        description: "Phishing involves sending emails with a malicious attachment or link."
      },
      {
        type: "relationship",
        id: `relationship--${uuidv4().substring(0, 8)}`,
        relationship_type: "uses",
        source_ref: "threat-actor--d0372943-1579-4117-ae8c-2ba3897081a9",
        target_ref: "malware--a5cc5ae4-5fa2-45fb-af4b-8fb0da4f3ea8"
      },
      {
        type: "relationship",
        id: `relationship--${uuidv4().substring(0, 8)}`,
        relationship_type: "delivers",
        source_ref: "attack-pattern--b9c5b4e3-3d1c-4a8c-82f4-d89b0e4b5d1f",
        target_ref: "malware--a5cc5ae4-5fa2-45fb-af4b-8fb0da4f3ea8"
      }
    ]
  };
}

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
    
    // Simulate processing delay (5 seconds)
    console.log(`Starting STIX extraction for document ${documentId}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log(`Completed STIX extraction delay for document ${documentId}`);
    
    // Generate STIX bundle
    const stixBundle = generateStixBundle(documentId);
    
    // Save to blob storage
    const bundleContent = JSON.stringify(stixBundle, null, 2);
    const stixBlob = await put(
      `documents/${userId}/stix/${documentId}.json`, 
      bundleContent,
      {
        contentType: 'application/json',
        access: 'public',
        allowOverwrite: true
      }
    );
    
    // Update document record with STIX bundle URL
    await prisma.document.update({
      where: {
        id: documentId
      },
      data: {
        stixBundleUrl: stixBlob.url
      } as any // Type assertion to bypass the TypeScript error until the schema is fully synced
    });
    
    // Return the STIX bundle
    return NextResponse.json({
      success: true,
      documentId,
      stixBundleUrl: stixBlob.url,
      stixBundle
    });
    
  } catch (error) {
    console.error("Error in STIX extraction:", error);
    return NextResponse.json(
      { error: "Failed to extract STIX data" },
      { status: 500 }
    );
  }
}
