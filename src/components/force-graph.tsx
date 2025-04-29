"use client"

import { useRef, useEffect, useState } from 'react'
import { ForceGraph2D } from 'react-force-graph'
import styles from './force-graph.module.css'

// Define types for our graph data
interface GraphNode {
  id: string
  name: string
  type: string
  color: string
  val: number
  x?: number
  y?: number
}

interface GraphLink {
  source: string
  target: string
  id: string
  label: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface ForceGraphProps {
  data: any // STIX bundle data
  onNodeSelect?: (id: string | null) => void
  selectedNodeId?: string | null
}

// Map STIX types to colors for the graph visualization
const typeColors: Record<string, string> = {
  'identity': '#4CAF50',      // Green
  'threat-actor': '#F44336',  // Red
  'malware': '#2196F3',       // Blue
  'attack-pattern': '#FF9800', // Orange
  'indicator': '#9C27B0',     // Purple
  'relationship': '#607D8B',  // Blue Grey
  'report': '#795548',        // Brown
  'vulnerability': '#FFEB3B', // Yellow
  'tool': '#00BCD4',          // Cyan
  'campaign': '#E91E63',      // Pink
  'infrastructure': '#673AB7', // Deep Purple
  'intrusion-set': '#3F51B5', // Indigo
  'course-of-action': '#009688', // Teal
  'default': '#9E9E9E'        // Grey (default)
}

export function ForceGraph({ data, onNodeSelect, selectedNodeId }: ForceGraphProps) {
  const graphRef = useRef<any>(null)
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Convert STIX bundle to graph data
  useEffect(() => {
    if (!data || !data.objects) return
    
    const nodes: GraphNode[] = []
    const links: GraphLink[] = []
    const nodeMap = new Map()
    
    // First pass: Create nodes
    data.objects.forEach((obj: any) => {
      if (obj.type !== 'relationship') {
        const node: GraphNode = {
          id: obj.id,
          name: obj.name || obj.id.split('--')[0],
          type: obj.type,
          color: typeColors[obj.type] || typeColors.default,
          val: 1 // Size of node
        }
        nodes.push(node)
        nodeMap.set(obj.id, true)
      }
    })
    
    // Second pass: Create links
    data.objects.forEach((obj: any) => {
      if (obj.type === 'relationship' && 
          obj.source_ref && 
          obj.target_ref && 
          nodeMap.has(obj.source_ref) && 
          nodeMap.has(obj.target_ref)) {
        const link: GraphLink = {
          source: obj.source_ref,
          target: obj.target_ref,
          id: obj.id,
          label: obj.relationship_type || 'related-to'
        }
        links.push(link)
      }
    })
    
    setGraphData({ nodes, links })
  }, [data])
  
  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        })
      }
    }
    
    // Initial size
    updateDimensions()
    
    // Add resize event listener
    window.addEventListener('resize', updateDimensions)
    
    return () => {
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])
  
  // Center graph on selected node
  useEffect(() => {
    if (selectedNodeId && graphRef.current) {
      const node = graphData.nodes.find(node => node.id === selectedNodeId)
      if (node) {
        graphRef.current.centerAt(node.x, node.y, 1000)
        graphRef.current.zoom(2.5, 1000)
      }
    }
  }, [selectedNodeId, graphData])

  return (
    <div ref={containerRef} className={styles.graphContainer}>
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeId="id"
          nodeLabel="name"
          nodeColor={(node: GraphNode) => node.id === selectedNodeId ? '#FFFFFF' : node.color}
          nodeVal={(node: GraphNode) => node.id === selectedNodeId ? 2 : 1}
          linkLabel="label"
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.25}
          nodeCanvasObject={(node: GraphNode, ctx, globalScale: number) => {
            const { id, x, y, name, color } = node;
            if (x === undefined || y === undefined) return;
            
            const fontSize = 12 / globalScale;
            const isSelected = id === selectedNodeId;
            
            // Node circle
            ctx.beginPath()
            ctx.arc(x, y, isSelected ? 6 : 4, 0, 2 * Math.PI)
            ctx.fillStyle = color
            ctx.fill()
            
            // Selection ring for the selected node
            if (isSelected) {
              ctx.beginPath()
              ctx.arc(x, y, 8, 0, 2 * Math.PI)
              ctx.strokeStyle = '#FFFFFF'
              ctx.lineWidth = 2 / globalScale
              ctx.stroke()
            }
            
            // Node label
            ctx.font = `${fontSize}px Sans-Serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = isSelected ? '#FFFFFF' : '#CCCCCC'
            
            // Background for text (for better readability)
            const textWidth = ctx.measureText(name).width
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
            ctx.fillRect(
              x - textWidth / 2 - 2, 
              y + 6,
              textWidth + 4, 
              fontSize + 2
            )
            
            // Text
            ctx.fillStyle = isSelected ? '#FFFFFF' : '#CCCCCC'
            ctx.fillText(name, x, y + 6 + fontSize / 2)
          }}
          linkDirectionalParticles={(link: any) => (link.source as GraphNode).id === selectedNodeId || (link.target as GraphNode).id === selectedNodeId ? 4 : 0}
          linkDirectionalParticleWidth={2}
          onNodeClick={(node: any) => {
            // If the node is already selected, deselect it
            if (node.id === selectedNodeId) {
              onNodeSelect?.(null)
            } else {
              onNodeSelect?.(node.id)
            }
          }}
          cooldownTicks={100}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      )}
    </div>
  )
}
