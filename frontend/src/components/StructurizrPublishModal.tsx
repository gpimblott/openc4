import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  UploadCloud,
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Play,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Key,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface StructurizrPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  dslCode: string;
  files: Record<string, string>;
  entryPoint: string;
  activeFile: string;
  currentWorkspaceId?: number | null;
  currentWorkspaceName?: string | null;
}

export const StructurizrPublishModal: React.FC<StructurizrPublishModalProps> = ({
  isOpen,
  onClose,
  dslCode,
  files,
  entryPoint,
  activeFile,
  currentWorkspaceId,
  currentWorkspaceName
}) => {
  const { authFetch } = useAuth();

  // Settings with localStorage persistence
  const [serverUrl, setServerUrl] = useState<string>(() => {
    return (
      localStorage.getItem('openc4_structurizr_url') ||
      localStorage.getItem('openc4_mcp_server_url') ||
      'http://localhost:8080'
    );
  });

  const [workspaceId, setWorkspaceId] = useState<number>(() => {
    if (serverUrl.includes(':8080')) {
      return 1;
    }
    if (currentWorkspaceId && currentWorkspaceId > 0) {
      return currentWorkspaceId;
    }
    const saved = localStorage.getItem('openc4_structurizr_ws_id');
    return saved ? parseInt(saved, 10) || 1 : 1;
  });

  // Keep target workspaceId in sync: for Structurizr Lite (:8080) default to 1, otherwise match OpenC4 workspace
  useEffect(() => {
    if (isOpen) {
      if (serverUrl.includes(':8080')) {
        setWorkspaceId(1);
      } else if (currentWorkspaceId && currentWorkspaceId > 0) {
        setWorkspaceId(currentWorkspaceId);
      }
    }
  }, [isOpen, currentWorkspaceId, serverUrl]);

  const [mode, setMode] = useState<'auto' | 'rest' | 'mcp'>(() => {
    return (localStorage.getItem('openc4_structurizr_mode') as any) || 'auto';
  });

  const [scope, setScope] = useState<'workspace' | 'file'>('workspace');
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('openc4_structurizr_api_key') || '';
  });

  const [showAuthSettings, setShowAuthSettings] = useState<boolean>(false);

  // Connection test state
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    connected: boolean;
    mode?: 'rest' | 'mcp' | 'unknown';
    workspaceName?: string;
    tools?: string[];
    publishTool?: string;
    error?: string;
  } | null>(null);

  // Publish execution state
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishResult, setPublishResult] = useState<{
    tested: boolean;
    success: boolean;
    mode?: 'rest' | 'mcp';
    workspaceId?: number;
    durationMs?: number;
    workspaceName?: string;
    elementCount?: number;
    relationshipCount?: number;
    viewCount?: number;
    openUrl?: string;
    toolUsed?: string;
    serverUrl?: string;
    error?: {
      message: string;
      line?: number;
      column?: number;
      file?: string;
    } | null;
    raw?: any;
  } | null>(null);

  const [isRawExpanded, setIsRawExpanded] = useState<boolean>(false);
  const [rawCopied, setRawCopied] = useState<boolean>(false);

  // Handlers for settings updates
  const handleServerUrlChange = (newUrl: string) => {
    setServerUrl(newUrl);
    localStorage.setItem('openc4_structurizr_url', newUrl);
    setConnectionStatus(null);
    if (newUrl.includes(':8080')) {
      setWorkspaceId(1);
    } else if (currentWorkspaceId && currentWorkspaceId > 0) {
      setWorkspaceId(currentWorkspaceId);
    }
  };

  const handleWorkspaceIdChange = (newId: number) => {
    setWorkspaceId(newId);
    localStorage.setItem('openc4_structurizr_ws_id', String(newId));
  };

  const handleModeChange = (newMode: 'auto' | 'rest' | 'mcp') => {
    setMode(newMode);
    localStorage.setItem('openc4_structurizr_mode', newMode);
  };

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('openc4_structurizr_api_key', newKey);
  };

  // Test connection to Structurizr instance
  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    try {
      const res = await authFetch('/api/structurizr/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl,
          workspaceId,
          apiKey: apiKey.trim() || undefined
        })
      });
      const data = await res.json();
      setConnectionStatus({
        tested: true,
        connected: Boolean(data.connected),
        mode: data.mode,
        workspaceName: data.workspaceName,
        tools: data.tools,
        publishTool: data.publishTool,
        error: data.error
      });
    } catch (err: any) {
      setConnectionStatus({
        tested: true,
        connected: false,
        error: err.message || 'Failed to connect to Structurizr'
      });
    } finally {
      setIsTesting(false);
    }
  }, [authFetch, serverUrl, workspaceId, apiKey]);

  // Execute workspace publishing
  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    try {
      const payload: Record<string, any> = {
        serverUrl,
        workspaceId,
        currentWorkspaceId: currentWorkspaceId || undefined,
        currentWorkspaceName: currentWorkspaceName || undefined,
        apiKey: apiKey.trim() || undefined,
        scope,
        mode,
        entryPoint,
        activeFile
      };

      if (scope === 'workspace') {
        payload.files = files;
        payload.dsl = files[entryPoint] || dslCode;
      } else {
        payload.dsl = files[activeFile] || dslCode;
      }

      const res = await authFetch('/api/structurizr/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setPublishResult({
        tested: true,
        success: Boolean(data.success),
        mode: data.mode,
        workspaceId: data.workspaceId,
        durationMs: data.durationMs,
        workspaceName: data.workspaceName,
        elementCount: data.elementCount,
        relationshipCount: data.relationshipCount,
        viewCount: data.viewCount,
        openUrl: data.openUrl,
        toolUsed: data.toolUsed,
        serverUrl: data.serverUrl,
        error: data.error,
        raw: data.raw
      });
    } catch (err: any) {
      setPublishResult({
        tested: true,
        success: false,
        error: {
          message: err.message || 'Publish request failed unexpectedly'
        }
      });
    } finally {
      setIsPublishing(false);
    }
  }, [authFetch, serverUrl, workspaceId, apiKey, scope, mode, entryPoint, activeFile, files, dslCode, currentWorkspaceId, currentWorkspaceName]);

  // Keyboard shortcut: Cmd/Ctrl + Enter to trigger publish
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handlePublish();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePublish, onClose]);

  // Copy raw output
  const handleCopyRaw = () => {
    if (!publishResult?.raw) return;
    navigator.clipboard.writeText(JSON.stringify(publishResult.raw, null, 2));
    setRawCopied(true);
    setTimeout(() => setRawCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/30">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Publish to Structurizr</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-700/60">
                  REST / MCP
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Publish current DSL architecture directly to a local Structurizr instance (Playground, Lite, or MCP)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active OpenC4 Workspace Banner */}
        <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Active OpenC4 Model:</span>
            <span className="font-bold text-white bg-purple-950/60 text-purple-200 border border-purple-800/60 px-2 py-0.5 rounded flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              {currentWorkspaceName || `Workspace ${currentWorkspaceId || 1}`}
            </span>
            {currentWorkspaceId && (
              <span className="font-mono text-slate-400 text-[11px]">
                (OpenC4 ID: {currentWorkspaceId})
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Targeting Structurizr Server (Workspace ID: {workspaceId})</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Server Location Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-purple-400" />
                Structurizr Server Location
              </label>
              <div className="flex items-center gap-2">
                {/* Presets */}
                <button
                  type="button"
                  onClick={() => handleServerUrlChange('http://localhost:8080')}
                  className="text-[11px] text-purple-400 hover:text-purple-300 underline font-medium cursor-pointer"
                >
                  Structurizr (:8080)
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => handleServerUrlChange('http://localhost:8080/mcp')}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline font-medium cursor-pointer"
                >
                  MCP (:8080/mcp)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => handleServerUrlChange(e.target.value)}
                placeholder="http://localhost:8080"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !serverUrl.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 disabled:opacity-50 transition shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-purple-400' : 'text-slate-400'}`} />
                <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>

            {/* Connection Test Badge */}
            {connectionStatus && (
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                  connectionStatus.connected
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {connectionStatus.connected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span className="font-semibold">
                    {connectionStatus.connected
                      ? `Connected to Structurizr via ${connectionStatus.mode === 'mcp' ? 'MCP Protocol' : 'REST Web API'}${
                          connectionStatus.workspaceName ? ` (${connectionStatus.workspaceName})` : ''
                        }`
                      : 'Connection Failed'}
                  </span>
                  {!connectionStatus.connected && connectionStatus.error && (
                    <span className="text-rose-400/80 truncate text-[11px]">— {connectionStatus.error}</span>
                  )}
                </div>
                {connectionStatus.connected && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-200 shrink-0">
                    Ready
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Configuration Grid: Workspace ID & Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300">
                  Target Workspace ID
                </label>
                {currentWorkspaceId && currentWorkspaceId !== workspaceId && (
                  <button
                    type="button"
                    onClick={() => handleWorkspaceIdChange(currentWorkspaceId)}
                    className="text-[10px] text-purple-400 hover:text-purple-300 underline font-medium cursor-pointer"
                  >
                    Match OpenC4 ID ({currentWorkspaceId})
                  </button>
                )}
              </div>
              <input
                type="number"
                min="1"
                value={workspaceId}
                onChange={(e) => handleWorkspaceIdChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
              />
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500">Quick set:</span>
                <button
                  type="button"
                  onClick={() => handleWorkspaceIdChange(1)}
                  className={`text-[10px] px-2 py-0.5 rounded-md border transition cursor-pointer ${
                    workspaceId === 1
                      ? 'bg-purple-900/50 border-purple-500/80 text-purple-200 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Lite / Local (1)
                </button>
                {currentWorkspaceId && currentWorkspaceId !== 1 && (
                  <button
                    type="button"
                    onClick={() => handleWorkspaceIdChange(currentWorkspaceId)}
                    className={`text-[10px] px-2 py-0.5 rounded-md border transition cursor-pointer ${
                      workspaceId === currentWorkspaceId
                        ? 'bg-purple-900/50 border-purple-500/80 text-purple-200 font-bold'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    OpenC4 ID ({currentWorkspaceId})
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {serverUrl.includes(':8080')
                  ? 'Structurizr Lite only supports Workspace ID 1. Your active model will be published to Workspace 1.'
                  : 'Structurizr Lite requires ID 1. Structurizr on-premise servers support any ID.'}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Protocol Mode
              </label>
              <select
                value={mode}
                onChange={(e) => handleModeChange(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 cursor-pointer"
              >
                <option value="auto">Auto-Detect (REST or MCP)</option>
                <option value="rest">Structurizr Web API (HTTP REST PUT)</option>
                <option value="mcp">Structurizr MCP Tool (updateWorkspace)</option>
              </select>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Automatic selection based on endpoint format
              </span>
            </div>
          </div>

          {/* Publish Scope Selection */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-300">Publish Scope</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('workspace')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col cursor-pointer ${
                  scope === 'workspace'
                    ? 'bg-purple-950/40 border-purple-500/60 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="font-bold text-xs flex items-center justify-between">
                  Entire Workspace
                  {scope === 'workspace' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Preprocesses and bundles all <code className="text-purple-300">!include</code> files ({Object.keys(files).length} files)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('file')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col cursor-pointer ${
                  scope === 'file'
                    ? 'bg-purple-950/40 border-purple-500/60 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="font-bold text-xs flex items-center justify-between">
                  Active File Only
                  {scope === 'file' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Publishes only <code className="text-purple-300">{activeFile}</code>
                </span>
              </button>
            </div>
          </div>

          {/* Collapsible Authentication Section */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
            <button
              type="button"
              onClick={() => setShowAuthSettings(!showAuthSettings)}
              className="w-full flex items-center justify-between p-3 text-xs font-semibold text-slate-300 hover:bg-slate-800/40 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>Authentication & API Keys</span>
                {apiKey ? (
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                    Configured
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-normal">
                    (Optional for local Playground & Lite)
                  </span>
                )}
              </div>
              {showAuthSettings ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showAuthSettings && (
              <div className="p-3 pt-1 space-y-2 border-t border-slate-800/60">
                <label className="text-[11px] text-slate-400 block">
                  API Key / Secret (X-Authorization header)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="Leave blank if using local Structurizr Playground or Lite"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 placeholder:text-slate-600"
                />
                <p className="text-[10px] text-slate-500">
                  Only required if your Structurizr On-Premises or Cloud workspace is secured with an API key.
                </p>
              </div>
            )}
          </div>

          {/* Publish Trigger Button */}
          <div>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing || !serverUrl.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950/50 disabled:opacity-50 transition cursor-pointer"
            >
              {isPublishing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Publishing Architecture to Structurizr...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Publish Workspace to Structurizr</span>
                  <span className="text-[10px] text-purple-200 font-normal ml-1.5 opacity-80">(Ctrl + Enter)</span>
                </>
              )}
            </button>
          </div>

          {/* Results Display Section */}
          {publishResult && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300">Publish Results</span>

              {publishResult.success ? (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-700/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>Workspace Successfully Published!</span>
                    </div>
                    {publishResult.durationMs !== undefined && (
                      <span className="text-[11px] text-emerald-300/80 font-mono">
                        Latency: {publishResult.durationMs}ms
                      </span>
                    )}
                  </div>

                  {/* Architecture Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Workspace</span>
                      <span className="font-bold text-white text-xs truncate block">
                        {publishResult.workspaceName || `Workspace ${publishResult.workspaceId}`}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Elements</span>
                      <span className="font-bold text-purple-400 text-xs font-mono">
                        {publishResult.elementCount ?? '—'}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Relationships</span>
                      <span className="font-bold text-cyan-400 text-xs font-mono">
                        {publishResult.relationshipCount ?? '—'}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Views</span>
                      <span className="font-bold text-blue-400 text-xs font-mono">
                        {publishResult.viewCount ?? '—'}
                      </span>
                    </div>
                  </div>

                  {/* Open in Structurizr Button & Target URL */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-emerald-800/40">
                    <div className="text-[11px] text-emerald-300/90 truncate">
                      Target: <code className="font-mono text-white">{publishResult.serverUrl}</code>
                    </div>

                    {publishResult.openUrl && (
                      <a
                        href={publishResult.openUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
                      >
                        <span>
                          {publishResult.serverUrl?.includes(':8000')
                            ? 'Open in Visual Studio'
                            : `Open Diagrams (ID: ${publishResult.workspaceId})`}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                /* Publish Error State */
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-700/50 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>Failed to Publish Workspace</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-lg border border-rose-800/40 font-mono text-xs text-rose-300">
                    {publishResult.error?.message || 'Unknown error occurred while publishing to Structurizr.'}
                    {publishResult.error?.line && (
                      <div className="mt-1 text-slate-400">
                        Line: {publishResult.error.line}, Column: {publishResult.error.column || 1}
                        {publishResult.error.file && ` in ${publishResult.error.file}`}
                      </div>
                    )}
                  </div>

                  {/* Troubleshooting Advice */}
                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1.5 text-slate-300 text-[11px]">
                    <span className="font-bold flex items-center gap-1 text-slate-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                      Troubleshooting Tips:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                      <li>
                        Ensure your Structurizr Docker container is running (e.g. <code className="text-purple-300 font-mono">docker compose up structurizr</code> on port 8080).
                      </li>
                      <li>
                        Test connection using the <span className="font-semibold text-white">Test Connection</span> button above.
                      </li>
                      <li>
                        If connecting to Structurizr on-premises, check if an API key is required in the Authentication section.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Raw Response Toggle */}
              {publishResult.raw && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => setIsRawExpanded(!isRawExpanded)}
                    className="w-full flex items-center justify-between p-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <span className="font-semibold">Raw Server Response</span>
                    {isRawExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  {isRawExpanded && (
                    <div className="relative border-t border-slate-800 p-3 bg-slate-950 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={handleCopyRaw}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                        title="Copy raw JSON response"
                      >
                        {rawCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <pre className="whitespace-pre-wrap break-all">
                        {typeof publishResult.raw === 'string'
                          ? publishResult.raw
                          : JSON.stringify(publishResult.raw, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 text-xs">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <span>Local Structurizr Interoperability</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
