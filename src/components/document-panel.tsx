"use client";

import { useState, useCallback, useEffect } from "react";
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
        setUploadError(
          error instanceof Error ? error.message : "Failed to load document"
        );
      }
    },
    [session, router]
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

interface DocumentViewerProps {
  file: File | null;
  documentData: DocumentData | null;
}

function DocumentViewer({ file, documentData }: DocumentViewerProps) {
  // Create a blob URL from the file if it exists
  const [fileUrl, setFileUrl] = useState<string | null>(null);

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

  return (
    <div className={styles.documentViewer}>
      {isPdf ? (
        <div className={styles.pdfViewer}>
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
            <div style={{ height: "100%", width: "100%" }}>
              {fileUrl ? (
                <Viewer fileUrl={fileUrl} />
              ) : documentData?.id ? (
                // For PDF documents loaded from database
                <Viewer fileUrl={`/api/documents/${documentData.id}/file`} />
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
      ) : (
        // Default placeholder content - same as in the original implementation
        <div className={styles.dummyDocument}>
          <h3>Sample Document View</h3>
          <p>
            The document would be processed to extract STIX objects, and those
            objects would be highlighted in this view.
          </p>
          <p>For example, this document contains references to:</p>
          <ul>
            <li>
              <span
                className={`${styles.entityHighlight} ${styles.entityMalware}`}
              >
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
            These objects have been added to the STIX bundle in the right
            sidebar.
          </p>
        </div>
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
