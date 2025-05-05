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
}

function DocumentPanelContent() {
  const [file, setFile] = useState<File | null>(null);
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [activeTab, setActiveTab] = useState("document");
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();
  const { state, dispatch } = useDocument();

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!session?.user) {
      // Redirect to login if not authenticated
      router.push("/login");
      return;
    }

    setFile(file);
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

      setDocumentData({
        id: data.document.id,
        fileName: data.document.fileName,
        fileType: data.document.fileType,
        textContent: "", // Will be populated when viewing
      });

      // Add a system message to acknowledge the upload
      setMessages([
        {
          id: Date.now().toString(),
          content: `File "${file.name}" has been uploaded and processed. You can now ask questions about it.`,
          sender: "system",
          timestamp: new Date(),
        },
      ]);

      // Dispatch document uploaded action to refresh document history
      dispatch({ type: "DOCUMENT_UPLOADED" });

      // Refresh the document list
      router.refresh();
    } catch (error) {
      console.error("Error uploading document:", error);
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload document"
      );
      setFile(null);
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

      setIsLoading(true);
      try {
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
      } catch (error) {
        console.error("Error loading document:", error);
        setDocumentData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [router, session]
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

  return (
    <div className={styles.container}>
      <div className={styles.tabsContainer}>
        <div className={styles.tabsList}>
          <button
            className={styles.tabTrigger}
            data-state={activeTab === "document" ? "active" : ""}
            onClick={() => setActiveTab("document")}
          >
            Report
          </button>
          <button
            className={styles.tabTrigger}
            data-state={activeTab === "chat" ? "active" : ""}
            onClick={() => setActiveTab("chat")}
          >
            Inspect
          </button>
          <div className={styles.spacer}></div>
        </div>

        <div
          className={styles.tabContent}
          data-state={activeTab === "document" ? "active" : ""}
        >
          {isUploading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Uploading document...</p>
            </div>
          ) : uploadError ? (
            <div className={styles.uploaderContainer}>
              <div className={styles.errorMessage}>{uploadError}</div>
            </div>
          ) : documentData || file ? (
            <DocumentViewer
              file={file}
              documentData={documentData}
              isLoading={isLoading}
            />
          ) : (
            <DocumentDropzone onFileUpload={handleFileUpload} />
          )}
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

interface DocumentDropzoneProps {
  onFileUpload: (file: File) => void;
}

function DocumentDropzone({ onFileUpload }: DocumentDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileUpload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onFileUpload(file);
      // Reset the input value to allow uploading the same file again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={styles.uploaderContainer}>
      <div
        className={`${styles.dropzone} ${
          isDragging ? styles.dropzoneActive : ""
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={styles.iconContainer}>
          <UploadIcon className={styles.iconPrimary} />
        </div>
        <h3 className={styles.dropzoneTitle}>Upload a document</h3>
        <p className={styles.dropzoneText}>
          Drag and drop a file here, or click to browse
        </p>
        <p className={styles.fileFormats}>
          Supports PDF, TXT, and other text formats
        </p>
        <button
          type="button"
          className={styles.browseButton}
          onClick={handleBrowseClick}
        >
          Browse Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className={styles.fileInput}
          accept=".pdf,.txt,.doc,.docx"
          onChange={handleFileInputChange}
        />
      </div>
    </div>
  );
}

interface DocumentViewerProps {
  file: File | null;
  documentData: DocumentData | null;
  isLoading: boolean;
}

function DocumentViewer({
  file,
  documentData,
  isLoading,
}: DocumentViewerProps) {
  const [pdfURL, setPdfURL] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Set up PDF URL for PDF.js viewer
  useEffect(() => {
    if (file) {
      setLoading(true);
      const url = URL.createObjectURL(file);
      setPdfURL(url);
      setLoading(false);

      return () => {
        URL.revokeObjectURL(url);
        setPdfURL(null);
      };
    } else if (
      documentData?.fileType === "application/pdf" &&
      documentData.id
    ) {
      setLoading(true);
      setPdfURL(`/api/documents/${documentData.id}/pdf`);
      // We'll set loading to false once PDF is rendered
    } else {
      setPdfURL(null);
      setLoading(false);
    }
  }, [file, documentData]);

  // Show loading state when document is loading
  if (isLoading || (loading && !pdfURL && !documentData?.textContent)) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>Loading document...</p>
      </div>
    );
  }

  // Show empty state when no document is selected
  if (!file && !documentData) {
    return (
      <div className={styles.uploaderContainer}>
        <div className={styles.emptyMessage}>
          No document selected. Please upload a document or select one from the
          history.
        </div>
      </div>
    );
  }

  // For PDF files, use PDF.js viewer
  if (
    pdfURL &&
    ((file && file.type === "application/pdf") ||
      documentData?.fileType === "application/pdf")
  ) {
    return (
      <div className={styles.documentViewer}>
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <div style={{ height: "100%" }}>
            <Viewer
              fileUrl={pdfURL}
              onDocumentLoad={() => setLoading(false)}
              renderError={(error) => (
                <div className={styles.emptyMessage}>
                  Failed to load PDF: {error.message}
                </div>
              )}
            />
          </div>
        </Worker>
      </div>
    );
  }

  // For text content, show in document content container
  if (documentData?.textContent) {
    return (
      <div className={styles.documentViewer}>
        <div className={styles.documentContent}>
          <h2 className={styles.documentTitle}>{documentData.fileName}</h2>
          <div className={styles.prose}>
            {documentData.textContent.split("\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default placeholder content - same as in the original implementation
  return (
    <div className={styles.dummyDocument}>
      <h3>Sample Document View</h3>
      <p>
        The document would be processed to extract STIX objects, and those
        objects would be highlighted in this view.
      </p>
      <p>For example, this document contains references to:</p>
      <ul>
        <li>
          <span className={`${styles.entityHighlight} ${styles.entityMalware}`}>
            Malware: TrickBot
          </span>
        </li>
        <li>
          <span
            className={`${styles.entityHighlight} ${styles.entityThreatActor}`}
          >
            Threat Actor: Wizard Spider
          </span>
        </li>
        <li>
          <span
            className={`${styles.entityHighlight} ${styles.entityAttackPattern}`}
          >
            Attack Pattern: Phishing
          </span>
        </li>
      </ul>
      <p>
        These objects have been added to the STIX bundle in the right sidebar.
      </p>
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
            <div className={styles.emptyMessage}>Inspect the report</div>
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
