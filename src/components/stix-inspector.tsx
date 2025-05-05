"use client"

import { useState, useEffect } from 'react'
import { Input } from './ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { JsonViewerComponent } from './json-viewer'
import styles from './stix-inspector.module.css'
import { useDocument } from "@/contexts/DocumentContext";

interface STIXObject {
  id: string
  type: string
  [key: string]: any
}

interface STIXBundle {
  type: string
  id: string
  objects: STIXObject[]
  [key: string]: any
}

// Mock STIX data for testing - will be used as fallback when no document is loaded
const mockStixBundle: STIXBundle = {
  type: "bundle",
  id: "bundle--756e7f1e-7c3f-4196-a2b5-9ae4676db4ef",
  objects: [
    {
      type: "threat-actor",
      id: "threat-actor--d0372943-1579-4117-ae8c-2ba3897081a9",
      name: "Wizard Spider",
      description: "Wizard Spider is a financially motivated criminal group that has been conducting ransomware campaigns since 2018."
    },
    {
      type: "malware",
      id: "malware--a5cc5ae4-5fa2-45fb-af4b-8fb0da4f3ea8",
      name: "TrickBot",
      description: "TrickBot is a modular banking trojan first observed in 2016 and regularly updated."
    },
    {
      type: "attack-pattern",
      id: "attack-pattern--b9c5b4e3-3d1c-4a8c-82f4-d89b0e4b5d1f",
      name: "Phishing",
      description: "Phishing involves sending emails with a malicious attachment or link."
    },
    {
      type: "relationship",
      id: "relationship--ca285fe5-7af2-4115-a250-b7ac2215ab21",
      relationship_type: "uses",
      source_ref: "threat-actor--d0372943-1579-4117-ae8c-2ba3897081a9",
      target_ref: "malware--a5cc5ae4-5fa2-45fb-af4b-8fb0da4f3ea8"
    },
    {
      type: "relationship",
      id: "relationship--e7f6efad-0b1b-47e7-9c3c-8f799f9fb335",
      relationship_type: "delivers",
      source_ref: "attack-pattern--b9c5b4e3-3d1c-4a8c-82f4-d89b0e4b5d1f",
      target_ref: "malware--a5cc5ae4-5fa2-45fb-af4b-8fb0da4f3ea8"
    }
  ]
};

export function StixInspector() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [activeViewTab, setActiveViewTab] = useState('json');
  const [stixBundle, setStixBundle] = useState<STIXBundle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { state } = useDocument();
  
  // Fetch STIX data when a document is selected
  useEffect(() => {
    const fetchStixData = async () => {
      if (!state.selectedDocumentId) {
        setStixBundle(null);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Call the extract endpoint to generate STIX data
        const response = await fetch(`/api/extract/${state.selectedDocumentId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch STIX data: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received STIX data:', data);
        
        if (data.stixBundle) {
          setStixBundle(data.stixBundle);
        } else {
          setStixBundle(null);
          setError('No STIX data available for this document');
        }
      } catch (err) {
        console.error('Error fetching STIX data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch STIX data');
        setStixBundle(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStixData();
  }, [state.selectedDocumentId]);
  
  // Filter bundle based on selected node
  const getFilteredBundle = () => {
    if (!selectedNodeId || !stixBundle) {
      return stixBundle || mockStixBundle;
    }
    
    // Find all relationships that include the selected node
    const relatedRelationships = stixBundle.objects.filter(
      obj => obj.type === 'relationship' && 
      ((obj.source_ref && obj.source_ref === selectedNodeId) || 
       (obj.target_ref && obj.target_ref === selectedNodeId))
    );
    
    // Get all the ids of objects connected through these relationships
    const connectedIds = new Set<string>();
    if (selectedNodeId) {
      connectedIds.add(selectedNodeId);
    }
    
    // Add both source and target of each relationship
    relatedRelationships.forEach(rel => {
      if (rel.source_ref) connectedIds.add(rel.source_ref);
      if (rel.target_ref) connectedIds.add(rel.target_ref);
    });
    
    // Filter the bundle to only include selected object, related objects and their relationships
    const filteredObjects = stixBundle.objects.filter(
      obj => connectedIds.has(obj.id) || 
      (obj.type === 'relationship' && 
       ((obj.source_ref && connectedIds.has(obj.source_ref)) || 
        (obj.target_ref && connectedIds.has(obj.target_ref))))
    );
    
    return {
      ...stixBundle,
      objects: filteredObjects
    };
  };
  
  // Filter by type and search text
  const filteredBundle = (() => {
    // Use real data or mock data if none is available
    const currentBundle = stixBundle || mockStixBundle;
    let filtered = { ...currentBundle };
    
    // Filter by type if selected
    if (selectedType) {
      filtered = {
        ...filtered,
        objects: filtered.objects.filter(obj => obj.type === selectedType || obj.type === 'relationship')
      };
    }
    
    // Filter by search text if provided
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filtered = {
        ...filtered,
        objects: filtered.objects.filter(obj => {
          // Check name or description
          const nameMatch = obj.name && obj.name.toLowerCase().includes(lowerSearch);
          const descMatch = obj.description && obj.description.toLowerCase().includes(lowerSearch);
          
          // Also check ID if it looks like a search for a specific object
          const idMatch = lowerSearch.includes('--') && obj.id.toLowerCase().includes(lowerSearch);
          
          return nameMatch || descMatch || idMatch;
        })
      };
    }
    
    return filtered;
  })();
  
  // Select or deselect a node
  const handleNodeSelect = (id: string | null) => {
    setSelectedNodeId(id);
  };
  
  // Get unique types for the filter
  const objectTypes = Array.from(
    new Set(
      (stixBundle || mockStixBundle).objects
        .filter(obj => obj.type !== 'relationship')
        .map(obj => obj.type)
    )
  );
  
  // Current bundle to display based on filters and selection
  const currentBundle = selectedNodeId ? getFilteredBundle() : filteredBundle;

  // Add empty placeholder when no document is selected
  if (!state.selectedDocumentId) {
    return (
      <div className={styles.emptyState}>
        <h3>STIX Inspector</h3>
        <p>Select a document to view extracted STIX entities</p>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>Extracting STIX data...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={styles.errorState}>
        <h3>STIX Inspector</h3>
        <p>Error: {error}</p>
      </div>
    );
  }

  // If no bundle is available but document is selected, show empty state
  if (!stixBundle && !mockStixBundle) {
    return (
      <div className={styles.emptyState}>
        <h3>STIX Inspector</h3>
        <p>No STIX entities found in this document</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>STIX Bundle Inspector</h2>
        
        <div className={styles.tabsRow}>
          <div className={styles.tabsList}>
            <button 
              className={styles.tab} 
              data-state={selectedType === null ? 'active' : ''}
              onClick={() => setSelectedType(null)}
            >
              All
            </button>
            {objectTypes.map(type => (
              <button 
                key={type}
                className={styles.tab} 
                data-state={selectedType === type ? 'active' : ''}
                onClick={() => setSelectedType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        
        <Input
          type="text"
          placeholder="Search objects..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className={styles.searchInput}
        />
      </div>
      
      <hr className={styles.separator} />
      
      <div className={styles.contentContainer}>
        <div className={styles.viewTabs}>
          <div className={styles.viewTabsList}>
            <button 
              className={styles.viewTab} 
              data-state={activeViewTab === 'json' ? 'active' : ''}
              onClick={() => setActiveViewTab('json')}
            >
              JSON
            </button>
            <button 
              className={styles.viewTab} 
              data-state={activeViewTab === 'graph' ? 'active' : ''}
              onClick={() => setActiveViewTab('graph')}
            >
              Graph
            </button>
          </div>
          
          <div 
            className={styles.viewContent} 
            data-state={activeViewTab === 'json' ? 'active' : ''}
          >
            <div className={styles.jsonView}>
              <JsonViewerComponent 
                data={currentBundle} 
                onNodeSelect={handleNodeSelect}
                selectedNodeId={selectedNodeId}
              />
            </div>
          </div>
          
          <div 
            className={styles.viewContent} 
            data-state={activeViewTab === 'graph' ? 'active' : ''}
          >
            <div className={styles.graphContainer}>
              <div className={styles.loadingMessage}>
                Graph view is currently unavailable. Please use the JSON view to inspect the STIX data.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
