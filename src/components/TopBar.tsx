import React, { useState } from 'react';
import { Shield, LogOut, LayoutGrid, FileText, CheckSquare, BarChart3, Eye, Radio, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DatabaseModal } from './DatabaseModal.tsx';

interface TopBarProps {
  currentViewTitle?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ currentViewTitle }) => {
  const { user, logout, currentPortal, setCurrentPortal } = useAuth();
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);

  if (!user) return null;

  const getRoleBadgeColor = () => {
    switch (user.role) {
      case 'ADMIN':
        return 'bg-[#181124] border-[#6B21A8] text-purple-300';
      case 'DATA OFFICER':
        return 'bg-[#0F1B2A] border-[#0369A1] text-sky-300';
      case 'VERIFICATION OFFICER':
        return 'bg-[#0E2419] border-[#047857] text-[#4ADE80]';
      case 'ANALYST':
        return 'bg-[#241A0E] border-[#B45309] text-amber-300';
      case 'VIEWER':
        return 'bg-[#15171C] border-[#2A2D35] text-[#999]';
      default:
        return 'bg-[#15171C] border-[#2A2D35] text-[#999]';
    }
  };

  return (
    <div className="enterprise-chrome">
      <aside className="enterprise-sidebar select-none">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark"><Shield className="h-5 w-5" /></div>
          <div>
            <div className="sidebar-brand-title">AI Identity Screening</div>
            <div className="sidebar-brand-subtitle">Border Security Intelligence</div>
          </div>
        </div>
        <div className="sidebar-section-label">Operations</div>
        {user.role === 'ADMIN' && (
          <nav className="sidebar-nav">
            <button type="button" onClick={() => setCurrentPortal('PORTAL_SELECT')} className={currentPortal === 'PORTAL_SELECT' ? 'sidebar-nav-item active' : 'sidebar-nav-item'}><LayoutGrid className="h-4 w-4" /><span>Portal overview</span></button>
            <button type="button" onClick={() => setCurrentPortal('ENROLLMENT')} className={currentPortal === 'ENROLLMENT' ? 'sidebar-nav-item active' : 'sidebar-nav-item'}><FileText className="h-4 w-4" /><span>Enrollment</span></button>
            <button type="button" onClick={() => setCurrentPortal('VERIFICATION')} className={currentPortal === 'VERIFICATION' ? 'sidebar-nav-item active' : 'sidebar-nav-item'}><CheckSquare className="h-4 w-4" /><span>Verification</span></button>
            <button type="button" onClick={() => setCurrentPortal('ANALYTICS')} className={currentPortal === 'ANALYTICS' ? 'sidebar-nav-item active' : 'sidebar-nav-item'}><BarChart3 className="h-4 w-4" /><span>Analytics</span></button>
            <button type="button" onClick={() => setCurrentPortal('READONLY')} className={currentPortal === 'READONLY' ? 'sidebar-nav-item active' : 'sidebar-nav-item'}><Eye className="h-4 w-4" /><span>Audit & logs</span></button>
          </nav>
        )}
        {user.role !== 'ADMIN' && <div className="sidebar-current-page"><CheckSquare className="h-4 w-4" /><span>{currentViewTitle || 'Secure workspace'}</span></div>}
        <div className="sidebar-footer"><span className="sidebar-status-dot" /> Secure session active</div>
      </aside>

      <header className="app-topbar sticky top-0 z-40 w-full border-b px-4 sm:px-6 py-3 flex items-center justify-between select-none">
      {/* Left: Current view context */}
      <div className="topbar-identity">
        <div className="topbar-breadcrumb">SECURE OPERATIONS / CHECKPOINT</div>
        <div className="topbar-title">{currentViewTitle || 'Border security workspace'}</div>
      </div>

      {/* Center: Admin Portal Switcher (If Admin) */}
      {user.role === 'ADMIN' && (
        <div className="topbar-portal-switcher hidden lg:flex items-center gap-1 p-1 rounded-md border text-xs">
          <button
            type="button"
            onClick={() => setCurrentPortal('PORTAL_SELECT')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentPortal === 'PORTAL_SELECT'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                : 'text-[#888] hover:text-[#E0E0E0] border border-transparent'
            }`}
          >
            <LayoutGrid className="h-3 w-3" />
            <span>Portals</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentPortal('ENROLLMENT')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentPortal === 'ENROLLMENT'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                : 'text-[#888] hover:text-[#E0E0E0] border border-transparent'
            }`}
          >
            <FileText className="h-3 w-3" />
            <span>Enrollment</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentPortal('VERIFICATION')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentPortal === 'VERIFICATION'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                : 'text-[#888] hover:text-[#E0E0E0] border border-transparent'
            }`}
          >
            <CheckSquare className="h-3 w-3" />
            <span>Verification</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentPortal('ANALYTICS')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentPortal === 'ANALYTICS'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                : 'text-[#888] hover:text-[#E0E0E0] border border-transparent'
            }`}
          >
            <BarChart3 className="h-3 w-3" />
            <span>Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentPortal('READONLY')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentPortal === 'READONLY' || currentPortal === 'VIEWER'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                : 'text-[#888] hover:text-[#E0E0E0] border border-transparent'
            }`}
          >
            <Eye className="h-3 w-3" />
            <span>Audit / Logs</span>
          </button>
        </div>
      )}

      {/* Right: Officer Metadata and Logout */}
      <div className="flex items-center gap-3 text-xs">
        {/* Officer info */}
        <div className="hidden sm:flex flex-col text-right font-mono">
          <span className="font-bold text-[#E0E0E0] leading-tight text-[11px]">
            {user.fullName}
          </span>
          <span className="text-[9px] text-[#666]">
            ID: {user.username} • {user.badgeNumber}
          </span>
        </div>

        {/* Role badge */}
        <div className={`topbar-role-badge px-2 py-0.5 rounded border font-mono font-semibold text-[10px] tracking-wider uppercase ${getRoleBadgeColor()}`}>
          {user.role}
        </div>

        {/* Online Indicator */}
        <div className="topbar-online-indicator hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-[#0D0F12] border border-[#2A2D35] text-[10px] font-mono text-[#4ADE80]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
          <span>● SYSTEM ONLINE</span>
        </div>

        {/* Database Management Button */}
        <button
          id="topbar-database-button"
          type="button"
          onClick={() => setIsDbModalOpen(true)}
          className="px-2.5 py-1.5 rounded bg-[#101924] hover:bg-[#162538] border border-cyan-500/50 text-cyan-300 font-mono text-[10px] font-bold tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-[0_0_8px_rgba(6,182,212,0.15)] active:scale-95"
          title="Database management, reset, and data delete options"
        >
          <Database className="h-3 w-3 text-cyan-400" />
          <span className="uppercase">DATABASE</span>
        </button>

        {/* Logout Button */}
        <button
          id="officer-logout-button"
          type="button"
          onClick={() => logout()}
          className="px-2.5 py-1.5 rounded bg-[#1F1315] hover:bg-[#2C181C] border border-[#7F1D1D] text-red-400 font-mono text-[10px] font-bold tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          title="Sign out of checkpoint session"
        >
          <LogOut className="h-3 w-3" />
          <span className="hidden sm:inline uppercase">LOGOUT</span>
        </button>
      </div>

      {/* Database Management Suite Modal */}
      <DatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onDataChanged={() => {
          window.dispatchEvent(new CustomEvent('database-changed'));
        }}
      />
      </header>
    </div>
  );
};
