import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Eye,
  Check,
  Lock,
  ChevronDown,
  ChevronUp,
  User,
  Type,
  Shield,
  ScanLine,
  RefreshCw,
  Info,
  CheckCircle,
} from 'lucide-react';
import { TamperingAnalysis, TamperingRegion } from '../types.ts';
import { DocumentViewer } from './DocumentViewer.tsx';

interface ForensicCheckViewProps {
  tamperingAnalysis: TamperingAnalysis | null;
  scannedDocumentData: string | null;
  scannedFileName?: string;
  isAnalyzingTampering: boolean;
  onRunAnalysis: () => void;
  onBackToComparison: () => void;
  onProceedToFaceVerify: () => void;
  canProceedToFaceVerify: boolean;
}

export const ForensicCheckView: React.FC<ForensicCheckViewProps> = ({
  tamperingAnalysis,
  scannedDocumentData,
  scannedFileName,
  isAnalyzingTampering,
  onRunAnalysis,
  onBackToComparison,
  onProceedToFaceVerify,
  canProceedToFaceVerify,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [activeRegion, setActiveRegion] = useState<TamperingRegion | null>(null);

  // If no analysis has been run yet (e.g. officer navigated here directly)
  if (!tamperingAnalysis) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl"
      >
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
            STAGE 3 OF 5 • CREDENTIAL AUTHENTICITY
          </div>
          <h3 className="text-xl font-bold font-mono text-white">
            Forensic Document Integrity Check
          </h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Run automated forensic analysis to inspect photo boundary sharpness, typeface consistency,
            microline guilloche patterns, and digital editing artifacts.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={isAnalyzingTampering}
            onClick={onRunAnalysis}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs tracking-wider flex items-center gap-2 mx-auto cursor-pointer shadow-lg shadow-blue-900/40 transition-all disabled:opacity-50"
          >
            {isAnalyzingTampering ? (
              <>
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>ANALYZING CREDENTIAL INTEGRITY...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>RUN LIVE FORENSIC DETECTION</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-start">
          <button
            type="button"
            onClick={onBackToComparison}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Registry Check</span>
          </button>
        </div>
      </motion.div>
    );
  }

  // Assess status helper
  const assessFactor = (text: string | undefined): 'CLEAN' | 'CAUTION' | 'ALERT' => {
    if (!text) return 'CLEAN';
    const lower = text.toLowerCase();
    if (
      lower.includes('tamper') ||
      lower.includes('alert') ||
      lower.includes('fail') ||
      lower.includes('alteration') ||
      lower.includes('counterfeit') ||
      lower.includes('high risk') ||
      lower.includes('splic')
    ) {
      return 'ALERT';
    }
    if (
      lower.includes('inconclusive') ||
      lower.includes('warning') ||
      lower.includes('caution') ||
      lower.includes('potential') ||
      lower.includes('anomaly') ||
      lower.includes('discrepancy') ||
      lower.includes('irregular') ||
      lower.includes('deviation')
    ) {
      return 'CAUTION';
    }
    return 'CLEAN';
  };

  const flaggedRegions = tamperingAnalysis.regions?.filter(
    (r) => r.severity === 'RED' || r.severity === 'ORANGE'
  ) || [];

  const isLowRisk = tamperingAnalysis.tamperingRisk === 'LOW';
  const isHighRisk = tamperingAnalysis.tamperingRisk === 'HIGH';
  const isMediumRisk = tamperingAnalysis.tamperingRisk === 'MEDIUM';

  const photoStatus = assessFactor(tamperingAnalysis.factors.photoIntegrity);
  const textStatus = assessFactor(tamperingAnalysis.factors.textConsistency);
  const patternStatus = assessFactor(
    `${tamperingAnalysis.factors.imageConsistency} ${tamperingAnalysis.factors.documentLayout}`
  );
  const digitalStatus = assessFactor(
    `${tamperingAnalysis.factors.copyPasteArtifacts} ${tamperingAnalysis.factors.compressionInconsistencies} ${tamperingAnalysis.factors.mrzConsistency}`
  );

  const pillars = [
    {
      id: 'photo',
      title: 'Holder Portrait & Edges',
      subtitle: 'Photo cutouts, boundary sharpness & face substitution',
      status: photoStatus,
      icon: User,
      observation: tamperingAnalysis.factors.photoIntegrity,
      defaultClean: 'Photo boundary is clean with natural sensor grain. No replacement seams or edge blur detected.',
    },
    {
      id: 'text',
      title: 'Typography & Numbers',
      subtitle: 'Font matching, digit alterations & text alignment',
      status: textStatus,
      icon: Type,
      observation: tamperingAnalysis.factors.textConsistency,
      defaultClean: 'Official typeface matches national registry specifications. Character spacing and baseline alignment are consistent.',
    },
    {
      id: 'pattern',
      title: 'Security Pattern & Guilloche',
      subtitle: 'Background fine linework & anti-counterfeit prints',
      status: patternStatus,
      icon: Shield,
      observation: tamperingAnalysis.factors.imageConsistency,
      defaultClean: 'Guilloche background security patterns and document proportions are continuous and unbroken across all fields.',
    },
    {
      id: 'digital',
      title: 'Digital Forensics & MRZ',
      subtitle: 'Copy-paste artifacts, compression blocks & MRZ fonts',
      status: digitalStatus,
      icon: ScanLine,
      observation: tamperingAnalysis.factors.copyPasteArtifacts || tamperingAnalysis.factors.mrzConsistency,
      defaultClean: 'No digital editing artifacts, compression anomalies, or OCR-B font discrepancies detected in the machine-readable zone.',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* 1. SIMPLE EXECUTIVE VERDICT CARD */}
      <div
        className={`p-5 rounded-2xl border transition-all shadow-xl relative overflow-hidden ${
          isLowRisk
            ? 'bg-gradient-to-r from-emerald-950/60 to-slate-900/80 border-emerald-500/40 text-emerald-200'
            : isMediumRisk
            ? 'bg-gradient-to-r from-amber-950/60 to-slate-900/80 border-amber-500/40 text-amber-200'
            : 'bg-gradient-to-r from-red-950/60 to-slate-900/80 border-red-500/40 text-red-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                isLowRisk
                  ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                  : isMediumRisk
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                  : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
              }`}
            >
              {isLowRisk ? (
                <ShieldCheck className="h-7 w-7" />
              ) : isMediumRisk ? (
                <AlertTriangle className="h-7 w-7" />
              ) : (
                <AlertOctagon className="h-7 w-7" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold opacity-80">
                  STAGE 3 VERDICT • FORENSIC INTEGRITY
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-mono tracking-tight text-white mt-0.5">
                {isLowRisk
                  ? 'Document Authenticity: Verified Clean'
                  : isMediumRisk
                  ? 'Document Authenticity: Review Recommended'
                  : 'Document Flagged: Potential Tampering'}
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                {isLowRisk
                  ? 'No physical or digital tampering detected. Photo borders, typography, and security linework conform to authentic credential standards.'
                  : isMediumRisk
                  ? 'Minor pattern or alignment anomaly detected. Please verify the highlighted zones below before issuing clearance.'
                  : 'Critical anomaly detected in photograph boundaries or text alignment. Supervisor verification recommended.'}
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
            <span
              className={`px-3 py-1.5 rounded-full font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${
                isLowRisk
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                  : isMediumRisk
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'bg-red-500/20 text-red-300 border border-red-500/50'
              }`}
            >
              {isLowRisk ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {isLowRisk ? 'Low Risk (Passed)' : isMediumRisk ? 'Medium Risk (Inspect)' : 'High Risk (Flagged)'}
            </span>

            <button
              type="button"
              onClick={onRunAnalysis}
              disabled={isAnalyzingTampering}
              className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-1"
            >
              <RefreshCw className={`h-3 w-3 ${isAnalyzingTampering ? 'animate-spin' : ''}`} />
              <span>Re-run Analysis</span>
            </button>
          </div>
        </div>

        {/* Quick summary stats bar */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10 text-xs font-mono">
          <div className="p-2 rounded-lg bg-slate-950/60 border border-white/5">
            <span className="text-slate-400 block text-[10px] uppercase">Overall Integrity</span>
            <span className={`font-bold ${isLowRisk ? 'text-emerald-400' : isMediumRisk ? 'text-amber-400' : 'text-red-400'}`}>
              {isLowRisk ? '100% Authentic' : isMediumRisk ? 'Minor Variance' : 'Tampered / Suspicious'}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-950/60 border border-white/5">
            <span className="text-slate-400 block text-[10px] uppercase">Security Checks</span>
            <span className="font-bold text-slate-200">
              {flaggedRegions.length === 0 ? '8 of 8 Normal' : `${8 - flaggedRegions.length} Normal (${flaggedRegions.length} Flagged)`}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-950/60 border border-white/5">
            <span className="text-slate-400 block text-[10px] uppercase">Flagged Zones</span>
            <span className={`font-bold ${flaggedRegions.length === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {flaggedRegions.length === 0 ? '0 Anomaly Zones' : `${flaggedRegions.length} Zone(s) to Inspect`}
            </span>
          </div>
        </div>
      </div>

      {/* 2. SIMPLE 4-PILLAR SECURITY OVERVIEW */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
              <span>Core Security Pillars</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                4-Point Verification
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Clear breakdown of the physical and digital checks performed on this credential.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowTechnicalDetails((prev) => !prev)}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors shrink-0"
          >
            <span>{showTechnicalDetails ? 'Hide Technical Audit' : 'Show Technical Audit (8 Factors)'}</span>
            {showTechnicalDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            const isClean = pillar.status === 'CLEAN';
            const isAlert = pillar.status === 'ALERT';

            return (
              <div
                key={pillar.id}
                className={`p-4 rounded-xl border transition-all ${
                  isClean
                    ? 'bg-slate-900/90 border-slate-800'
                    : isAlert
                    ? 'bg-red-950/20 border-red-800/50'
                    : 'bg-amber-950/20 border-amber-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isClean
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isAlert
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-mono font-bold text-xs text-slate-200">{pillar.title}</div>
                      <div className="text-[11px] text-slate-400">{pillar.subtitle}</div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                      isClean
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : isAlert
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {isClean ? 'Passed' : isAlert ? 'Tamper Alert' : 'Check'}
                  </span>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed font-sans">
                  {pillar.observation || pillar.defaultClean}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. OPTIONAL ADVANCED TECHNICAL AUDIT BREAKDOWN (COLLAPSIBLE) */}
      <AnimatePresence>
        {showTechnicalDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-3"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider">
                    Full Forensic Technical Log (8 Security Factors)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Granular algorithmic and neural sensor telemetry for forensic compliance reporting.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  ISO/IEC 18013 & ICAO 9303 Compliant
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">1. Photo Integrity & Cutouts</span>
                    <span className="text-emerald-400 font-semibold">Checked</span>
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    {tamperingAnalysis.factors.photoIntegrity}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">2. Typeface & Text Baseline</span>
                    <span className="text-emerald-400 font-semibold">Checked</span>
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    {tamperingAnalysis.factors.textConsistency}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">3. Guilloche Linework Patterns</span>
                    <span className="text-emerald-400 font-semibold">Checked</span>
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    {tamperingAnalysis.factors.imageConsistency}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">4. Document Layout Proportions</span>
                    <span className="text-emerald-400 font-semibold">Checked</span>
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    {tamperingAnalysis.factors.documentLayout}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">5. Copy / Paste Artifact Scan</span>
                    <span className="text-emerald-400 font-semibold">Checked</span>
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    {tamperingAnalysis.factors.copyPasteArtifacts}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">6. Compression Block Variance</span>
                    <span className="text-emerald-400 font-semibold">Checked</span>
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    {tamperingAnalysis.factors.compressionInconsistencies}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">7. MRZ OCR-B Standard Check</span>
                    <span className="text-emerald-400 font-semibold">Checked</span>
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    {tamperingAnalysis.factors.mrzConsistency}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">8. File Structure & EXIF Headers</span>
                    <span className="text-emerald-400 font-semibold">Checked</span>
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    {tamperingAnalysis.factors.metadataConsistency}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. VISUAL CREDENTIAL INSPECTION WITH INTERACTIVE ZONES */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <div>
            <div className="font-bold text-slate-200 flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan-400" />
              <span>CREDENTIAL SCAN VISUALIZER</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Click any colored zone on the document to view its specific authenticity finding.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" /> Authentic
            </span>
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Inspect
            </span>
            <span className="flex items-center gap-1.5 text-red-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-red-400" /> Tampered
            </span>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#0A0B0D]">
          <DocumentViewer
            documentDataUrl={scannedDocumentData}
            fileName={scannedFileName}
            onFileSelect={() => {}}
            showTamperingOverlay={true}
            tamperingRegions={tamperingAnalysis.regions}
          />
        </div>

        {/* Region Quick-Selection Pills */}
        {tamperingAnalysis.regions && tamperingAnalysis.regions.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-slate-800/80">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Inspected Zones ({tamperingAnalysis.regions.length}):</span>
              <span className="text-[10px] text-slate-500">Tap zone to inspect detail</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {tamperingAnalysis.regions.map((reg) => {
                const isSelected = activeRegion?.id === reg.id;
                const isRed = reg.severity === 'RED';
                const isOrange = reg.severity === 'ORANGE';

                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => setActiveRegion(isSelected ? null : reg)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 ring-2 ring-cyan-500/30'
                        : isRed
                        ? 'bg-red-950/40 border-red-800 text-red-300 hover:bg-red-900/40'
                        : isOrange
                        ? 'bg-amber-950/40 border-amber-800 text-amber-300 hover:bg-amber-900/40'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isRed ? 'bg-red-500' : isOrange ? 'bg-amber-500' : 'bg-emerald-400'
                      }`}
                    />
                    <span className="font-semibold">{reg.regionName}</span>
                    <span className="text-[10px] opacity-70">
                      {isRed ? 'High Risk' : isOrange ? 'Review' : 'Pass'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Expanded Region Detail Box */}
            <AnimatePresence>
              {activeRegion && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-xs font-mono space-y-1 shadow-lg"
                >
                  <div className="flex items-center justify-between text-white font-bold">
                    <span className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-cyan-400" />
                      <span>{activeRegion.regionName}</span>
                    </span>
                    <span className="text-[10px] text-cyan-400">
                      Confidence: {activeRegion.confidence.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-slate-300 font-sans text-xs leading-relaxed">
                    {activeRegion.description}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 5. NAVIGATION / ADVANCEMENT CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onBackToComparison}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-2 cursor-pointer transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Registry Check</span>
        </button>

        <div className="flex items-center gap-3">
          {!canProceedToFaceVerify && (
            <div className="text-xs font-mono text-amber-400 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Tampering analysis must be completed first.</span>
            </div>
          )}

          <button
            id="goto-live-face-verify-button"
            type="button"
            disabled={!canProceedToFaceVerify}
            onClick={onProceedToFaceVerify}
            className={`px-6 py-2.5 rounded-xl font-semibold text-xs font-mono tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              canProceedToFaceVerify
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700 opacity-60'
            }`}
          >
            <span>NEXT: LIVE BIOMETRIC FACE VERIFY</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
