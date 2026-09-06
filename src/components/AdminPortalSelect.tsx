import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, CheckSquare, BarChart3, ShieldCheck, ArrowRight, Activity, Terminal, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DatabaseModal } from './DatabaseModal.tsx';

export const AdminPortalSelect: React.FC = () => {
  const { setCurrentPortal, user } = useAuth();
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 relative z-10 select-none">
      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#15171C] border border-cyan-500/40 text-cyan-400 text-[10px] font-mono tracking-[0.2em] uppercase mb-3 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>ADMINISTRATOR OVERRIDE & HARDWARE GATEWAY</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tighter uppercase font-sans">
          SELECT OPERATION PORTAL
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-[#888] font-mono max-w-xl mx-auto">
          AUTHENTICATED OPERATOR: {user?.fullName} [CLEARANCE: LEVEL-4 SUPERVISORY]
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Card 1: ENROLLMENT PORTAL */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className="bg-[#15171C] border border-[#2A2D35] hover:border-cyan-500/60 rounded-xl p-6 sm:p-7 shadow-2xl relative overflow-hidden group flex flex-col justify-between"
        >
          {/* Cyan top hairline */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

          <div>
            <div className="h-12 w-12 rounded-lg bg-[#0D0F12] border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-5 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(6,182,212,0.15)]">
              <FileText className="h-6 w-6" />
            </div>
            <div className="text-[10px] font-mono font-semibold tracking-[0.2em] text-cyan-500 uppercase mb-1">
              Data Entry & Biometrics
            </div>
            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
              ENROLLMENT PORTAL
            </h3>
            <p className="text-xs text-[#888] leading-relaxed font-mono">
              Register identities, ingest credentials, perform live OCR extraction and capture facial features.
            </p>

            <ul className="mt-5 space-y-2 text-xs text-[#AAA] font-mono border-t border-[#2A2D35] pt-4">
              <li className="flex items-center gap-2">
                <span className="text-cyan-400 font-bold">✓</span> 5-Step Identity Onboarding
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400 font-bold">✓</span> Live Document OCR & Manual Correction
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400 font-bold">✓</span> Live Camera Face Enrollment & Quality Check
              </li>
            </ul>
          </div>

          <button
            id="enter-enrollment-button"
            type="button"
            onClick={() => setCurrentPortal('ENROLLMENT')}
            className="mt-6 w-full py-3.5 px-4 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(8,145,178,0.3)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>ENTER ENROLLMENT</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>

        {/* Card 2: VERIFICATION PORTAL */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          className="bg-[#15171C] border border-[#2A2D35] hover:border-[#4ADE80]/60 rounded-xl p-6 sm:p-7 shadow-2xl relative overflow-hidden group flex flex-col justify-between"
        >
          {/* Green/Cyan top hairline */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#4ADE80] to-transparent" />

          <div>
            <div className="h-12 w-12 rounded-lg bg-[#0D0F12] border border-[#4ADE80]/40 flex items-center justify-center text-[#4ADE80] mb-5 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(74,222,128,0.15)]">
              <CheckSquare className="h-6 w-6" />
            </div>
            <div className="text-[10px] font-mono font-semibold tracking-[0.2em] text-[#4ADE80] uppercase mb-1">
              Active Checkpoint Screening
            </div>
            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
              VERIFICATION PORTAL
            </h3>
            <p className="text-xs text-[#888] leading-relaxed font-mono">
              Verify credentials, execute parity checks, detect digital alterations, and perform facial comparison.
            </p>

            <ul className="mt-5 space-y-2 text-xs text-[#AAA] font-mono border-t border-[#2A2D35] pt-4">
              <li className="flex items-center gap-2">
                <span className="text-[#4ADE80] font-bold">✓</span> Live Database Match & Discrepancy Table
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#4ADE80] font-bold">✓</span> AI Tampering & Forgery Region Scanner
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#4ADE80] font-bold">✓</span> Live Camera vs Document Biometric Face Verify
              </li>
            </ul>
          </div>

          <button
            id="enter-verification-button"
            type="button"
            onClick={() => setCurrentPortal('VERIFICATION')}
            className="mt-6 w-full py-3.5 px-4 rounded-md bg-[#059669] hover:bg-[#10B981] text-white font-bold text-xs tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>ENTER VERIFICATION</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>

      {/* Additional Quick Access Panel for Admin */}
      <div className="bg-[#111318] border border-[#2A2D35] rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded bg-[#0D0F12] border border-amber-500/40 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#E0E0E0] font-mono uppercase tracking-wider">
              Intelligence & System Audit
            </div>
            <div className="text-xs text-[#888] font-mono">
              Review anomaly metrics, risk distributions, and compliance logs
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            id="admin-hub-db-controls-button"
            type="button"
            onClick={() => setIsDbModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded bg-[#101924] hover:bg-[#162538] text-cyan-300 text-xs font-bold font-mono tracking-wider border border-cyan-500/50 cursor-pointer transition-colors whitespace-nowrap shadow-[0_0_10px_rgba(6,182,212,0.15)] flex items-center justify-center gap-2"
          >
            <Database className="h-4 w-4 text-cyan-400" />
            <span>DATABASE & RESET</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentPortal('ANALYTICS')}
            className="w-full sm:w-auto px-4 py-2.5 rounded bg-[#15171C] hover:bg-[#1C2027] text-slate-300 hover:text-white text-xs font-bold font-mono tracking-wider border border-[#2A2D35] hover:border-slate-600 cursor-pointer transition-colors whitespace-nowrap"
          >
            ANALYTICS & AUDIT
          </button>
        </div>
      </div>

      {/* Database Management Suite Modal */}
      <DatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onDataChanged={() => {
          window.dispatchEvent(new CustomEvent('database-changed'));
        }}
      />
    </div>
  );
};
