"use client"

import { useMemo } from 'react'
import styles from './json-viewer.module.css'

interface JsonViewerComponentProps {
  data: any
  onNodeSelect?: (id: string) => void
  selectedNodeId?: string | null
}

export function JsonViewerComponent({ 
  data, 
  onNodeSelect, 
  selectedNodeId 
}: JsonViewerComponentProps) {
  // Process STIX data to add highlighting for selected node
  const processedData = useMemo(() => {
    if (!selectedNodeId) return data
    
    // Deep clone the data to avoid mutating the original
    const newData = JSON.parse(JSON.stringify(data))
    
    // Helper function to process objects recursively
    const processObject = (obj: any) => {
      // If this is an object with an ID that matches the selected node
      if (obj && typeof obj === 'object' && obj.id === selectedNodeId) {
        // Add a property to indicate this object is selected (for styling)
        obj.__selected = true
      }
      
      // Process children if this is an object or array
      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          obj.forEach(item => processObject(item))
        } else {
          Object.values(obj).forEach(value => processObject(value))
        }
      }
    }
    
    processObject(newData)
    return newData
  }, [data, selectedNodeId])

  const renderJson = (data: any, level = 0) => {
    if (data === null) {
      return <span className={styles.valueNull}>null</span>
    }
    
    if (typeof data === 'boolean') {
      return <span className={styles.valueBoolean}>{data.toString()}</span>
    }
    
    if (typeof data === 'number') {
      return <span className={styles.valueNumber}>{data}</span>
    }
    
    if (typeof data === 'string') {
      return <span className={styles.valueString}>"{data}"</span>
    }
    
    if (Array.isArray(data)) {
      if (data.length === 0) return <span>[]</span>
      
      return (
        <div style={{ paddingLeft: level > 0 ? '1.5rem' : '0' }}>
          [
          {data.map((item, i) => (
            <div key={i}>
              {renderJson(item, level + 1)}
              {i < data.length - 1 ? ',' : ''}
            </div>
          ))}
          ]
        </div>
      )
    }
    
    if (typeof data === 'object') {
      const entries = Object.entries(data)
      if (entries.length === 0) return <span>{'{}'}</span>
      
      const isStixObject = data.id && data.type && !data.__selected
      const isSelected = data.__selected
      
      // Don't render the internal __selected flag
      const visibleEntries = entries.filter(([key]) => key !== '__selected')
      
      const objectContent = (
        <div style={{ paddingLeft: level > 0 ? '1.5rem' : '0' }}>
          {'{'}
          {visibleEntries.map(([key, value], i) => (
            <div key={key}>
              <span className={styles.key}>{key}</span>: {renderJson(value, level + 1)}
              {i < visibleEntries.length - 1 ? ',' : ''}
            </div>
          ))}
          {'}'}
        </div>
      )
      
      if (isStixObject) {
        return (
          <div 
            className={isSelected ? styles.selected : styles.clickable}
            onClick={(e) => {
              e.stopPropagation()
              onNodeSelect?.(data.id)
            }}
            title={`Click to focus on ${data.id}`}
          >
            {objectContent}
          </div>
        )
      }
      
      return objectContent
    }
    
    return <span>{String(data)}</span>
  }

  return (
    <div className={styles.container}>
      {renderJson(processedData)}
    </div>
  )
}
