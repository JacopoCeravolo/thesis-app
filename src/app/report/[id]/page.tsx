"use client";

import { useEffect, useState } from "react";
import { DocumentHistory } from "@/components/document-history";
import { StixInspector } from "@/components/stix-inspector";
import { DocumentPanel } from "@/components";
import styles from "./page.module.css";
import { useDocument } from "@/contexts/DocumentContext";
import { useRouter } from "next/navigation";

export default function ReportPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { dispatch } = useDocument();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the document when the page is loaded
  useEffect(() => {
    // Check for ID
    if (!id) {
      router.push("/");
      return;
    }

    // Load document
    const loadDocument = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load document through the Document Context
        dispatch({ type: "LOAD_DOCUMENT", payload: { id } });
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading document:", error);
        setError("Failed to load document");
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [id, dispatch, router]);

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.sidePanel}>
          <DocumentHistory />
        </div>
        <div className={styles.mainPanel}>
          {isLoading ? (
            <div className={styles.loadingState}>Loading document...</div>
          ) : error ? (
            <div className={styles.errorState}>{error}</div>
          ) : (
            <DocumentPanel />
          )}
        </div>
        <div className={styles.rightPanel}>
          <StixInspector />
        </div>
      </div>
    </main>
  );
}
