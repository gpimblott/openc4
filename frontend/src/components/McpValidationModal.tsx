import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Cpu,
  Server,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Code
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface McpValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  dslCode: string;
  files: Record<string, string>;
  entryPoint: string;
  activeFile: string;
  onApplyError: (err: { message: string; line: number; column: number; file?: string } | null) => void;
  onJumpToError: (file: string, line: number, column: number) => void;
}

export const McpValidationModal: React.FC<McpValidationModalProps> = ({
  isOpen,
  onClose,
  dslCode,
  files,
  entryPoint,
  activeFile,
  onApplyError,
  onJumpToError,
}) => {
  const { authFetch } = useAuth();

  // Server URL configuration with localStorage persistence
  const [serverUrl, setServerUrl] = useState<string>(() => {
    return localStorage.getItem('openc4_mcp_server_url') || 'http://localhost:8000/mcp';
  });

  const [scope, setScope] = useState<'workspace' | 'file'>('workspace');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    connected: boolean;
    tools?: string[];
    validationTool?: string;
    error?: string;
  } | null>(null);

  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{
    tested: boolean;
    valid: boolean;
    durationMs?: number;
    workspaceName?: string;
    elementCount?: number;
    relationshipCount?: number;
    viewCount?: number;
    toolUsed?: string;
    serverUrl?: string;
    error?: {
      message: string;
      line: number;
      column: number;
      file?: string;
    } | null;
    raw?: any;
  } | null>(null);

  const [isRawExpanded, setIsRawExpanded] = useState<boolean>(false);
  const [rawCopied, setRawCopied] = useState<boolean>(false);

  // Save serverUrl when changed
  const handleServerUrlChange = (newUrl: string) => {
    setServerUrl(newUrl);
    localStorage.setItem('openc4_mcp_server_url', newUrl);
    // Reset test state when URL changes
    setConnectionStatus(null);
  };

  // Test connection to MCP server
  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    try {
      const res = await authFetch('/api/mcp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl })
      });
      const data = await res.json();
      setConnectionStatus({
        tested: true,
        connected: Boolean(data.connected),
        tools: data.tools?.map((t: any) => t.name) || [],
        validationTool: data.validationTool,
        error: data.error
      });
    } catch (err: any) {
      setConnectionStatus({
        tested: true,
        connected: false,
        error: err.message || 'Failed to connect to MCP server'
      });
    } finally {
      setIsTesting(false);
    }
  }, [authFetch, serverUrl]);

  // Trigger DSL Validation
  const handleValidate = useCallback(async () => {
    setIsValidating(true);
    try {
      const payload: any = {
        serverUrl,
        scope,
        entryPoint,
        activeFile,
        files,
        dsl: scope === 'file' ? (files[activeFile] ?? dslCode) : undefined
      };

      const res = await authFetch('/api/mcp/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      setValidationResult({
        tested: true,
        valid: Boolean(data.valid),
        durationMs: data.durationMs,
        workspaceName: data.workspaceName,
        elementCount: data.elementCount,
        relationshipCount: data.relationshipCount,
        viewCount: data.viewCount,
        toolUsed: data.toolUsed,
        serverUrl: data.serverUrl,
        error: data.error,
        raw: data.raw || data
      });

      if (data.valid) {
        onApplyError(null);
      } else if (data.error) {
        onApplyError(data.error);
      }
    } catch (err: any) {
      const errorObj = {
        message: err.message || 'Validation request failed',
        line: 1,
        column: 1,
        file: activeFile
      };
      setValidationResult({
        tested: true,
        valid: false,
        error: errorObj,
        raw: { error: err.message }
      });
      onApplyError(errorObj);
    } finally {
      setIsValidating(false);
    }
  }, [activeFile, authFetch, dslCode, entryPoint, files, onApplyError, scope, serverUrl]);

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to run validation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleValidate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleValidate]);

  if (!isOpen) return null;

  // Extract snippet lines for error preview
  const getErrorSnippet = () => {
    if (!validationResult?.error) return null;
    const targetFile = validationResult.error.file || activeFile;
    const sourceContent = files[targetFile] ?? dslCode;
    if (!sourceContent) return null;

    const allLines = sourceContent.split(/\r?\n/);
    const errLine = validationResult.error.line;
    const start = Math.max(0, errLine - 3);
    const end = Math.min(allLines.length, errLine + 2);

    return {
      file: targetFile,
      lines: allLines.slice(start, end).map((content, idx) => ({
        lineNum: start + idx + 1,
        content,
        isError: start + idx + 1 === errLine
      }))
    };
  };

  const errorSnippet = getErrorSnippet();

  const handleCopyRaw = () => {
    if (!validationResult?.raw) return;
    navigator.clipboard.writeText(JSON.stringify(validationResult.raw, null, 2));
    setRawCopied(true);
    setTimeout(() => setRawCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Validate with Structurizr MCP Server</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                  JSON-RPC 2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Specify your running local Structurizr MCP server and trigger on-demand model validation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Server Location Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                MCP Server Location
              </label>
              <div className="flex items-center gap-2">
                {/* Presets */}
                <button
                  type="button"
                  onClick={() => handleServerUrlChange('http://localhost:8000/mcp')}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer"
                >
                  OpenC4 (:8000)
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => handleServerUrlChange('http://localhost:8080/mcp')}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline font-medium cursor-pointer"
                >
                  Structurizr (:8080)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => handleServerUrlChange(e.target.value)}
                placeholder="http://localhost:8000/mcp"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !serverUrl.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 disabled:opacity-50 transition shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
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
                      ? `Connected to MCP Server (${connectionStatus.validationTool || 'validate_dsl'} available)`
                      : 'Connection Failed'}
                  </span>
                  {!connectionStatus.connected && connectionStatus.error && (
                    <span className="text-rose-400/80 truncate text-[11px]">— {connectionStatus.error}</span>
                  )}
                </div>
                {connectionStatus.connected && connectionStatus.tools && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-200 shrink-0">
                    {connectionStatus.tools.length} tools detected
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Validation Scope Selection */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-300">Validation Scope</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('workspace')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col cursor-pointer ${
                  scope === 'workspace'
                    ? 'bg-cyan-950/40 border-cyan-500/60 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="font-bold text-xs flex items-center justify-between">
                  Entire Workspace
                  {scope === 'workspace' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Preprocesses and resolves all <code className="text-cyan-300">!include</code> files ({Object.keys(files).length} files)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('file')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col cursor-pointer ${
                  scope === 'file'
                    ? 'bg-cyan-950/40 border-cyan-500/60 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="font-bold text-xs flex items-center justify-between">
                  Active File Only
                  {scope === 'file' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Validates only <code className="text-cyan-300">{activeFile}</code>
                </span>
              </button>
            </div>
          </div>

          {/* Trigger Validation Action Button */}
          <div>
            <button
              type="button"
              onClick={handleValidate}
              disabled={isValidating || !serverUrl.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/50 disabled:opacity-50 transition cursor-pointer"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating DSL via MCP Server...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Trigger Validation</span>
                  <span className="text-[10px] text-cyan-200 font-normal ml-1.5 opacity-80">(Ctrl + Enter)</span>
                </>
              )}
            </button>
          </div>

          {/* Results Display Section */}
          {validationResult && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300">Validation Results</span>

              {validationResult.valid ? (
                /* Valid DSL State */
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-700/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>Structurizr DSL is Valid!</span>
                    </div>
                    {validationResult.durationMs !== undefined && (
                      <span className="text-[11px] text-emerald-300/80 font-mono">
                        Latency: {validationResult.durationMs}ms
                      </span>
                    )}
                  </div>

                  {/* Architecture Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Workspace</span>
                      <span className="font-bold text-white text-xs truncate block">
                        {validationResult.workspaceName || 'C4 Model'}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Elements</span>
                      <span className="font-bold text-cyan-400 text-xs font-mono">
                        {validationResult.elementCount ?? '—'}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Relationships</span>
                      <span className="font-bold text-purple-400 text-xs font-mono">
                        {validationResult.relationshipCount ?? '—'}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Views</span>
                      <span className="font-bold text-blue-400 text-xs font-mono">
                        {validationResult.viewCount ?? '—'}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-emerald-300/90 flex items-center justify-between pt-1">
                    <span>
                      Validated via MCP tool: <code className="font-mono">{validationResult.toolUsed || 'validate_dsl'}</code>
                    </span>
                    <span className="text-slate-400 font-mono text-[10px] truncate max-w-[200px]">
                      {validationResult.serverUrl}
                    </span>
                  </div>
                </div>
              ) : (
                /* Invalid DSL State */
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                      <span>DSL Validation Error Detected</span>
                    </div>
                    {validationResult.error && (
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-rose-900/60 text-rose-200 border border-rose-700/60">
                        {validationResult.error.file ? `${validationResult.error.file}:` : ''}Line {validationResult.error.line}, Col {validationResult.error.column}
                      </span>
                    )}
                  </div>

                  {/* Error Message */}
                  <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-200 font-mono text-xs">
                    {validationResult.error?.message || 'Unknown parsing or syntax error in DSL'}
                  </div>

                  {/* Code snippet preview */}
                  {errorSnippet && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Source Context ({errorSnippet.file})
                      </span>
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] overflow-x-auto space-y-0.5">
                        {errorSnippet.lines.map((l) => (
                          <div
                            key={l.lineNum}
                            className={`flex items-center gap-3 px-1.5 py-0.5 rounded ${
                              l.isError ? 'bg-rose-950/80 text-rose-300 font-bold' : 'text-slate-400'
                            }`}
                          >
                            <span className="w-6 text-right select-none text-slate-600 shrink-0">
                              {l.lineNum}
                            </span>
                            <span className="whitespace-pre truncate">{l.content}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Jump to error button */}
                  {validationResult.error && (
                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const file = validationResult.error?.file || activeFile;
                          const line = validationResult.error?.line || 1;
                          const col = validationResult.error?.column || 1;
                          onJumpToError(file, line, col);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow transition cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Jump to Error in Editor</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Raw JSON-RPC Response Collapsible */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setIsRawExpanded(!isRawExpanded)}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition bg-slate-900/40 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    {isRawExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <Code className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Raw MCP JSON-RPC Payload</span>
                  </div>
                  {isRawExpanded && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyRaw();
                      }}
                      className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-normal"
                    >
                      {rawCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{rawCopied ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  )}
                </button>

                {isRawExpanded && (
                  <div className="p-3 bg-slate-950 border-t border-slate-800 max-h-52 overflow-y-auto">
                    <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all">
                      {JSON.stringify(validationResult.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Compatible with Structurizr MCP & OpenC4 JSON-RPC</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
