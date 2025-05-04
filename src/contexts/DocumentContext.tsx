"use client"

import { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react'

// Define document action types
export type DocumentAction = 
  | { type: 'LOAD_DOCUMENT'; payload: { id: string } }
  | { type: 'SELECT_DOCUMENT'; payload: { id: string } }
  | { type: 'DOCUMENT_UPLOADED' }
  | { type: 'STIX_LOADING_START' }
  | { type: 'STIX_LOADING_COMPLETE' }

// Define document state
interface DocumentState {
  lastAction: string | null;
  lastUpdated: number;
  selectedDocumentId: string | null;
  isStixLoading: boolean;
}

// Create the context
const DocumentContext = createContext<{
  state: DocumentState;
  dispatch: Dispatch<DocumentAction>;
} | undefined>(undefined)

// Document reducer
function documentReducer(state: DocumentState, action: DocumentAction): DocumentState {
  switch (action.type) {
    case 'LOAD_DOCUMENT':
      return {
        ...state,
        selectedDocumentId: action.payload.id,
        lastAction: 'LOAD_DOCUMENT',
        lastUpdated: Date.now()
      }
    case 'SELECT_DOCUMENT':
      return {
        ...state,
        selectedDocumentId: action.payload.id,
        lastAction: 'SELECT_DOCUMENT',
        lastUpdated: Date.now()
      }
    case 'DOCUMENT_UPLOADED':
      return {
        ...state,
        lastAction: 'DOCUMENT_UPLOADED',
        lastUpdated: Date.now()
      }
    case 'STIX_LOADING_START':
      return {
        ...state,
        isStixLoading: true,
        lastAction: 'STIX_LOADING_START',
        lastUpdated: Date.now()
      }
    case 'STIX_LOADING_COMPLETE':
      return {
        ...state,
        isStixLoading: false,
        lastAction: 'STIX_LOADING_COMPLETE',
        lastUpdated: Date.now()
      }
    default:
      return state
  }
}

// Provider component
export function DocumentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(documentReducer, {
    lastAction: null,
    lastUpdated: 0,
    selectedDocumentId: null,
    isStixLoading: false
  })

  return (
    <DocumentContext.Provider value={{ state, dispatch }}>
      {children}
    </DocumentContext.Provider>
  )
}

// Custom hook for using the document context
export function useDocument() {
  const context = useContext(DocumentContext)
  if (context === undefined) {
    throw new Error('useDocument must be used within a DocumentProvider')
  }
  return context
}
