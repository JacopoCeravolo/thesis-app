"use client"

import { useState, useEffect } from 'react'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import styles from './document-history.module.css'
import { useSession } from 'next-auth/react'
import { ClientAuthProvider } from '@/contexts/AuthContext'

interface Document {
  id: string
  fileName: string
  uploadedAt: string
  fileType: string
}

function DocumentHistoryContent() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { data: session } = useSession()

  // Fetch documents from the API
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!session?.user) return;
      
      try {
        setIsLoading(true);
        const response = await fetch('/api/documents');
        
        if (!response.ok) {
          throw new Error('Failed to fetch documents');
        }
        
        const data = await response.json();
        setDocuments(data.documents);
      } catch (error) {
        console.error('Error fetching documents:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch documents');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDocuments();
  }, [session]);

  // Filter documents based on search term
  const filteredDocuments = documents.filter(doc => 
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Document History</h2>
        <Input 
          type="text"
          placeholder="Search documents..." 
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <Separator className={styles.separator} />
      <ScrollArea className={styles.scrollArea}>
        {isLoading ? (
          <div className={styles.loading}>Loading documents...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : documents.length === 0 ? (
          <div className={styles.empty}>
            No documents found. Upload a document to get started.
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className={styles.empty}>
            No documents match your search.
          </div>
        ) : (
          <div className={styles.listContainer}>
            {filteredDocuments.map(doc => (
              <DocumentListItem 
                key={doc.id}
                id={doc.id}
                name={doc.fileName}
                timestamp={doc.uploadedAt}
                fileType={doc.fileType}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

export function DocumentHistory() {
  return (
    <ClientAuthProvider>
      <DocumentHistoryContent />
    </ClientAuthProvider>
  )
}

interface DocumentListItemProps {
  id: string
  name: string
  timestamp: string
  fileType: string
}

function DocumentListItem({ id, name, timestamp, fileType }: DocumentListItemProps) {
  // Format the timestamp to a more readable format
  const formattedDate = new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const handleDocumentClick = () => {
    // This will be implemented to load a document in the DocumentPanel
    console.log(`Loading document: ${id}`);
    
    // This is where we'd dispatch an event or use context to load the document
    // For now, we're just logging to console
    
    // TODO: Implement document loading
    // Example: documentDispatch({ type: 'LOAD_DOCUMENT', payload: { id } });
  };

  return (
    <button 
      className={styles.listItem}
      onClick={handleDocumentClick}
    >
      <div className={styles.itemHeader}>
        <DocumentIcon className={styles.itemIcon} />
        <span className={styles.itemName}>{name}</span>
      </div>
      <span className={styles.itemDate}>{formattedDate}</span>
    </button>
  )
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
  )
}
