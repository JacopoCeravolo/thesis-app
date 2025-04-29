"use client"

import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import styles from './document-history.module.css'

// Mock data for document history
const mockDocuments = [
  { id: '1', name: 'Threat_Report_2024.pdf', timestamp: '2024-04-29T14:30:00' },
  { id: '2', name: 'Malware_Analysis.docx', timestamp: '2024-04-28T10:15:00' },
  { id: '3', name: 'Network_Intrusion.txt', timestamp: '2024-04-27T16:45:00' },
  { id: '4', name: 'APT_Campaign.pdf', timestamp: '2024-04-25T09:20:00' },
  { id: '5', name: 'Incident_Response.docx', timestamp: '2024-04-23T11:10:00' },
]

export function DocumentHistory() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Document History</h2>
        <Input 
          type="text"
          placeholder="Search documents..." 
          className={styles.searchInput} 
        />
      </div>
      <Separator className={styles.separator} />
      <ScrollArea className={styles.scrollArea}>
        <div className={styles.listContainer}>
          {mockDocuments.map(doc => (
            <DocumentListItem 
              key={doc.id}
              name={doc.name}
              timestamp={doc.timestamp}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

interface DocumentListItemProps {
  name: string
  timestamp: string
}

function DocumentListItem({ name, timestamp }: DocumentListItemProps) {
  // Format the timestamp to a more readable format
  const formattedDate = new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <button 
      className={styles.listItem}
      onClick={() => console.log(`Loading document: ${name}`)}
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
