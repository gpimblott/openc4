import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, FolderPlus, Layers, FileCode, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, template: 'context' | 'blank') => Promise<boolean>;
}

export const CreateWorkspaceModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('New Architecture Workspace');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<'context' | 'blank'>('context');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Workspace name is required.');
      return;
    }

    setError(null);
    setIsCreating(true);
    try {
      const success = await onCreate(trimmedName, description.trim(), template);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create workspace.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCreating) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Create New Workspace</h3>
              <p className="text-xs text-slate-400">
                Initialize an architecture workspace with Structurizr DSL and visual views.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isCreating}
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

          {/* Workspace Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Workspace Name *</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. E-Commerce Platform"
              disabled={isCreating}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
            />
          </div>

          {/* Workspace Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Description</span>
              <span className="text-[10px] text-slate-400 uppercase">Optional</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Microservices and data pipeline architecture model"
              disabled={isCreating}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 transition resize-none disabled:opacity-50 leading-relaxed"
            />
          </div>

          {/* Starter Template */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Starter Template
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTemplate('context')}
                disabled={isCreating}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  template === 'context'
                    ? 'bg-blue-600/15 border-blue-500/60 ring-1 ring-blue-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Layers className={`w-3.5 h-3.5 ${template === 'context' ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span className={`text-xs font-semibold ${template === 'context' ? 'text-white' : 'text-slate-300'}`}>
                      System Context
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Initializes a user, software system, and SystemContext view diagram.
                  </p>
                </div>
                <span className="mt-2 text-[10px] font-bold text-blue-400 uppercase tracking-wide">
                  Recommended
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTemplate('blank')}
                disabled={isCreating}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  template === 'blank'
                    ? 'bg-blue-600/15 border-blue-500/60 ring-1 ring-blue-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileCode className={`w-3.5 h-3.5 ${template === 'blank' ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span className={`text-xs font-semibold ${template === 'blank' ? 'text-white' : 'text-slate-300'}`}>
                      Blank Workspace
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Starts with empty model and views definitions for custom authoring.
                  </p>
                </div>
                <span className="mt-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  Empty
                </span>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-lg shadow-blue-600/25 disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Workspace</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
