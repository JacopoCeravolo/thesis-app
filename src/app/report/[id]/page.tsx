"use client";

import { useEffect, useState, useRef } from "react";
import { DocumentHistory } from "@/components/document-history";
import { StixInspector } from "@/components/stix-inspector";
import { DocumentPanel } from "@/components";
import styles from "./page.module.css";
import { useDocument } from "@/contexts/DocumentContext";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";

export default function ReportPage() {
  const params = useParams();
  const { id } = params;
  const { state, dispatch } = useDocument();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add refs for resizable sidebar
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

  // Add resize functionality
  useEffect(() => {
    const rightPanel = rightPanelRef.current;
    const resizeHandle = resizeHandleRef.current;

    if (!rightPanel || !resizeHandle) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const startX = e.clientX;
      const panelWidth = rightPanel.getBoundingClientRect().width;

      const onMouseMove = (e: MouseEvent) => {
        if (!isResizingRef.current) return;

        const currentX = e.clientX;
        // When moving mouse left (smaller currentX), we want panel wider
        // When moving mouse right (larger currentX), we want panel narrower
        const newWidth = Math.min(600, Math.max(200, panelWidth - (currentX - startX)));

        rightPanel.style.width = `${newWidth}px`;
      };

      const onMouseUp = () => {
        isResizingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    resizeHandle.addEventListener("mousedown", onMouseDown);

    return () => {
      resizeHandle.removeEventListener("mousedown", onMouseDown);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

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
        <div className={styles.rightPanel} ref={rightPanelRef}>
          <div className={styles.resizeHandle} ref={resizeHandleRef}></div>
          <StixInspector />
        </div>
      </div>
    </main>
  );
}
function usePageParams(): { params: any } {
  throw new Error("Function not implemented.");
}
