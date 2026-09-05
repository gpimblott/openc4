import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Panel,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import Editor from '@monaco-editor/react';
import {
  Server,
  Save,
  Download,
  GitCompare,
  ShieldAlert,
  Layers,
  Check,
  AlertCircle,
  UploadCloud,
  Maximize2,
  Minimize2,
  Eye,
  FileCode,
  Trash2,
  ChevronDown,
  History,
  Plus,
} from 'lucide-react';

import C4Node from './components/C4Node';
import { getLayoutedElements, updateEdgesClosestHandles } from './utils/layout';
import { registerStructurizrDsl } from './utils/structurizrDsl';
import { CatalogTab } from './components/CatalogTab';
import { VisualDiffModal } from './components/VisualDiffModal';
import { InspectionDrawer } from './components/InspectionDrawer';
import type { InspectionFinding } from './components/InspectionDrawer';
import { ExportModal } from './components/ExportModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';

const nodeTypes = {
  c4Node: C4Node,
};

const defaultEdgeOptions = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#94a3b8',
    width: 18,
    height: 18,
  },
  style: {
    stroke: '#94a3b8',
    strokeWidth: 2,
  },
};

interface WorkspaceSummary {
  id: number;
  name: string;
  description: string;
  state: string;
  version: string;
  updatedAt: string;
}

interface ViewOption {
  key: string;
  type: string;
  title: string;
  description: string;
}

export function App() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<number>(1);
  const [workspaceInfo, setWorkspaceInfo] = useState<any>(null);

  // DSL and Editor
  const [dslCode, setDslCode] = useState<string>('');
  const [parseError, setParseError] = useState<{ message: string; line: number; column: number } | null>(null);

  // Views & Canvas
  const [availableViews, setAvailableViews] = useState<ViewOption[]>([]);
  const [currentViewKey, setCurrentViewKey] = useState<string>('');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Quality, Diff, Catalog, Modals
  const [findings, setFindings] = useState<InspectionFinding[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [diffData, setDiffData] = useState<any>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<'dsl' | 'catalog'>('dsl');

  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Version management states
  const [versions, setVersions] = useState<Array<{ id: number; version: string; publishedAt: string; commitMessage: string }>>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('current');
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState<boolean>(false);

  // Deletion confirmation states
  const [pendingDeleteNodes, setPendingDeleteNodes] = useState<Node[]>([]);
  const [pendingDeleteEdges, setPendingDeleteEdges] = useState<Edge[]>([]);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce ref for live auto-compilation
  const compileTimerRef = useRef<any>(null);

  // Split pane width state (percentage for DSL editor)
  const [dslWidth, setDslWidth] = useState<number>(() => {
    const saved = localStorage.getItem('openc4_dsl_width');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 15 && parsed <= 85) {
        return parsed;
      }
    }
    return 50;
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const lastDslWidthRef = useRef<number>(50);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newWidthPx = e.clientX - rect.left;
      const percentage = (newWidthPx / rect.width) * 100;
      const clamped = Math.min(Math.max(percentage, 15), 85);
      setDslWidth(clamped);
      setIsMaximized(false);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isMaximized) {
      localStorage.setItem('openc4_dsl_width', dslWidth.toString());
    }
  }, [dslWidth, isMaximized]);

  const toggleMaximize = () => {
    if (isMaximized) {
      setDslWidth(lastDslWidthRef.current || 50);
      setIsMaximized(false);
    } else {
      lastDslWidthRef.current = dslWidth;
      setDslWidth(80);
      setIsMaximized(true);
    }
  };

  // Load list of workspaces
  const loadWorkspaces = useCallback(() => {
    fetch('/api/workspaces')
      .then((res) => res.json())
      .then((data) => {
        setWorkspaces(data);
        if (data.length > 0 && !currentWorkspaceId) {
          setCurrentWorkspaceId(data[0].id);
        }
      })
      .catch((err) => console.error('Failed to load workspaces', err));
  }, [currentWorkspaceId]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Load active workspace studio data
  const loadStudioData = useCallback((wsId: number, viewKey?: string) => {
    const url = viewKey
      ? `/api/workspaces/${wsId}/studio?viewKey=${encodeURIComponent(viewKey)}`
      : `/api/workspaces/${wsId}/studio`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setWorkspaceInfo(data.workspace);
        setDslCode(data.dsl);
        setParseError(data.parseError);
        setFindings(data.findings || []);
        if (data.versions) {
          setVersions(data.versions);
        }

        if (data.canvas) {
          const rawNodes = data.canvas.nodes || [];
          const rawEdges = data.canvas.edges || [];
          const updatedEdges = updateEdgesClosestHandles(rawNodes, rawEdges);
          setNodes(rawNodes);
          setEdges(updatedEdges);
          setAvailableViews(data.canvas.availableViews || []);
          setCurrentViewKey(viewKey || data.canvas.viewKey);
        }
      })
      .catch((err) => console.error('Failed to load studio data', err));
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (currentWorkspaceId) {
      loadStudioData(currentWorkspaceId);
    }
  }, [currentWorkspaceId, loadStudioData]);

  // Update browser window title
  useEffect(() => {
    if (workspaceInfo?.name) {
      document.title = `${workspaceInfo.name} — OpenC4`;
    } else {
      document.title = 'OpenC4';
    }
  }, [workspaceInfo?.name]);

  // Handle DSL code change with instant live compilation (<50ms debounce)
  const handleEditorChange = (value: string | undefined) => {
    const newCode = value || '';
    setDslCode(newCode);
    setWorkspaceInfo((prev: any) => prev ? { ...prev, state: 'DRAFT' } : prev);
    if (selectedVersion !== 'current') {
      setSelectedVersion('current');
    }

    if (compileTimerRef.current) {
      clearTimeout(compileTimerRef.current);
    }

    compileTimerRef.current = setTimeout(() => {
      fetch(`/api/workspaces/${currentWorkspaceId}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dsl: newCode, viewKey: currentViewKey }),
      })
        .then((res) => res.json())
        .then((resData) => {
          if (resData.success && resData.canvas) {
            setParseError(null);
            const rawNodes = resData.canvas.nodes || [];
            const rawEdges = resData.canvas.edges || [];
            const updatedEdges = updateEdgesClosestHandles(rawNodes, rawEdges);
            setNodes(rawNodes);
            setEdges(updatedEdges);
            setFindings(resData.findings || []);
            setAvailableViews(resData.canvas.availableViews || []);
            if (resData.workspaceName) {
              setWorkspaceInfo((prev: any) => (prev ? { ...prev, name: resData.workspaceName } : prev));
              setWorkspaces((prev) =>
                prev.map((w) => (w.id === currentWorkspaceId ? { ...w, name: resData.workspaceName } : w))
              );
            }
          } else if (resData.parseError) {
            setParseError(resData.parseError);
          }
        })
        .catch((err) => console.error('Compile error', err));
    }, 250);
  };

  // Save workspace
  const handleSave = () => {
    setIsSaving(true);
    // Collect updated coordinates
    const layoutCoords: Record<string, Record<string, { x: number; y: number }>> = {};
    if (currentViewKey) {
      layoutCoords[currentViewKey] = {};
      nodes.forEach((n) => {
        layoutCoords[currentViewKey][n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      });
    }

    fetch(`/api/workspaces/${currentWorkspaceId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dsl: dslCode,
        layoutCoordinates: layoutCoords,
        state: 'DRAFT',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsSaving(false);
        setSaveSuccess(true);
        if (data.workspace) {
          setWorkspaceInfo(data.workspace);
        }
        loadWorkspaces();
        setTimeout(() => setSaveSuccess(false), 2000);
      })
      .catch((err) => {
        console.error('Save failed', err);
        setIsSaving(false);
      });
  };

  // Auto-Layout
  const handleAutoLayout = (direction: 'TB' | 'LR') => {
    const layouted = getLayoutedElements(nodes, edges, direction);
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
  };

  // Switch View (compiles current in-editor DSL for the target view)
  const handleViewChange = (viewKey: string) => {
    setCurrentViewKey(viewKey);
    fetch(`/api/workspaces/${currentWorkspaceId}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dsl: dslCode, viewKey }),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.canvas) {
          setParseError(null);
          const rawNodes = resData.canvas.nodes || [];
          const rawEdges = resData.canvas.edges || [];
          const updatedEdges = updateEdgesClosestHandles(rawNodes, rawEdges);
          setNodes(rawNodes);
          setEdges(updatedEdges);
          setFindings(resData.findings || []);
          setAvailableViews(resData.canvas.availableViews || []);
        } else if (resData.parseError) {
          setParseError(resData.parseError);
        }
      })
      .catch((err) => console.error('Failed to switch view', err));
  };

  // Request deletion with confirmation dialog
  const requestDelete = useCallback((nodesToDelete: Node[], edgesToDelete: Edge[]) => {
    if (nodesToDelete.length === 0 && edgesToDelete.length === 0) return;
    setPendingDeleteNodes(nodesToDelete);
    setPendingDeleteEdges(edgesToDelete);
    setIsConfirmDeleteOpen(true);
  }, []);

  // Execute confirmed deletion
  const handleConfirmDelete = async () => {
    if (pendingDeleteNodes.length === 0 && pendingDeleteEdges.length === 0) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/workspaces/${currentWorkspaceId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dsl: dslCode,
          nodeIds: pendingDeleteNodes.map((n) => n.id),
          edgeIds: pendingDeleteEdges.map((e) => (e.data as any)?.id || e.id.replace(/^e-/, '')),
          viewKey: currentViewKey,
        }),
      });
      const resData = await res.json();
      if (resData.success) {
        setDslCode(resData.dsl);
        setParseError(null);
        if (resData.canvas) {
          const rawNodes = resData.canvas.nodes || [];
          const rawEdges = resData.canvas.edges || [];
          const updatedEdges = updateEdgesClosestHandles(rawNodes, rawEdges);
          setNodes(rawNodes);
          setEdges(updatedEdges);
          setAvailableViews(resData.canvas.availableViews || []);
          if (
            resData.canvas.availableViews &&
            !resData.canvas.availableViews.some((v: any) => v.key === currentViewKey)
          ) {
            setCurrentViewKey(resData.canvas.viewKey);
          }
        }
        setFindings(resData.findings || []);
        setIsConfirmDeleteOpen(false);
        setPendingDeleteNodes([]);
        setPendingDeleteEdges([]);
      } else {
        alert(`Failed to delete: ${resData.detail || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Delete error', err);
      alert(`Delete error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Intercept ReactFlow delete key (Backspace/Delete)
  const onBeforeDelete = useCallback(
    async ({ nodes: n, edges: e }: { nodes: Node[]; edges: Edge[] }) => {
      requestDelete(n, e);
      return false; // Prevent local deletion; wait for modal confirmation
    },
    [requestDelete]
  );

  // Double-click drill down
  const onNodeDoubleClick = (_: React.MouseEvent, node: Node) => {
    const nodeData = node.data as any;
    if (nodeData.type === 'softwareSystem') {
      const containerView = availableViews.find((v) => v.type === 'container');
      if (containerView) {
        handleViewChange(containerView.key);
      }
    } else if (nodeData.type === 'container') {
      const compView = availableViews.find((v) => v.type === 'component');
      if (compView) {
        handleViewChange(compView.key);
      }
    }
  };

  // Re-calculate closest edge handles when a node is dragged and dropped
  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      setNodes((currentNodes) => {
        const updatedNodes = currentNodes.map((n) =>
          n.id === node.id ? { ...n, position: node.position } : n
        );
        setEdges((currentEdges) => updateEdgesClosestHandles(updatedNodes, currentEdges));
        return updatedNodes;
      });
    },
    [setNodes, setEdges]
  );

  // Load Catalog data
  const loadCatalog = useCallback(() => {
    fetch('/api/enterprise/catalog')
      .then((res) => res.json())
      .then((data) => {
        setCatalog(data);
      })
      .catch((err) => console.error('Failed to load catalog', err));
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Insert snippet from Catalog into DSL model
  const handleInsertDsl = (snippet: string) => {
    let updated = dslCode;
    const modelIndex = updated.indexOf('model {');
    if (modelIndex !== -1) {
      const viewsIndex = updated.indexOf('views {');
      if (viewsIndex !== -1) {
        const lastBrace = updated.lastIndexOf('}', viewsIndex);
        if (lastBrace !== -1) {
          updated =
            updated.slice(0, lastBrace) +
            `    ${snippet}\n    ` +
            updated.slice(lastBrace);
        } else {
          updated = updated + `\n${snippet}\n`;
        }
      } else {
        const lastBrace = updated.lastIndexOf('}');
        if (lastBrace !== -1) {
          updated =
            updated.slice(0, lastBrace) +
            `    ${snippet}\n    ` +
            updated.slice(lastBrace);
        } else {
          updated = updated + `\n${snippet}\n`;
        }
      }
    } else {
      updated = updated + `\n${snippet}\n`;
    }

    setDslCode(updated);
    handleEditorChange(updated);
    setLeftPanelTab('dsl');
  };

  // Version calculation helper
  const incrementPatchVersion = (ver?: string): string => {
    if (!ver) return '1.1.0';
    const parts = ver.split('.');
    if (parts.length === 3 && !isNaN(Number(parts[2]))) {
      return `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`;
    }
    if (parts.length === 2 && !isNaN(Number(parts[1]))) {
      return `${parts[0]}.${Number(parts[1]) + 1}.0`;
    }
    return `${ver}.1`;
  };

  // Load a historical version snapshot into editor
  const handleLoadVersion = (version: string) => {
    if (version === 'current') {
      setSelectedVersion('current');
      loadStudioData(currentWorkspaceId);
      return;
    }

    fetch(`/api/workspaces/${currentWorkspaceId}/versions/${encodeURIComponent(version)}`)
      .then((res) => res.json())
      .then((snap) => {
        if (snap.dslSource) {
          setSelectedVersion(version);
          setDslCode(snap.dslSource);
          setWorkspaceInfo((prev: any) => ({
            ...prev,
            version: version,
            state: 'PUBLISHED',
          }));
          fetch(`/api/workspaces/${currentWorkspaceId}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dsl: snap.dslSource, viewKey: currentViewKey }),
          })
            .then((cRes) => cRes.json())
            .then((resData) => {
              if (resData.success && resData.canvas) {
                const rawNodes = resData.canvas.nodes || [];
                const rawEdges = resData.canvas.edges || [];
                setNodes(rawNodes);
                setEdges(updateEdgesClosestHandles(rawNodes, rawEdges));
                setFindings(resData.findings || []);
              }
            });
        }
      })
      .catch((err) => console.error('Failed to load version snapshot', err));
  };

  // Restore past version as active workspace model
  const handleRestoreVersion = (version: string) => {
    if (!confirm(`Are you sure you want to restore workspace to version ${version}? This will replace the active workspace DSL.`)) {
      return;
    }

    fetch(`/api/workspaces/${currentWorkspaceId}/versions/${encodeURIComponent(version)}/load`, {
      method: 'POST',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert(`Restored workspace to version ${version}`);
          setSelectedVersion('current');
          loadStudioData(currentWorkspaceId);
          loadWorkspaces();
        } else {
          alert(`Failed to restore: ${data.detail || 'Unknown error'}`);
        }
      })
      .catch((err) => {
        console.error('Failed to restore version', err);
        alert(`Restore error: ${err.message}`);
      });
  };

  // Open Visual Diff
  const handleOpenDiff = (v1?: string, v2?: string) => {
    const params = new URLSearchParams();
    if (v1) params.append('v1', v1);
    if (v2) params.append('v2', v2);
    const qs = params.toString() ? `?${params.toString()}` : '';

    fetch(`/api/workspaces/${currentWorkspaceId}/diff${qs}`)
      .then((res) => res.json())
      .then((data) => {
        setDiffData(data);
        setIsDiffOpen(true);
      })
      .catch((err) => console.error('Diff error', err));
  };

  // Publish workspace
  const handlePublish = () => {
    const suggested = incrementPatchVersion(workspaceInfo?.version);
    const ver = prompt(`Enter release version (current is v${workspaceInfo?.version || '1.0.0'}):`, suggested);
    if (!ver) return;
    const msg = prompt('Enter publish release notes:', 'Updated architecture components') || '';

    fetch(`/api/workspaces/${currentWorkspaceId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: ver, commitMessage: msg, dsl: dslCode }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert(`Workspace published as v${ver} and systems registered to Enterprise Catalog!`);
          setSelectedVersion('current');
          loadStudioData(currentWorkspaceId);
          loadWorkspaces();
          loadCatalog();
        } else {
          alert(`Publish failed: ${data.detail || 'Unknown error'}`);
        }
      })
      .catch((err) => {
        console.error('Publish error', err);
        alert(`Publish error: ${err.message}`);
      });
  };

  // Create a new architecture workspace
  const handleCreateWorkspace = () => {
    const name = prompt('Enter new workspace name:', 'New Architecture Workspace');
    if (!name) return;
    const desc = prompt('Enter workspace description (optional):', 'Architecture model') || '';

    fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: desc }),
    })
      .then((res) => res.json())
      .then((newWs) => {
        if (newWs && newWs.id) {
          loadWorkspaces();
          setCurrentWorkspaceId(newWs.id);
          setSelectedVersion('current');
        }
      })
      .catch((err) => {
        console.error('Failed to create workspace', err);
        alert(`Failed to create workspace: ${err.message}`);
      });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 select-none">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-3 sm:px-4 z-20 shrink-0 gap-2 min-w-0">
        {/* Left: Branding & Workspace */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <div className="flex items-center gap-2 font-black tracking-tight text-white text-base shrink-0">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Layers className="w-4 h-4 text-white" />
            </span>
            <span className="hidden sm:inline">Open<span className="text-cyan-400">C4</span></span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5 shrink-0" />

          {/* Workspace Selector & New Button */}
          <div className="flex items-center gap-1 shrink-0">
            <select
              value={currentWorkspaceId}
              onChange={(e) => {
                setCurrentWorkspaceId(Number(e.target.value));
                setSelectedVersion('current');
              }}
              className="bg-slate-800 border border-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500 max-w-[130px] sm:max-w-[180px] md:max-w-[220px] truncate shrink-0 cursor-pointer"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id} className="bg-slate-900">
                  {w.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleCreateWorkspace}
              title="Create New Architecture Workspace"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition shrink-0 cursor-pointer flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Status & Version Pill with Interactive Version Dropdown */}
          {workspaceInfo && (
            <div className="relative flex items-center gap-1.5 text-xs shrink-0">
              {/* Version pill / switcher button */}
              <button
                type="button"
                onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                title="Click to browse, view, or restore published versions"
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-750 rounded-full border border-slate-700 px-2.5 py-0.5 text-slate-200 transition cursor-pointer"
              >
                <History className="w-3 h-3 text-cyan-400" />
                <span className="font-mono text-[11px] font-semibold text-slate-200">
                  {selectedVersion === 'current' ? `v${workspaceInfo.version}` : `v${selectedVersion}`}
                </span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isVersionDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* State Badge */}
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  workspaceInfo.state === 'PUBLISHED' && selectedVersion === 'current'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : selectedVersion !== 'current'
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {selectedVersion !== 'current' ? 'SNAPSHOT' : workspaceInfo.state}
              </span>

              {/* Version History Dropdown Menu */}
              {isVersionDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150"
                  onMouseLeave={() => setIsVersionDropdownOpen(false)}
                >
                  <div className="flex items-center justify-between px-2 py-1 text-slate-400 border-b border-slate-800 font-semibold mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Release History ({versions.length})</span>
                    </span>
                    <button
                      onClick={() => setIsVersionDropdownOpen(false)}
                      className="text-slate-500 hover:text-white text-sm"
                    >
                      ×
                    </button>
                  </div>

                  {/* Active Workspace State */}
                  <button
                    onClick={() => {
                      handleLoadVersion('current');
                      setIsVersionDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition mb-1 ${
                      selectedVersion === 'current'
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-medium'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-white">v{workspaceInfo.version}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                        workspaceInfo.state === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {workspaceInfo.state}
                      </span>
                    </div>
                    {selectedVersion === 'current' && <span className="text-[10px] text-blue-400 font-semibold">Active Editor</span>}
                  </button>

                  <div className="my-1 border-t border-slate-800" />

                  {/* Historical Published Snapshots */}
                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">
                    {versions.length === 0 ? (
                      <p className="text-slate-500 text-center py-3 text-[11px]">No published releases yet.</p>
                    ) : (
                      versions.map((ver) => (
                        <div
                          key={ver.id}
                          className={`p-2.5 rounded-lg flex flex-col gap-1 border transition ${
                            selectedVersion === ver.version
                              ? 'bg-purple-600/20 border-purple-500/40 text-purple-200'
                              : 'bg-slate-850/50 border-slate-800 hover:border-slate-750 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-white text-xs">v{ver.version}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(ver.publishedAt).toLocaleString()}
                            </span>
                          </div>
                          {ver.commitMessage && (
                            <p className="text-[11px] text-slate-300 line-clamp-2">{ver.commitMessage}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-800/80">
                            <button
                              onClick={() => {
                                handleLoadVersion(ver.version);
                                setIsVersionDropdownOpen(false);
                              }}
                              className="flex-1 py-1 text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition text-center"
                            >
                              View Snapshot
                            </button>
                            <button
                              onClick={() => {
                                handleRestoreVersion(ver.version);
                                setIsVersionDropdownOpen(false);
                              }}
                              className="flex-1 py-1 text-[10px] font-semibold bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded border border-purple-500/30 transition text-center"
                            >
                              Restore as Active
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center: View Switcher Dropdown (compact & scalable) */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 shrink-0 min-w-0">
          <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-400 shrink-0 hidden lg:inline">View:</span>
          <select
            value={currentViewKey}
            onChange={(e) => handleViewChange(e.target.value)}
            className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[200px] md:max-w-[280px] truncate"
          >
            {availableViews.map((v) => (
              <option key={v.key} value={v.key} className="bg-slate-900 text-white">
                {v.title} ({v.type.replace('system', '')})
              </option>
            ))}
          </select>
        </div>

        {/* Right: Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Inspection findings button */}
          <button
            onClick={() => setIsInspectionOpen(true)}
            title={`Architecture Inspection: ${findings.length} findings`}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
              findings.length > 0
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline">Inspection</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900/60 border border-current font-mono">
              {findings.length}
            </span>
          </button>

          {/* Visual Diff */}
          <button
            onClick={() => handleOpenDiff()}
            title="Visual & Architecture Diff"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition"
          >
            <GitCompare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="hidden lg:inline">Diff</span>
          </button>

          {/* Export */}
          <button
            onClick={() => setIsExportOpen(true)}
            title="Export Diagram (Mermaid, PlantUML, JSON)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden md:inline">Export</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-0.5 shrink-0" />

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            title="Save DSL & Canvas Coordinates"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow shrink-0 ${
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Save className="w-3.5 h-3.5 shrink-0" />}
            <span>{saveSuccess ? 'Saved' : isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          {/* Publish Button */}
          <button
            onClick={handlePublish}
            title="Publish Release Version to Catalog"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md transition shrink-0"
          >
            <UploadCloud className="w-3.5 h-3.5 shrink-0" />
            <span>Publish</span>
          </button>
        </div>
      </header>

      {/* Main Studio Split Layout */}
      <div
        ref={splitContainerRef}
        className={`flex-1 flex overflow-hidden relative ${
          isDragging ? 'select-none cursor-col-resize' : ''
        }`}
      >
        {/* Left Pane: Tabs for DSL Editor and Enterprise Catalog */}
        <div
          style={{ width: `${dslWidth}%` }}
          className="flex flex-col bg-slate-950 shrink-0 min-w-[240px] border-r border-slate-800/80"
        >
          <div className="px-3 py-1.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400 gap-2">
            {/* Panel Tabs */}
            <div className="flex items-center gap-1 shrink-0 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setLeftPanelTab('dsl')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition font-semibold text-xs ${
                  leftPanelTab === 'dsl'
                    ? 'bg-slate-800 text-cyan-300 shadow-xs border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>DSL Code</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLeftPanelTab('catalog');
                  loadCatalog();
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition font-semibold text-xs ${
                  leftPanelTab === 'catalog'
                    ? 'bg-slate-800 text-blue-300 shadow-xs border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Server className="w-3.5 h-3.5 text-blue-400" />
                <span>Catalog</span>
                {catalog.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-mono">
                    {catalog.length}
                  </span>
                )}
              </button>
            </div>

            {/* Width Controls & Maximize */}
            <div className="flex items-center gap-2 overflow-hidden">
              {leftPanelTab === 'dsl' && (
                <>
                  <span className="text-[11px] text-slate-500 hidden xl:inline">Live Auto-Compile Active</span>
                  <div className="h-3 w-px bg-slate-800 hidden xl:inline" />
                </>
              )}

              {/* Quick Preset Width Controls */}
              <div className="flex items-center gap-0.5 bg-slate-800/80 rounded-md p-0.5 border border-slate-700/50 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setDslWidth(35);
                    setIsMaximized(false);
                  }}
                  className={`px-1.5 py-0.5 rounded transition font-medium ${
                    Math.round(dslWidth) === 35 && !isMaximized
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Compact panel (35% width)"
                >
                  35%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDslWidth(50);
                    setIsMaximized(false);
                  }}
                  className={`px-1.5 py-0.5 rounded transition font-medium ${
                    Math.round(dslWidth) === 50 && !isMaximized
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Half split (50% width)"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDslWidth(70);
                    setIsMaximized(false);
                  }}
                  className={`px-1.5 py-0.5 rounded transition font-medium ${
                    Math.round(dslWidth) === 70 && !isMaximized
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Wide panel (70% width)"
                >
                  70%
                </button>
              </div>

              {/* Maximize / Restore Toggle */}
              <button
                type="button"
                onClick={toggleMaximize}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
                title={isMaximized ? "Restore default split layout" : "Expand panel (80% width)"}
              >
                {isMaximized ? (
                  <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* DSL Editor Tab View (kept mounted to preserve state/undo history) */}
          <div className={`flex-1 flex flex-col overflow-hidden ${leftPanelTab === 'dsl' ? '' : 'hidden'}`}>
            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                language="structurizr"
                theme="vs-dark"
                value={dslCode}
                onChange={handleEditorChange}
                beforeMount={registerStructurizrDsl}
                options={{
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                }}
              />
            </div>

            {/* Error Squiggle Footer */}
            {parseError && (
              <div className="px-4 py-2.5 bg-rose-950/80 border-t border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-mono text-rose-300">
                  [Line {parseError.line}, Col {parseError.column}]
                </span>
                <span>{parseError.message}</span>
              </div>
            )}
          </div>

          {/* Catalog Tab View */}
          {leftPanelTab === 'catalog' && (
            <CatalogTab
              catalog={catalog}
              onRefresh={loadCatalog}
              onInsertDsl={handleInsertDsl}
            />
          )}
        </div>

        {/* Resizable Divider Handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDoubleClick={() => {
            setDslWidth(50);
            setIsMaximized(false);
          }}
          title="Drag to resize DSL editor. Double-click to reset to 50%."
          className={`relative flex items-center justify-center w-2 cursor-col-resize select-none transition-colors group z-20 shrink-0 ${
            isDragging ? 'bg-blue-500' : 'bg-slate-800 hover:bg-blue-500/80'
          }`}
        >
          {/* Expanded hit area */}
          <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize" />
          <div className="flex flex-col gap-1 items-center justify-center pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
            <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white" />
            <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white" />
            <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white" />
          </div>
        </div>

        {/* Global drag overlay to prevent Monaco and ReactFlow from swallowing mouse events */}
        {isDragging && (
          <div className="fixed inset-0 z-50 cursor-col-resize select-none" />
        )}

        {/* Right Pane: Interactive React Flow Canvas */}
        <div className="flex-1 flex flex-col relative bg-[#0b1120] min-w-[240px] overflow-hidden">
          {/* View Toolbar */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
            <span className="text-xs font-semibold px-2 text-slate-300">
              {currentViewKey}
            </span>
            <div className="h-3.5 w-px bg-slate-700" />
            <button
              onClick={() => handleAutoLayout('TB')}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition font-medium"
            >
              Auto-Layout (TB)
            </button>
            <button
              onClick={() => handleAutoLayout('LR')}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition font-medium"
            >
              Auto-Layout (LR)
            </button>

            {/* Delete button when nodes or edges are selected */}
            {(nodes.some((n) => n.selected) || edges.some((e) => e.selected)) && (
              <>
                <div className="h-3.5 w-px bg-slate-700" />
                <button
                  onClick={() =>
                    requestDelete(
                      nodes.filter((n) => n.selected),
                      edges.filter((e) => e.selected)
                    )
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg transition font-medium"
                  title="Delete selected item(s) (Del / Backspace)"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    Delete (
                    {nodes.filter((n) => n.selected).length +
                      edges.filter((e) => e.selected).length}
                    )
                  </span>
                </button>
              </>
            )}
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onBeforeDelete={onBeforeDelete}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
            className="c4-canvas"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
            <Controls
              position="bottom-left"
              showInteractive={false}
              className="!bg-slate-950 !border-slate-800"
            />
            <MiniMap
              nodeColor={(n: any) => n.data?.backgroundColor || '#1168bd'}
              className="!bg-slate-950 !border-slate-800 rounded-xl"
            />
            <Panel
              position="bottom-center"
              className="text-[11px] text-slate-400 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 shadow-lg"
            >
              Tip: Double-click a Software System or Container to drill down
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* Modals & Drawers */}
      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => {
          setIsConfirmDeleteOpen(false);
          setPendingDeleteNodes([]);
          setPendingDeleteEdges([]);
        }}
        onConfirm={handleConfirmDelete}
        nodesToDelete={pendingDeleteNodes}
        edgesToDelete={pendingDeleteEdges}
        isDeleting={isDeleting}
      />

      <VisualDiffModal
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        diff={diffData}
        baseVersion={diffData?.baseVersion || `v${workspaceInfo?.version || '1.0.0'}`}
        targetVersion={diffData?.targetVersion || (workspaceInfo?.state === 'PUBLISHED' ? `Published (v${workspaceInfo?.version})` : 'Current Draft')}
        availableVersions={diffData?.availableVersions || versions.map((v) => v.version)}
        onVersionChange={(v1, v2) => handleOpenDiff(v1, v2)}
      />

      <InspectionDrawer
        isOpen={isInspectionOpen}
        onClose={() => setIsInspectionOpen(false)}
        findings={findings}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        workspaceId={currentWorkspaceId}
        currentViewKey={currentViewKey}
      />
    </div>
  );
}

export default App;
