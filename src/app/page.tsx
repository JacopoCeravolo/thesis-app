"use client";

import { DocumentHistory } from "@/components/document-history";
import { StixInspector } from "@/components/stix-inspector";
import { FileUploader } from "@/components/file-uploader";
import { useState } from "react";
import { useDocument } from "@/contexts/DocumentContext";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./page.module.css";

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { dispatch } = useDocument();
  const router = useRouter();
  const { data: session } = useSession();

  const handleFileUpload = async (file: File) => {
    if (!session?.user) {
      router.push("/login");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload document");
      }

      const data = await response.json();

      // Notify document context that a document was uploaded
      dispatch({ type: "DOCUMENT_UPLOADED" });

      // Navigate to the document view page
      router.push(`/report/${data.document.id}`);
    } catch (error) {
      console.error("Error uploading document:", error);
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload document"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.sidePanel}>
          <DocumentHistory />
        </div>
        <div className={styles.mainPanel}>
          <div className={styles.documentPlaceholder}>
            <FileUploader
              onFileUpload={handleFileUpload}
              isUploading={isUploading}
              error={uploadError}
            />
          </div>
        </div>
        <div className={styles.rightPanel}>
          <StixInspector />
        </div>
      </div>
    </main>
  );
}
