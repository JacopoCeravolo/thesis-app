"use client";

import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { JsonViewerComponent } from "./json-viewer";
import styles from "./stix-inspector.module.css";
import { useDocument } from "@/contexts/DocumentContext";
import { Loader } from "./ui/loader";

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

interface STIXInspectorProps {
  // Props will be added when we have a real backend
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
  const [extractionStartTime, setExtractionStartTime] = useState<number | null>(
    null
  );
  const { state, dispatch } = useDocument();

  // Listen for direct loading state changes via custom event
  useEffect(() => {
    const handleLoadingStateChange = (
      event: CustomEvent<{
        isLoading: boolean;
        extractionStartTime?: number | null;
      }>
    ) => {
      console.log(
        "[STIX Inspector] Received custom loading event:",
        event.detail.isLoading,
        "extractionStartTime:",
        event.detail.extractionStartTime
      );
      setIsLoading(event.detail.isLoading);

      // If we receive an extraction start time, track it
      if (event.detail.extractionStartTime) {
        setExtractionStartTime(event.detail.extractionStartTime);
      }

      // If loading is complete, reset the extraction start time
      if (!event.detail.isLoading) {
        setExtractionStartTime(null);
      }
    };

    // Check if the global loading state is already set
    if (typeof window !== "undefined") {
      if ((window as any).stixIsLoading) {
        console.log("[STIX Inspector] Initial global loading state is true");
        setIsLoading(true);
      }

      // Also check for extraction start time
      if ((window as any).stixExtractionStartTime) {
        console.log(
          "[STIX Inspector] Initial extraction start time:",
          (window as any).stixExtractionStartTime
        );
        setExtractionStartTime((window as any).stixExtractionStartTime);
      }
    }

    // Add event listener for the custom event
    window.addEventListener(
      "stixLoadingStateChanged",
      handleLoadingStateChange as EventListener
    );

    // Clean up
    return () => {
      window.removeEventListener(
        "stixLoadingStateChanged",
        handleLoadingStateChange as EventListener
      );
    };
  }, []);

  // Debug log for STIX loading state changes from context
  useEffect(() => {
    console.log(
      `[STIX Inspector] Context STIX loading state changed: ${
        state.isStixLoading ? "loading" : "not loading"
      }`
    );

    // Sync our local loading state with context if it changes to false
    if (!state.isStixLoading && isLoading) {
      setIsLoading(false);
    }
  }, [state.isStixLoading, isLoading]);

  // Fetch STIX bundle when document is selected or when loading state changes
  useEffect(() => {
    const fetchStixBundle = async () => {
      // Always log STIX loading state for debugging
      console.log(
        `[STIX Inspector] fetchStixBundle called. Loading state: ${
          isLoading ? "loading" : "not loading"
        }, extraction start time: ${extractionStartTime}`
      );

      if (state.selectedDocumentId) {
        try {
          const response = await fetch(
            `/api/documents/${state.selectedDocumentId}`
          );

          if (!response.ok) {
            throw new Error("Failed to fetch document data");
          }

          const data = await response.json();

          if (data.document.stixBundleUrl) {
            // If document has a STIX bundle URL, check if it's a new bundle after extraction
            try {
              const bundleResponse = await fetch(data.document.stixBundleUrl);

              if (bundleResponse.ok) {
                const bundleData = await bundleResponse.json();

                // Check document modification time against extraction start time
                const modifiedTime = new Date(
                  data.document.uploadedAt
                ).getTime();

                // Only update the bundle if:
                // 1. We're not currently waiting for a new extraction (no extractionStartTime), OR
                // 2. The document was modified after the extraction started (meaning new data is available)
                if (
                  !extractionStartTime ||
                  modifiedTime > extractionStartTime
                ) {
                  console.log(
                    "[STIX Inspector] Setting new STIX bundle, modified time:",
                    modifiedTime,
                    "extraction start time:",
                    extractionStartTime
                  );
                  setStixBundle(bundleData);

                  // STIX loading is complete since we have fresh data
                  dispatch({ type: "STIX_LOADING_COMPLETE" });
                  setIsLoading(false);
                  setExtractionStartTime(null);
                  (window as any).stixIsLoading = false;
                  (window as any).stixExtractionStartTime = null;
                } else {
                  console.log(
                    "[STIX Inspector] Ignoring old STIX bundle, waiting for new extraction to complete"
                  );
                  // We have an old bundle but we're waiting for the new one
                  // Keep the loading state active
                }
              } else {
                console.error("Failed to fetch STIX bundle from URL");
                // Don't set mock data here - keep showing loading state
              }
            } catch (bundleError) {
              console.error(
                "Error fetching STIX bundle from URL:",
                bundleError
              );
              // Don't set mock data here - keep showing loading state
            }
          } else {
            // If document doesn't have a STIX bundle yet, it might still be processing
            console.log("Document doesn't have STIX bundle URL yet");

            // Note: we don't complete loading here as the extraction might still be in progress
          }
        } catch (error) {
          console.error("Error fetching document data:", error);
          dispatch({ type: "STIX_LOADING_COMPLETE" });
          setIsLoading(false);
          setExtractionStartTime(null);
          (window as any).stixIsLoading = false;
          (window as any).stixExtractionStartTime = null;
        }
      } else {
        // No document selected, clear the bundle and ensure loading is complete
        setStixBundle(null);
        dispatch({ type: "STIX_LOADING_COMPLETE" });
        setIsLoading(false);
        setExtractionStartTime(null);
        (window as any).stixIsLoading = false;
        (window as any).stixExtractionStartTime = null;
      }
    };

    // Conditionally fetch based on state
    if (state.selectedDocumentId) {
      fetchStixBundle();
    }

    // Set up polling to check for STIX bundle completion
    let pollInterval: NodeJS.Timeout | null = null;

    // Only poll if we have a selected document and STIX is loading
    if (state.selectedDocumentId && (isLoading || state.isStixLoading)) {
      console.log("Starting polling for STIX bundle");
      pollInterval = setInterval(() => {
        console.log(
          "Polling for STIX bundle...",
          "extraction start time:",
          extractionStartTime
        );
        fetchStixBundle();
      }, 2000); // Check every 2 seconds for faster feedback
    }

    // Clean up interval when component unmounts or dependencies change
    return () => {
      if (pollInterval) {
        console.log("Clearing polling interval");
        clearInterval(pollInterval);
      }
    };
  }, [
    state.selectedDocumentId,
    isLoading,
    state.isStixLoading,
    extractionStartTime,
    dispatch,
  ]);

  // Render loading state before any other conditional rendering
  if (isLoading || state.isStixLoading) {
    console.log("[STIX Inspector] Rendering loading state");
    return (
      <div className={styles.stixLoading}>
        <Loader text="Extracting STIX data from document..." size="large" />
      </div>
    );
  }

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
  const filteredBundle = (() => {
    const currentBundle = stixBundle || mockStixBundle;
    let filtered = { ...currentBundle };

    // Filter by type if selected
    if (selectedType) {
      filtered = {
        ...filtered,
        objects: filtered.objects.filter(
          (obj) => obj.type === selectedType || obj.type === "relationship"
        ),
      };
    }

    // Filter by search text if provided
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filtered = {
        ...filtered,
        objects: filtered.objects.filter((obj) => {
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

          return nameMatch || descMatch || idMatch;
        }),
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

  if (!stixBundle || !stixBundle.objects || stixBundle.objects.length === 0) {
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
