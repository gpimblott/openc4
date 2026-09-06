import { useState, useRef, useEffect } from 'react';
import {
  LogOut,
  ChevronDown,
  Users,
  Sparkles,
  Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserMenuProps {
  onOpenUserManagement?: () => void;
}

export function UserMenu({ onOpenUserManagement }: UserMenuProps) {
  const { user, role, isAdmin, logout, switchUser, setIsLoginModalOpen } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button
        onClick={() => setIsLoginModalOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow transition cursor-pointer"
      >
        <Key className="w-3.5 h-3.5" />
        <span>Sign In</span>
      </button>
    );
  }

  const roleStyles = {
    admin: {
      badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      avatar: 'from-purple-600 to-indigo-600',
      label: 'ADMIN',
      desc: 'Full system & architecture control'
    },
    editor: {
      badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      avatar: 'from-blue-600 to-cyan-600',
      label: 'EDITOR',
      desc: 'Can edit, compile & publish'
    },
    viewer: {
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      avatar: 'from-emerald-600 to-teal-600',
      label: 'VIEWER',
      desc: 'Read-only architecture viewing'
    }
  };

  const currentRoleStyle = roleStyles[role || 'viewer'];

  return (
    <div className="relative" ref={menuRef}>
      {/* Header Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-white transition cursor-pointer"
      >
        <div
          className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${currentRoleStyle.avatar} flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}
        >
          {user.username.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex items-center gap-1.5 text-left">
          <span className="text-xs font-semibold text-slate-200 hidden sm:inline max-w-[100px] truncate">
            {user.username}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${currentRoleStyle.badge}`}
          >
            {currentRoleStyle.label}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          {/* User Profile Header */}
          <div className="px-3 py-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 mb-2">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div
                className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${currentRoleStyle.avatar} flex items-center justify-center text-xs font-bold text-white shadow-md`}
              >
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <div className="font-bold text-white text-xs truncate">{user.displayName}</div>
                <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px]">
              <span className="text-slate-400">Assigned Role:</span>
              <span className={`px-1.5 py-0.2 rounded font-bold uppercase font-mono ${currentRoleStyle.badge}`}>
                {currentRoleStyle.label}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{currentRoleStyle.desc}</p>
          </div>

          {/* Quick Role Switcher for Pair Programming / Demonstration */}
          <div className="px-2 py-1.5 mb-1.5">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mb-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Switch Active Role:</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={async () => {
                  await switchUser('admin', 'admin123');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 rounded-lg border text-center transition cursor-pointer ${
                  role === 'admin'
                    ? 'bg-purple-600/30 border-purple-500/50 text-purple-200 font-bold'
                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
                }`}
              >
                <div className="text-[10px]">Admin</div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await switchUser('architect', 'architect123');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 rounded-lg border text-center transition cursor-pointer ${
                  role === 'editor'
                    ? 'bg-blue-600/30 border-blue-500/50 text-blue-200 font-bold'
                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
                }`}
              >
                <div className="text-[10px]">Architect</div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await switchUser('viewer', 'viewer123');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 rounded-lg border text-center transition cursor-pointer ${
                  role === 'viewer'
                    ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-200 font-bold'
                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
                }`}
              >
                <div className="text-[10px]">Viewer</div>
              </button>
            </div>
          </div>

          <div className="my-1 border-t border-slate-800" />

          {/* Admin Management Button */}
          {isAdmin && onOpenUserManagement && (
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenUserManagement();
              }}
              className="w-full text-left px-2.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2 transition cursor-pointer mb-1"
            >
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>User & Role Management (RBAC)</span>
            </button>
          )}

          {/* Sign Out Button */}
          <button
            onClick={async () => {
              setIsOpen(false);
              await logout();
            }}
            className="w-full text-left px-2.5 py-2 rounded-xl text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 flex items-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
