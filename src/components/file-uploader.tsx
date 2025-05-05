"use client";

import { useState } from "react";
import styles from "./file-uploader.module.css";

interface FileUploaderProps {
  onFileUpload?: (file: File) => void;
  isUploading?: boolean;
  error?: string | null;
}

export function FileUploader({
  onFileUpload,
  isUploading = false,
  error = null,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (
      e.dataTransfer.files &&
      e.dataTransfer.files.length > 0 &&
      onFileUpload
    ) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFileUpload) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className={styles.uploaderContainer}>
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={styles.iconContainer}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.iconPrimary}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
        </div>
        <h3 className={styles.dropzoneTitle}>
          {isUploading ? "Uploading..." : "Upload a document"}
        </h3>
        {error && <div className={styles.error}>{error}</div>}
        <p className={styles.dropzoneText}>
          Drag and drop your file here or click to browse
        </p>
        <p className={styles.fileFormats}>
          Supported formats: PDF, TXT and Markdown
        </p>
        <input
          id="file-upload"
          type="file"
          className={styles.fileInput}
          accept=".pdf,.txt,.md"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <button
          type="button"
          className={styles.browseButton}
          onClick={() => document.getElementById("file-upload")?.click()}
          disabled={isUploading}
        >
          {isUploading ? "Processing..." : "Browse Files"}
        </button>
      </div>
    </div>
  );
}
