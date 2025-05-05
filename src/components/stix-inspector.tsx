"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { JsonViewerComponent } from "./json-viewer";
import styles from "./stix-inspector.module.css";
import { useDocument } from "@/contexts/DocumentContext";

interface STIXObject {
  id: string;
  type: string;
  [key: string]: any;
}

interface STIXBundle {
  type: string;
  id: string;
  objects: STIXObject[];
  [key: string]: any;
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
      description:
        "Wizard Spider is a financially motivated criminal group that has been conducting ransomware campaigns since 2018.",
    },
    {
      type: "malware",
      id: "malware--a5cc5ae4-5fa2-45fb-af4b-8fb0da4f3ea8",
      name: "TrickBot",
      description:
        "TrickBot is a modular banking trojan first observed in 2016 and regularly updated.",
    },
    {
      type: "attack-pattern",
      id: "attack-pattern--b9c5b4e3-3d1c-4a8c-82f4-d89b0e4b5d1f",
      name: "Phishing",
      description:
        "Phishing involves sending emails with a malicious attachment or link.",
    },
    {
      type: "relationship",
      id: "relationship--ca285fe5-7af2-4115-a250-b7ac2215ab21",
      relationship_type: "uses",
      source_ref: "threat-actor--d0372943-1579-4117-ae8c-2ba3897081a9",
      target_ref: "malware--a5cc5ae4-5fa2-45fb-af4b-8fb0da4f3ea8",
    },
    {
      type: "relationship",
      id: "relationship--e7f6efad-0b1b-47e7-9c3c-8f799f9fb335",
      relationship_type: "delivers",
      source_ref: "attack-pattern--b9c5b4e3-3d1c-4a8c-82f4-d89b0e4b5d1f",
      target_ref: "malware--a5cc5ae4-5fa2-45fb-af4b-8fb0da4f3ea8",
    },
  ],
};

export function StixInspector() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [activeViewTab, setActiveViewTab] = useState("json");
  const [stixBundle, setStixBundle] = useState<STIXBundle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionInProgress, setExtractionInProgress] = useState(false);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(
    null
  );

  const { state } = useDocument();

  // Reset state when switching documents
  useEffect(() => {
    if (state.selectedDocumentId !== currentDocumentId) {
      // Reset state for new document
      setStixBundle(null);
      setSelectedNodeId(null);
      setSelectedType(null);
      setError(null);
      setExtractionInProgress(false);
      setCurrentDocumentId(state.selectedDocumentId);
    }
  }, [state.selectedDocumentId, currentDocumentId]);

  // Fetch STIX data for the selected document
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | undefined;

    async function fetchStix() {
      if (!state.selectedDocumentId) return;

      setIsLoading(true);
      setError(null);
      setStixBundle(null); // Clear existing data to ensure loader shows

      try {
        const response = await fetch(
          `/api/extract/${state.selectedDocumentId}`
        );
        const data = await response.json();

        // Check if this is a background processing response
        if (data.status === "pending" || data.status === "processing") {
          console.log("STIX extraction in progress:", data);
          // Keep loading state active
          setIsLoading(true);

          // Start polling for completion
          pollingInterval = setInterval(async () => {
            try {
              const pollResponse = await fetch(
                `/api/extract/${state.selectedDocumentId}`
              );
              const pollData = await pollResponse.json();

              console.log("Polling extraction status:", pollData);

              // Check if extraction is complete (response has no status field)
              if (pollResponse.ok && !pollData.status) {
                // We have the actual STIX data now
                setStixBundle(pollData);
                setIsLoading(false);
                clearInterval(pollingInterval);
              } else if (pollData.status === "failed") {
                // Extraction failed
                setError(
                  `STIX extraction failed: ${pollData.error || "Unknown error"}`
                );
                setIsLoading(false);
                clearInterval(pollingInterval);
              }
              // Continue polling if still processing
            } catch (pollError) {
              console.error("Polling error:", pollError);
            }
          }, 3000);
        } else if (!response.ok) {
          // Regular error
          throw new Error(data.error || "Failed to fetch STIX data");
        } else {
          // We already have the STIX data
          console.log("STIX data received directly:", data);
          setStixBundle(data);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error in STIX extraction:", err);
        setError(
          err instanceof Error ? err.message : "Error in STIX extraction"
        );
        setIsLoading(false);
      }
    }

    fetchStix();

    // Clean up interval on unmount or when document changes
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [state.selectedDocumentId]);

  // Find all unique object types in the bundle
  const getObjectTypes = () => {
    if (
      !stixBundle ||
      !stixBundle.objects ||
      !Array.isArray(stixBundle.objects)
    ) {
      return ["All"];
    }

    const types = [...new Set(stixBundle.objects.map((obj) => obj.type))];
    return ["All", ...types.sort()];
  };

  // Filter bundle based on selected node
  const getFilteredBundle = () => {
    if (!stixBundle || !stixBundle.objects) {
      return { type: "bundle", id: "empty-bundle", objects: [] };
    }

    // Find all relationships that include the selected node
    const relatedRelationships = stixBundle.objects.filter(
      (obj) =>
        obj.type === "relationship" &&
        ((obj.source_ref && obj.source_ref === selectedNodeId) ||
          (obj.target_ref && obj.target_ref === selectedNodeId))
    );

    // Get all the ids of objects connected through these relationships
    const connectedIds = new Set<string>();
    if (selectedNodeId) {
      connectedIds.add(selectedNodeId);
    }

    // Add both source and target of each relationship
    relatedRelationships.forEach((rel) => {
      if (rel.source_ref) connectedIds.add(rel.source_ref);
      if (rel.target_ref) connectedIds.add(rel.target_ref);
    });

    // Filter the bundle to only include selected object, related objects and their relationships
    const filteredObjects = stixBundle.objects.filter(
      (obj) =>
        connectedIds.has(obj.id) ||
        (obj.type === "relationship" &&
          ((obj.source_ref && connectedIds.has(obj.source_ref)) ||
            (obj.target_ref && connectedIds.has(obj.target_ref))))
    );

    return {
      ...stixBundle,
      objects: filteredObjects,
    };
  };

  // Get filtered bundle based on search term and selected type
  const filteredBundle = useMemo(() => {
    if (!stixBundle || !stixBundle.objects) {
      return { type: "bundle", id: "empty-bundle", objects: [] };
    }

    return {
      ...stixBundle,
      objects: stixBundle.objects.filter((obj) => {
        // Filter by type if selected
        if (
          selectedType &&
          selectedType !== "All" &&
          obj.type !== selectedType
        ) {
          return false;
        }

        // Filter by search term
        if (searchText && searchText.trim() !== "") {
          const term = searchText.toLowerCase();
          const matchesName = obj.name && obj.name.toLowerCase().includes(term);
          const matchesId = obj.id.toLowerCase().includes(term);
          const matchesType = obj.type.toLowerCase().includes(term);

          // For indicators, also search pattern
          const matchesPattern =
            obj.type === "indicator" &&
            obj.pattern &&
            obj.pattern.toLowerCase().includes(term);

          return matchesName || matchesId || matchesType || matchesPattern;
        }

        return true;
      }),
    };
  }, [stixBundle, searchText, selectedType]);

  // Select or deselect a node
  const handleNodeSelect = (id: string | null) => {
    setSelectedNodeId(id);
  };

  // Current bundle to display based on filters and selection
  const currentBundle = useMemo(() => {
    if (selectedNodeId && stixBundle && stixBundle.objects) {
      return getFilteredBundle();
    }
    return filteredBundle;
  }, [selectedNodeId, stixBundle, filteredBundle]);

  // Add loading state at the component level
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>
            Extracting STIX bundle from document...
          </p>
          <p className={styles.loadingSubText}>This might take a while</p>
        </div>
      </div>
    );
  }

  // Add empty placeholder when no document is selected
  if (!state.selectedDocumentId) {
    return (
      <div className={styles.emptyState}>
        <h3>STIX Inspector</h3>
        <p>Select a document to view extracted STIX entities</p>
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
  if (!stixBundle) {
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
            {getObjectTypes().map((type) => (
              <button
                key={type}
                className={styles.tab}
                data-state={selectedType === type ? "active" : ""}
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
              data-state={activeViewTab === "json" ? "active" : ""}
              onClick={() => setActiveViewTab("json")}
            >
              JSON
            </button>
            <button
              className={styles.viewTab}
              data-state={activeViewTab === "graph" ? "active" : ""}
              onClick={() => setActiveViewTab("graph")}
            >
              Graph
            </button>
          </div>

          <div
            className={styles.viewContent}
            data-state={activeViewTab === "json" ? "active" : ""}
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
            data-state={activeViewTab === "graph" ? "active" : ""}
          >
            <div className={styles.graphContainer}>
              <div className={styles.loadingMessage}>
                Graph view is currently unavailable. Please use the JSON view to
                inspect the STIX data.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
