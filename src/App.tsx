import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { TopBar } from './components/TopBar.tsx';
import { AdminPortalSelect } from './components/AdminPortalSelect.tsx';
import { EnrollmentPortal } from './components/EnrollmentPortal.tsx';
import { VerificationPortal } from './components/VerificationPortal.tsx';
import { AnalyticsPortal } from './components/AnalyticsPortal.tsx';
import { AuditPortal } from './components/AuditPortal.tsx';

function MainApp() {
  const { user, currentPortal, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] flex flex-col items-center justify-center text-[#E0E0E0]">
        <div className="h-10 w-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4 shadow-[0_0_12px_#06b6d4]" />
        <div className="text-xs font-mono tracking-[0.2em] uppercase text-cyan-500">
          INITIALIZING SECURE CHECKPOINT SYSTEM...
        </div>
      </div>
    );
  }

  // The FIRST SCREEN must ALWAYS be a professional LOGIN PAGE. Do NOT open directly into dashboard.
  if (!user) {
    return <LoginScreen />;
  }

  // Render Portal based on currentPortal state
  const renderActivePortal = () => {
    switch (currentPortal) {
      case 'PORTAL_SELECT':
        return <AdminPortalSelect />;
      case 'ENROLLMENT':
        return <EnrollmentPortal />;
      case 'VERIFICATION':
        return <VerificationPortal />;
      case 'ANALYTICS':
        return <AnalyticsPortal />;
      case 'VIEWER':
      case 'READONLY':
        return <AuditPortal />;
      default:
        // Default fallback based on role
        if (user.role === 'ADMIN') return <AdminPortalSelect />;
        if (user.role === 'DATA OFFICER') return <EnrollmentPortal />;
        if (user.role === 'VERIFICATION OFFICER') return <VerificationPortal />;
        if (user.role === 'ANALYST') return <AnalyticsPortal />;
        return <AuditPortal />;
    }
  };

  const getViewTitle = () => {
    switch (currentPortal) {
      case 'PORTAL_SELECT':
        return 'System Portal Selection';
      case 'ENROLLMENT':
        return 'Traveler Enrollment & Document Onboarding';
      case 'VERIFICATION':
        return 'Active Checkpoint Screening';
      case 'ANALYTICS':
        return 'Fraud Intelligence & Throughput Analytics';
      case 'VIEWER':
      case 'READONLY':
        return 'Compliance & Audit Trail (View-Only)';
      default:
        return 'Border Screening Terminal';
    }
  };

  return (
    <div className="app-shell min-h-screen flex flex-col selection:bg-blue-100 selection:text-blue-900 relative">
      <TopBar currentViewTitle={getViewTitle()} />
      <main className="app-main flex-1 flex flex-col relative z-10">
        {renderActivePortal()}
      </main>

      {/* Hardware Telemetry Status Footer */}
      <footer className="app-footer h-9 border-t flex items-center justify-between px-4 sm:px-6 text-[9px] text-slate-400 tracking-wider z-20 select-none">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-cyan-500/80">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            LIVE LINK
          </span>
          <span className="hidden sm:inline">SERVER: CP-ALPHA-01</span>
          <span className="hidden md:inline">ENCRYPTION: AES-256-GCM</span>
          <span className="hidden lg:inline">GATEWAY: BORDER-CON-4</span>
          <span className="text-[#4ADE80]">● TELEMETRY NOMINAL</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[#555]">LATENCY: 14ms</span>
          <span className="text-[#777]">AI DOCUMENT VALIDATION CORE V4.2.0-STABLE</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
