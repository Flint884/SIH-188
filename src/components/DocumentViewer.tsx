import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RefreshCw, Trash2, Eye, FileText, Upload, Sparkles } from 'lucide-react';
import { TamperingRegion } from '../types.ts';
import { optimizeImage } from '../utils/imageOptimizer.ts';

interface DocumentViewerProps {
  documentDataUrl: string | null;
  fileName?: string;
  onFileSelect: (dataUrl: string, file: File) => void;
  onRemove?: () => void;
  onStartOcr?: () => void;
  isProcessingOcr?: boolean;
  tamperingRegions?: TamperingRegion[];
  showTamperingOverlay?: boolean;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentDataUrl,
  fileName,
  onFileSelect,
  onRemove,
  onStartOcr,
  isProcessingOcr = false,
  tamperingRegions = [],
  showTamperingOverlay = false,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [activeRegion, setActiveRegion] = useState<TamperingRegion | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    try {
      const optimized = await optimizeImage(file, 1600, 0.85);
      if (optimized) {
        onFileSelect(optimized, file);
        setZoom(1);
        setRotation(0);
        return;
      }
    } catch (err) {
      console.warn('File optimization warning:', err);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onFileSelect(result, file);
        setZoom(1);
        setRotation(0);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  if (!documentDataUrl) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-80 rounded-xl border-2 border-dashed border-[#2A2D35] hover:border-cyan-500 bg-[#0D0F12] hover:bg-[#111318] transition-all flex flex-col items-center justify-center p-6 text-center cursor-pointer group select-none shadow-inner"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/jpg, application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="h-16 w-16 rounded-xl bg-[#15171C] border border-cyan-500/30 group-hover:scale-110 group-hover:border-cyan-500/60 text-cyan-400 flex items-center justify-center mb-4 transition-all shadow-[0_0_12px_rgba(6,182,212,0.15)]">
          <Upload className="h-8 w-8" />
        </div>
        <div className="text-xs font-mono font-bold tracking-[0.2em] text-white uppercase mb-1">
          DRAG & DROP OFFICIAL CREDENTIAL
        </div>
        <div className="text-xs font-mono text-[#888] max-w-sm mb-3">
          Supports high-resolution JPG, JPEG, PNG, or PDF scans (Passport, Visa, National ID)
        </div>
        <div className="px-3 py-1.5 rounded bg-[#15171C] border border-[#2A2D35] text-cyan-400 text-[10px] font-mono tracking-wider uppercase shadow-sm">
          Click to Browse Local Storage
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#15171C] border border-[#2A2D35] rounded-xl overflow-hidden shadow-2xl relative">
      {/* Cyan top glowing hairline */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

      {/* Viewer Action Controls Header */}
      <div className="px-4 py-2.5 bg-[#111318] border-b border-[#2A2D35] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-mono text-[#E0E0E0]">
          <FileText className="h-4 w-4 text-cyan-400" />
          <span className="truncate max-w-[180px] font-semibold">
            {fileName || 'Uploaded_Document.img'}
          </span>
          <span className="text-[10px] text-[#777]">
            ({Math.round(zoom * 100)}% • {rotation}°)
          </span>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1.5 rounded bg-[#0D0F12] hover:bg-[#1A1E24] text-[#CCC] border border-[#2A2D35] text-xs cursor-pointer transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1.5 rounded bg-[#0D0F12] hover:bg-[#1A1E24] text-[#CCC] border border-[#2A2D35] text-xs cursor-pointer transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            title="Reset Zoom"
            className="p-1.5 rounded bg-[#0D0F12] hover:bg-[#1A1E24] text-[#CCC] border border-[#2A2D35] text-xs cursor-pointer transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            title="Rotate 90° Clockwise"
            className="p-1.5 rounded bg-[#0D0F12] hover:bg-[#1A1E24] text-[#CCC] border border-[#2A2D35] text-xs cursor-pointer transition-colors"
          >
            <RotateCw className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-[#2A2D35] mx-1" />

          {/* Replace file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Replace Document"
            className="px-2.5 py-1.5 rounded bg-[#0D0F12] hover:bg-[#1A1E24] text-[#AAA] hover:text-[#E0E0E0] border border-[#2A2D35] text-[10px] font-mono uppercase cursor-pointer transition-colors"
          >
            Replace
          </button>

          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Remove Document"
              className="p-1.5 rounded bg-[#1F1315] hover:bg-[#2A171A] text-red-400 border border-[#7F1D1D] text-xs cursor-pointer transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          {onStartOcr && (
            <button
              id="start-ocr-button"
              type="button"
              disabled={isProcessingOcr}
              onClick={onStartOcr}
              className="ml-1 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 active:scale-95 disabled:opacity-50 text-white text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 shadow-[0_0_15px_rgba(8,145,178,0.3)] cursor-pointer"
            >
              {isProcessingOcr ? (
                <>
                  <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>EXTRACTING OCR...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>START OCR</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative w-full h-[400px] sm:h-[450px] bg-[#0A0B0D] overflow-hidden flex items-center justify-center p-4">
        {/* Document Render Container with Zoom & Rotation */}
        <div
          className="relative max-w-full max-h-full transition-transform duration-200 select-none"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        >
          <img
            src={documentDataUrl}
            alt="Physical Document Scan"
            className="max-h-[380px] w-auto object-contain rounded border border-[#2A2D35] shadow-2xl pointer-events-none"
          />

          {/* Tampering Detection Overlay Boxes */}
          {showTamperingOverlay && tamperingRegions.map((region) => {
            const coords = region.coordinates || { x: 10, y: 15, width: 80, height: 70 };
            const borderColor =
              region.severity === 'RED'
                ? 'border-red-500 bg-red-500/15 text-red-400'
                : region.severity === 'ORANGE'
                ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                : 'border-[#4ADE80] bg-[#4ADE80]/15 text-[#4ADE80]';

            return (
              <div
                key={region.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveRegion(region);
                }}
                className={`absolute border-2 rounded cursor-pointer transition-all hover:scale-105 ${borderColor}`}
                style={{
                  left: `${coords.x}%`,
                  top: `${coords.y}%`,
                  width: `${coords.width}%`,
                  height: `${coords.height}%`,
                }}
              >
                <span className="absolute -top-3 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#0A0B0D] border border-current shadow">
                  {region.regionName}
                </span>
              </div>
            );
          })}
        </div>

        {/* Floating region detail popup */}
        {activeRegion && (
          <div className="absolute bottom-4 left-4 right-4 bg-[#111318]/95 border border-[#2A2D35] p-3 rounded-lg shadow-2xl text-xs z-20 flex items-start justify-between font-mono">
            <div>
              <div className="font-bold text-white flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    activeRegion.severity === 'RED'
                      ? 'bg-red-500'
                      : activeRegion.severity === 'ORANGE'
                      ? 'bg-amber-500'
                      : 'bg-[#4ADE80]'
                  }`}
                />
                <span>{activeRegion.regionName}</span>
                <span className="text-[10px] font-mono text-[#888]">
                  Confidence: {activeRegion.confidence.toFixed(1)}%
                </span>
              </div>
              <p className="text-[#AAA] mt-1">{activeRegion.description}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveRegion(null)}
              className="text-[#888] hover:text-white px-2 py-1 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
