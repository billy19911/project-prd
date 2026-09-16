"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";

export type MindmapNode = {
  id: string;
  data?: { label?: string };
  position?: { x: number; y: number };
};
export type MindmapEdge = {
  id: string;
  source: string;
  target: string;
};

/** Node default React Flow dengan gaya konsisten (anti-slop). */
function toFlowNodes(nodes: MindmapNode[]): Node[] {
  return nodes.map((n, i) => ({
    id: n.id,
    data: { label: n.data?.label || n.id },
    position: n.position ?? { x: (i % 4) * 220, y: Math.floor(i / 4) * 120 },
    type: "default",
    style: {
      background: "var(--surface-2)",
      color: "var(--foreground)",
      border: "1px solid var(--border-strong)",
      borderRadius: 10,
      padding: "8px 12px",
      fontSize: 12,
      fontWeight: 500,
      width: 160,
      textAlign: "center",
    },
  }));
}

function toFlowEdges(edges: MindmapEdge[], rootId: string | undefined): Edge[] {
  const seen = new Set<string>();
  const out: Edge[] = [];
  for (const e of edges) {
    const key = `${e.source}->${e.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: e.source === rootId,
      style: { stroke: "var(--border-strong)", strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-strong)" },
    });
  }
  return out;
}

export function MindmapCanvas({
  nodes: rawNodes,
  edges: rawEdges,
  editable = false,
  onNodesChangeExternal,
  className,
  height = "h-[420px]",
}: {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  editable?: boolean;
  onNodesChangeExternal?: (nodes: MindmapNode[]) => void;
  className?: string;
  height?: string;
}) {
  const initialNodes = useMemo(() => toFlowNodes(rawNodes), [rawNodes]);
  const rootId = rawNodes[0]?.id;
  const initialEdges = useMemo(
    () => toFlowEdges(rawEdges, rootId),
    [rawEdges, rootId]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sinkron saat data berubah (mis. regenerate).
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Laporkan perubahan posisi ke parent (mode editable).
  useEffect(() => {
    if (!editable || !onNodesChangeExternal) return;
    onNodesChangeExternal(
      nodes.map((n) => ({
        id: n.id,
        data: { label: String(n.data?.label ?? "") },
        position: n.position,
      }))
    );
  }, [nodes, editable, onNodesChangeExternal]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      if (editable) onNodesChange(changes);
      else {
        // tetap izinkan select/hover, blokir pergerakan posisi
        onNodesChange(changes.filter((c) => c.type !== "position"));
      }
    },
    [editable, onNodesChange]
  );

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-background/60", height, className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={(c: EdgeChange<Edge>[]) => editable && onEdgesChange(c)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.8}
        nodesDraggable={editable}
        nodesConnectable={false}
        elementsSelectable={editable}
      >
        <Background color="var(--border)" gap={22} />
        <Controls showInteractive={false} className="!shadow-none" />
        <MiniMap
          pannable
          zoomable
          className="!hidden sm:!block"
          nodeColor="var(--border-strong)"
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>
    </div>
  );
}
