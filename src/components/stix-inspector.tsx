"use client";

import { useState, useEffect } from "react";
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

  // Fetch STIX data when a document is selected
  useEffect(() => {
    const fetchStixData = async () => {
      if (!state.selectedDocumentId) {
        setStixBundle(null);
        setIsLoading(false);
        setExtractionInProgress(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // First fetch document metadata to check if STIX data already exists
        const docResponse = await fetch(
          `/api/documents/${state.selectedDocumentId}`
        );

        if (!docResponse.ok) {
          throw new Error(
            `Failed to fetch document data: ${docResponse.status}`
          );
        }

        const docData = await docResponse.json();
        console.log("Received document data:", docData);

        // If document already has STIX data, fetch it directly
        if (docData.document.stixBundleUrl) {
          console.log(
            "Document already has STIX data, fetching from URL:",
            docData.document.stixBundleUrl
          );

          const stixResponse = await fetch(docData.document.stixBundleUrl);
          if (!stixResponse.ok) {
            throw new Error(
              `Failed to fetch STIX bundle: ${stixResponse.status}`
            );
          }

          const stixBundle = await stixResponse.json();
          setStixBundle(stixBundle);
          setIsLoading(false);
          setExtractionInProgress(false);
        } else {
          // No STIX data exists yet, trigger extraction
          console.log("No STIX data exists yet, triggering extraction");
          setExtractionInProgress(true);

          const extractResponse = await fetch(
            `/api/extract/${state.selectedDocumentId}`
          );

          if (!extractResponse.ok) {
            throw new Error(
              `Failed to extract STIX data: ${extractResponse.status}`
            );
          }

          const extractData = await extractResponse.json();

          if (extractData.stixBundleUrl) {
            console.log(
              "STIX extraction completed, fetching from URL:",
              extractData.stixBundleUrl
            );

            // Fetch the newly extracted STIX bundle
            const stixResponse = await fetch(extractData.stixBundleUrl);
            if (!stixResponse.ok) {
              throw new Error(
                `Failed to fetch extracted STIX bundle: ${stixResponse.status}`
              );
            }

            const stixBundle = await stixResponse.json();
            setStixBundle(stixBundle);
          } else if (extractData.status === "extraction_in_progress") {
            // If extraction is still processing, keep the loading state
            console.log("STIX extraction is still processing");
            setStixBundle(null); // Ensure we don't show old data
          } else {
            throw new Error(
              `STIX extraction did not return a bundle URL: ${JSON.stringify(
                extractData
              )}`
            );
          }

          setIsLoading(false);
          setExtractionInProgress(
            extractData.status === "extraction_in_progress"
          );
        }
      } catch (err) {
        console.error("Error fetching STIX data:", err);
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
        setExtractionInProgress(false);
      }
    };

    fetchStixData();

    // Poll for extraction status if extraction is in progress
    let pollingInterval: NodeJS.Timeout | null = null;

    if (extractionInProgress && state.selectedDocumentId) {
      pollingInterval = setInterval(async () => {
        try {
          console.log("Polling for extraction status...");
          const docResponse = await fetch(
            `/api/documents/${state.selectedDocumentId}`
          );

          if (!docResponse.ok) {
            throw new Error(
              `Failed to fetch document data: ${docResponse.status}`
            );
          }

          const docData = await docResponse.json();

          // If STIX data is now available, fetch it
          if (docData.document.stixBundleUrl) {
            console.log(
              "STIX data now available, fetching from URL:",
              docData.document.stixBundleUrl
            );

            const stixResponse = await fetch(docData.document.stixBundleUrl);
            if (!stixResponse.ok) {
              throw new Error(
                `Failed to fetch STIX bundle: ${stixResponse.status}`
              );
            }

            const stixBundle = await stixResponse.json();
            setStixBundle(stixBundle);
            setExtractionInProgress(false);

            // Clear the polling interval once data is available
            if (pollingInterval) {
              clearInterval(pollingInterval);
            }
          }
        } catch (err) {
          console.error("Error polling for extraction status:", err);
          // Don't set error here to avoid disrupting the UI during polling
        }
      }, 5000); // Poll every 5 seconds
    }

    // Clean up polling interval on component unmount or document change
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [state.selectedDocumentId, extractionInProgress]);

  // Filter bundle based on selected node
  const getFilteredBundle = () => {
    if (!selectedNodeId || !stixBundle) {
      return stixBundle || mockStixBundle;
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

  // Filter by type and search text
  const filteredBundle = stixBundle
    ? {
        // Use real data or mock data if none is available
        ...stixBundle,
        objects: stixBundle.objects.filter((obj) => {
          // Filter by type if selected
          if (
            selectedType &&
            obj.type !== selectedType &&
            obj.type !== "relationship"
          ) {
            return false;
          }

          // Filter by search text if provided
          if (searchText) {
            const lowerSearch = searchText.toLowerCase();
            // Check name or description
            const nameMatch =
              obj.name && obj.name.toLowerCase().includes(lowerSearch);
            const descMatch =
              obj.description &&
              obj.description.toLowerCase().includes(lowerSearch);

            // Also check ID if it looks like a search for a specific object
            const idMatch =
              lowerSearch.includes("--") &&
              obj.id.toLowerCase().includes(lowerSearch);

            if (!nameMatch && !descMatch && !idMatch) {
              return false;
            }
          }

          return true;
        }),
      }
    : mockStixBundle;

  // Select or deselect a node
  const handleNodeSelect = (id: string | null) => {
    setSelectedNodeId(id);
  };

  // Get unique types for the filter
  const objectTypes = Array.from(
    new Set(
      (stixBundle || mockStixBundle).objects
        .filter((obj) => obj.type !== "relationship")
        .map((obj) => obj.type)
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
  if (isLoading || extractionInProgress) {
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
            <button
              className={styles.tab}
              data-state={selectedType === null ? "active" : ""}
              onClick={() => setSelectedType(null)}
            >
              All
            </button>
            {objectTypes.map((type) => (
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
