"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Separator } from "./ui/separator";
import styles from "./document-panel.module.css";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ClientAuthProvider } from "@/contexts/AuthContext";
// Import PDF viewer components
import { Worker, Viewer } from "@react-pdf-viewer/core";
// Import PDF viewer styles
import "@react-pdf-viewer/core/lib/styles/index.css";
import { useDocument } from "@/contexts/DocumentContext";
import { Loader } from "./ui/loader";

interface Message {
  id: string;
  content: string;
  sender: "user" | "system";
  timestamp: Date;
}

interface DocumentData {
  id: string;
  fileName: string;
  fileType: string;
  textContent?: string;
  originalUrl?: string;
  stixBundle?: any;
}

function DocumentPanelContent() {
  const [file, setFile] = useState<File | null>(null);
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [activeTab, setActiveTab] = useState("document");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const { state, dispatch } = useDocument();

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!session?.user) {
      router.push("/login");
      return;
    }

    setFile(file);
    setIsUploading(true);
    setUploadError(null);

    try {
      // Step 1: Upload the document immediately
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload document");
      }

      const data = await response.json();

      // Step 2: Set document data immediately for display
      setDocumentData({
        id: data.document.id,
        fileName: data.document.fileName,
        fileType: data.document.fileType,
        textContent: data.textContent,
        originalUrl: data.document.originalUrl,
      });

      // Step 3: Notify DocHistory that a new document has been uploaded
      dispatch({ type: "DOCUMENT_UPLOADED" });

      // Step 4: Add a system message
      setMessages([
        {
          id: Date.now().toString(),
          content: `Document "${data.document.fileName}" has been uploaded successfully. STIX extraction is now in progress.`,
          sender: "system",
          timestamp: new Date(),
        },
      ]);

      // Step 5: Set loading state for STIX extraction
      dispatch({ type: "STIX_LOADING_START" });

      // Step 6: Select the document immediately
      dispatch({
        type: "SELECT_DOCUMENT",
        payload: { id: data.document.id },
      });

      // Step 7: Wait a short time for the UI to update before triggering STIX extraction
      // This ensures the document history is updated before we start background processing
      setTimeout(() => {
        // Trigger the async STIX extraction in the background
        // Using a separate function to avoid blocking the main thread
        const triggerExtraction = async () => {
          try {
            const extractionResponse = await fetch("/api/documents/extract", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                documentId: data.document.id,
                textContent: data.textContent,
              }),
            });

            if (extractionResponse.ok) {
              console.log("STIX extraction started successfully");
            } else {
              console.error("Failed to start STIX extraction");
              dispatch({ type: "STIX_LOADING_COMPLETE" });
            }
          } catch (extractionError) {
            console.error("Error triggering STIX extraction:", extractionError);
            dispatch({ type: "STIX_LOADING_COMPLETE" });
          }
        };

        // Execute without awaiting to keep it non-blocking
        triggerExtraction();
      }, 500);
    } catch (error) {
      console.error("Error uploading document:", error);
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload document"
      );
      dispatch({ type: "STIX_LOADING_COMPLETE" });
    } finally {
      setIsUploading(false);
    }
  };

  // Load document content when viewing an existing document
  const loadDocument = useCallback(
    async (id: string) => {
      if (!session?.user) {
        router.push("/login");
        return;
      }

      try {
        // Signal that STIX loading has started
        dispatch({ type: "STIX_LOADING_START" });

        const response = await fetch(`/api/documents/${id}`);

        if (!response.ok) {
          throw new Error("Failed to load document");
        }

        const data = await response.json();

        setFile(null); // Clear any uploaded file
        setDocumentData({
          id: data.document.id,
          fileName: data.document.fileName,
          fileType: data.document.fileType,
          textContent: data.document.textContent,
          originalUrl: data.document.originalUrl,
          stixBundle: data.document.stixBundle,
        });

        // Add a system message
        setMessages([
          {
            id: Date.now().toString(),
            content: `Document "${data.document.fileName}" has been loaded. You can now ask questions about it.`,
            sender: "system",
            timestamp: new Date(),
          },
        ]);

        // Signal that STIX loading is complete
        dispatch({ type: "STIX_LOADING_COMPLETE" });
      } catch (error) {
        console.error("Error loading document:", error);
        setUploadError(
          error instanceof Error ? error.message : "Failed to load document"
        );
        // Make sure to complete loading even on error
        dispatch({ type: "STIX_LOADING_COMPLETE" });
      }
    },
    [session, router, dispatch]
  );

  // Watch for document selection from history
  useEffect(() => {
    if (state.selectedDocumentId) {
      loadDocument(state.selectedDocumentId);
    }
  }, [state.selectedDocumentId, loadDocument]);

  // Handle chat message submission
  const handleMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: "user" as const,
      timestamp: new Date(),
    };

    // Add system response (mock response for now)
    const systemMessage = {
      id: (Date.now() + 1).toString(),
      content: `I've analyzed the document and found several STIX objects related to your query about "${inputMessage}". Check the STIX inspector for details.`,
      sender: "system" as const,
      timestamp: new Date(),
    };

    setMessages((prevMessages) => [
      ...prevMessages,
      userMessage,
      systemMessage,
    ]);
    setInputMessage("");
  };

  // Handle re-extract STIX for the currently displayed document
  const handleReExtractStix = async () => {
    if (!documentData?.id) {
      return; // Silent fail if no document loaded
    }

    try {
      setIsExtracting(true);

      // Set timestamp when extraction begins to help STIX Inspector know when to show new bundle
      const extractionStartTime = Date.now();
      (window as any).stixExtractionStartTime = extractionStartTime;

      // Use a more direct approach - set a global window variable that the STIX Inspector can check
      // This bypasses any potential issues with React context updates
      (window as any).stixIsLoading = true;

      // Also dispatch through the context for components that use it
      dispatch({ type: "STIX_LOADING_START" });
      console.log("[Document Panel] Set STIX loading state to true");

      // Force re-render of the STIX Inspector by triggering a custom event
      const stixLoadingEvent = new CustomEvent("stixLoadingStateChanged", {
        detail: {
          isLoading: true,
          extractionStartTime,
        },
      });
      window.dispatchEvent(stixLoadingEvent);

      // Call the extraction endpoint with the current document info
      const extractionResponse = await fetch("/api/documents/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: documentData.id,
          textContent: documentData.textContent,
        }),
      });

      if (!extractionResponse.ok) {
        console.error("Failed to start STIX extraction");
        // If there's an error, end the loading state
        dispatch({ type: "STIX_LOADING_COMPLETE" });
        (window as any).stixIsLoading = false;

        // Notify STIX Inspector that loading has completed
        const stixLoadingCompleteEvent = new CustomEvent(
          "stixLoadingStateChanged",
          {
            detail: {
              isLoading: false,
              extractionStartTime: null,
            },
          }
        );
        window.dispatchEvent(stixLoadingCompleteEvent);
      } else {
        console.log("STIX extraction started successfully");
        // Don't end the loading state here - let the STIX Inspector component handle it
        // when it detects the new STIX bundle through its polling mechanism
      }
    } catch (error) {
      console.error("Error re-extracting STIX:", error);
      // End loading state on error
      dispatch({ type: "STIX_LOADING_COMPLETE" });
      (window as any).stixIsLoading = false;

      // Notify STIX Inspector that loading has completed
      const stixLoadingCompleteEvent = new CustomEvent(
        "stixLoadingStateChanged",
        {
          detail: {
            isLoading: false,
            extractionStartTime: null,
          },
        }
      );
      window.dispatchEvent(stixLoadingCompleteEvent);
    } finally {
      setIsExtracting(false);
    }
  };

  if (!file && !documentData) {
    return (
      <FileUploader
        onFileUpload={handleFileUpload}
        isUploading={isUploading}
        error={uploadError}
      />
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tabsContainer}>
        <div className={styles.tabsList}>
          <button
            className={styles.tabTrigger}
            data-state={activeTab === "document" ? "active" : ""}
            onClick={() => setActiveTab("document")}
          >
            Document
          </button>
          <button
            className={styles.tabTrigger}
            data-state={activeTab === "chat" ? "active" : ""}
            onClick={() => setActiveTab("chat")}
          >
            Chat
          </button>
          <div className={styles.spacer}></div>
          <button
            className={styles.reExtractButton}
            onClick={handleReExtractStix}
            disabled={isExtracting || !documentData?.id}
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
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            {isExtracting ? "Extracting..." : "Re-extract STIX"}
          </button>
        </div>

        <div
          className={styles.tabContent}
          data-state={activeTab === "document" ? "active" : ""}
        >
          <DocumentViewer file={file} documentData={documentData} />
        </div>

        <div
          className={styles.tabContent}
          data-state={activeTab === "chat" ? "active" : ""}
        >
          <ChatInterface
            messages={messages}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            handleMessageSubmit={handleMessageSubmit}
          />
        </div>
      </div>
    </div>
  );
}

export function DocumentPanel() {
  return (
    <ClientAuthProvider>
      <DocumentPanelContent />
    </ClientAuthProvider>
  );
}

interface FileUploaderProps {
  onFileUpload: (file: File) => void;
  isUploading: boolean;
  error: string | null;
}

function FileUploader({ onFileUpload, isUploading, error }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showFileError, setShowFileError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state } = useDocument();

  // Listen for file upload trigger from context
  useEffect(() => {
    if (state.triggerFileUpload) {
      fileInputRef.current?.click();
    }
  }, [state.triggerFileUpload]);

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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setShowFileError(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setShowFileError(false);
    }
  };

  const handleUploadClick = () => {
    if (selectedFile) {
      onFileUpload(selectedFile);
    } else {
      setShowFileError(true);
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={styles.uploaderContainer}>
      <div
        className={`${styles.dropzone} ${
          isDragging ? styles.dropzoneActive : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={styles.uploadIcon}>
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
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
        </div>
        <h3 className={styles.uploadTitle}>Upload a document</h3>
        <p className={styles.uploadText}>
          Drag and drop your file here or click to browse
        </p>
        <div className={styles.supportedFormats}>
          Supported formats: PDF, DOCX, DOC, TXT, JSON
        </div>

        {showFileError && (
          <p className={styles.selectedFile}>Please select a file to upload</p>
        )}
        {selectedFile && (
          <p className={styles.selectedFile}>Selected: {selectedFile.name}</p>
        )}
        {error && <div className={styles.error}>{error}</div>}
        <input
          id="file-upload"
          ref={fileInputRef}
          type="file"
          className={styles.fileInput}
          accept=".pdf,.docx,.doc,.txt,.json"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <button
          type="button"
          className={styles.browseFilesButton}
          onClick={
            selectedFile
              ? handleUploadClick
              : () => document.getElementById("file-upload")?.click()
          }
          disabled={isUploading}
        >
          {isUploading
            ? "Uploading..."
            : selectedFile
            ? "Upload File"
            : "Browse Files"}
        </button>
      </div>
    </div>
  );
}

interface DocumentViewerProps {
  file: File | null;
  documentData: DocumentData | null;
}

function DocumentViewer({ file, documentData }: DocumentViewerProps) {
  // Create a blob URL from the file if it exists
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const { state } = useDocument();

  // Generate blob URL when file changes
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  // Determine the file type
  const fileType = file?.type || documentData?.fileType || "";
  const isPdf = fileType.includes("pdf");
  const isText = fileType.includes("text") || fileType.includes("txt");

  if (!file && !documentData) {
    return (
      <div className={styles.emptyDocumentViewer}>
        <p>No document loaded. Upload or select a document to view.</p>
      </div>
    );
  }

  // Only show loader during initial extraction (when no document data is available yet)
  // Not during re-extraction when we already have document data
  if (state.isStixLoading && !documentData) {
    return (
      <div className={styles.documentViewer}>
        <Loader
          text="Analyzing document and extracting STIX entities..."
          size="large"
        />
      </div>
    );
  }

  return (
    <div className={styles.documentViewer}>
      {isPdf ? (
        <div className={styles.pdfViewer}>
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
            <div style={{ height: "100%", width: "100%" }}>
              {fileUrl ? (
                <Viewer fileUrl={fileUrl} />
              ) : documentData?.originalUrl ? (
                <Viewer fileUrl={documentData.originalUrl} />
              ) : (
                <div>Unable to load PDF</div>
              )}
            </div>
          </Worker>
        </div>
      ) : isText && documentData?.textContent ? (
        // Text viewer for text documents
        <div className={styles.textViewer}>
          <pre className={styles.textContent}>{documentData.textContent}</pre>
        </div>
      ) : documentData?.fileName ? (
        // Error message for documents that failed to process properly
        <div className={styles.errorDocument}>
          <div className={styles.errorIcon}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3>Document Processing Error</h3>
          <p>
            We encountered an error while processing the document "
            {documentData.fileName}".
          </p>
          <p>
            The STIX extraction could not be completed successfully. Please try
            again with a different document or format.
          </p>
          <p>
            If the problem persists, please check that your document contains
            valid threat intelligence data in a format that can be processed.
          </p>
        </div>
      ) : (
        // Default placeholder content when everything else fails
        <Loader text="Processing document..." size="large" />
      )}
    </div>
  );
}

interface ChatInterfaceProps {
  messages: Message[];
  inputMessage: string;
  setInputMessage: (message: string) => void;
  handleMessageSubmit: (e: React.FormEvent) => void;
}

function ChatInterface({
  messages,
  inputMessage,
  setInputMessage,
  handleMessageSubmit,
}: ChatInterfaceProps) {
  return (
    <div className={styles.chatContainer}>
      <div className={styles.messagesContainer}>
        <div className={styles.messagesList}>
          {messages.length === 0 ? (
            <div className={styles.emptyMessage}>
              Ask questions about the uploaded document
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.messageWrapper} ${
                  message.sender === "user"
                    ? styles.messageWrapperUser
                    : styles.messageWrapperSystem
                }`}
              >
                <div
                  className={`${styles.message} ${
                    message.sender === "user"
                      ? styles.messageUser
                      : styles.messageSystem
                  }`}
                >
                  <p className={styles.messageContent}>{message.content}</p>
                  <p className={styles.messageTime}>
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className={styles.chatForm}>
        <form onSubmit={handleMessageSubmit} className={styles.chatInputArea}>
          <textarea
            placeholder="Ask a question about the document..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className={styles.chatTextarea}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleMessageSubmit(e);
              }
            }}
          />
          <button type="submit" className={styles.sendButton}>
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
              className="h-5 w-5"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
            <span className="sr-only">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
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
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}
