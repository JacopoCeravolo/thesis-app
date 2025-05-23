"use client";

import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import styles from "./document-history.module.css";
import { useSession } from "next-auth/react";
import { ClientAuthProvider } from "@/contexts/AuthContext";
import { useDocument } from "@/contexts/DocumentContext";

interface Document {
  id: string;
  fileName: string;
  uploadedAt: string;
  fileType: string;
}

function DocumentHistoryContent() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const { data: session } = useSession();
  const { state, dispatch } = useDocument();

  // Fetch documents from the API
  const fetchDocuments = async () => {
    if (!session?.user) return;

    try {
      setIsLoading(true);
      const response = await fetch("/api/documents");

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const data = await response.json();
      setDocuments(data.documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch documents"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch when component mounts
  useEffect(() => {
    if (session?.user) {
      fetchDocuments();
    }
  }, [session]);

  // Only refetch when documents are uploaded, not when they are selected
  useEffect(() => {
    if (state.lastAction === "DOCUMENT_UPLOADED") {
      fetchDocuments();
    }
  }, [state.lastAction, state.lastUpdated]);

  // Update selected document based on context
  useEffect(() => {
    setSelectedDocumentId(state.selectedDocumentId);
  }, [state.selectedDocumentId]);

  // Handle re-extract STIX for the currently selected document
  const handleReExtractStix = async () => {
    if (!selectedDocumentId) {
      alert("Please select a document first");
      return;
    }

    try {
      setIsExtracting(true);

      // Get the document text content
      const docResponse = await fetch(`/api/documents/${selectedDocumentId}`);

      if (!docResponse.ok) {
        throw new Error("Failed to fetch document");
      }

      const docData = await docResponse.json();

      // Call the extraction endpoint
      const extractionResponse = await fetch("/api/documents/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          textContent: docData.document.textContent,
        }),
      });

      if (!extractionResponse.ok) {
        throw new Error("Failed to start STIX extraction");
      }

      // Notify that STIX extraction has started
      dispatch({ type: "STIX_LOADING_START" });

      // Show confirmation
      alert("STIX extraction has been restarted. This may take a moment.");
    } catch (error) {
      console.error("Error re-extracting STIX:", error);
      alert(
        error instanceof Error ? error.message : "Failed to re-extract STIX"
      );
    } finally {
      setIsExtracting(false);
    }
  };

  // Filter documents based on search term
  const filteredDocuments = documents.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Reports History</h2>
        <div className={styles.actionButtons}>
          <button
            className={styles.newReportButton}
            onClick={() => dispatch({ type: 'TRIGGER_FILE_UPLOAD' })}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.buttonIcon}
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Report
          </button>
        </div>
        <Input
          type="text"
          placeholder="Search reports..."
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <Separator className={styles.separator} />
      <ScrollArea className={styles.scrollArea}>
        {isLoading ? (
          <div className={styles.loading}>Loading reports...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : documents.length === 0 ? (
          <div className={styles.empty}>
            No reports found. Upload a report to get started.
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className={styles.empty}>No reports match your search.</div>
        ) : (
          <div className={styles.listContainer}>
            {filteredDocuments.map((doc) => (
              <DocumentListItem
                key={doc.id}
                id={doc.id}
                name={doc.fileName}
                timestamp={doc.uploadedAt}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export function DocumentHistory() {
  return (
    <ClientAuthProvider>
      <DocumentHistoryContent />
    </ClientAuthProvider>
  );
}

interface DocumentListItemProps {
  id: string;
  name: string;
  timestamp: string;
}

function DocumentListItem({ id, name, timestamp }: DocumentListItemProps) {
  const { dispatch } = useDocument();

  // Format the timestamp to a more readable format
  const formattedDate = new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleDocumentClick = () => {
    console.log(`Loading document: ${id}`);
    // Dispatch action to load document
    dispatch({ type: "LOAD_DOCUMENT", payload: { id } });
  };

  return (
    <button className={styles.listItem} onClick={handleDocumentClick}>
      <div className={styles.itemHeader}>
        <DocumentIcon className={styles.itemIcon} />
        <span className={styles.itemName}>{name}</span>
      </div>
      <span className={styles.itemDate}>{formattedDate}</span>
    </button>
  );
}

function DocumentIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
