import React, { useState } from 'react';
import { UploadCloud, X, Sparkles, Tag, FileText, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentVersion?: string;
  onPublish: (version: string, commitMessage: string) => Promise<boolean>;
}

export const PublishVersionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentVersion = '1.0.0',
  onPublish,
}) => {
  // Compute standard semver bumps
  const getBumps = (baseVer: string) => {
    const clean = baseVer.replace(/^v/, '');
    const parts = clean.split('.').map((p) => parseInt(p, 10));
    const major = isNaN(parts[0]) ? 1 : parts[0];
    const minor = isNaN(parts[1]) ? 0 : parts[1];
    const patch = isNaN(parts[2]) ? 0 : parts[2];

    return {
      patch: `${major}.${minor}.${patch + 1}`,
      minor: `${major}.${minor + 1}.0`,
      major: `${major + 1}.0.0`,
    };
  };

  const bumps = getBumps(currentVersion);
  const [version, setVersion] = useState(bumps.patch);
  const [commitMessage, setCommitMessage] = useState('Updated architecture components');
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedVer = version.trim().replace(/^v/, '');
    if (!trimmedVer) {
      setError('Please provide a valid release version number.');
      return;
    }

    setError(null);
    setIsPublishing(true);
    try {
      const success = await onPublish(trimmedVer, commitMessage.trim());
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to publish workspace release.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPublishing) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Publish Release</h3>
              <p className="text-xs text-slate-400">
                Create an immutable version snapshot and register systems with the catalog.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPublishing}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Release Version Input & Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-400" />
                <span>Release Version</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                Current: <strong className="text-slate-300">v{currentVersion}</strong>
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs select-none">
                v
              </span>
              <input
                type="text"
                required
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.1"
                disabled={isPublishing}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500 transition disabled:opacity-50"
              />
            </div>

            {/* Semver Quick Suggestions */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Bump:
              </span>
              {[
                { label: `Patch (v${bumps.patch})`, val: bumps.patch },
                { label: `Minor (v${bumps.minor})`, val: bumps.minor },
                { label: `Major (v${bumps.major})`, val: bumps.major },
              ].map((b) => (
                <button
                  key={b.val}
                  type="button"
                  onClick={() => setVersion(b.val)}
                  disabled={isPublishing}
                  className={`px-2 py-0.5 text-[11px] font-mono rounded-md border transition ${
                    version === b.val
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200 font-semibold'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Release Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              <span>Release Notes / Changelog</span>
            </label>
            <textarea
              rows={3}
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="e.g. Added payment gateway container, updated database relationships..."
              disabled={isPublishing}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 transition resize-none disabled:opacity-50 leading-relaxed"
            />
            <p className="text-[11px] text-slate-400">
              Notes are recorded in release history and displayed during visual diff comparisons.
            </p>
          </div>

          {/* Publishing Info Callout */}
          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/40 text-purple-200 text-xs flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-purple-300 block">Enterprise Catalog Registration</span>
              <span className="text-purple-300/80 leading-relaxed text-[11px] block">
                Publishing saves current DSL code, locks an immutable version snapshot, and registers all defined software systems for cross-workspace catalog discovery.
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPublishing}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPublishing || !version.trim()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg transition shadow-lg shadow-purple-600/25 disabled:opacity-50 cursor-pointer"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Publish Release</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
