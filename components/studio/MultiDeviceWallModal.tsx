'use client';

import React, { useState } from 'react';
import { Monitor, Smartphone, Tablet, X, ZoomIn, ZoomOut } from 'lucide-react';

interface MultiDeviceWallModalProps {
  isOpen: boolean;
  pageTitle: string;
  pageRoute: string;
  srcDoc: string;
  onClose: () => void;
}

const DEVICES = [
  { id: 'desktop', label: 'Desktop', width: 1280, height: 820, icon: Monitor },
  { id: 'tablet', label: 'Tablet', width: 768, height: 820, icon: Tablet },
  { id: 'mobile', label: 'Mobile', width: 390, height: 820, icon: Smartphone },
] as const;

export default function MultiDeviceWallModal({
  isOpen,
  pageTitle,
  pageRoute,
  srcDoc,
  onClose,
}: MultiDeviceWallModalProps) {
  const [wallScale, setWallScale] = useState(0.5);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-100"
      role="dialog"
      aria-modal="true"
      aria-label="Multi-Device Preview Wall"
      data-testid="multi-device-wall"
    >
      {/* Top Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-slate-900">Multi-Device Preview Wall</span>
          <span className="hidden sm:inline rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
            {pageTitle} ({pageRoute})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              aria-label="Zoom out preview wall"
              onClick={() => setWallScale((s) => Math.max(0.3, Math.round((s - 0.1) * 10) / 10))}
              className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] font-semibold tabular-nums text-slate-700">
              {Math.round(wallScale * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in preview wall"
              onClick={() => setWallScale((s) => Math.min(1, Math.round((s + 0.1) * 10) / 10))}
              className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Exit Multi-Device Preview Wall"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
            <span>Exit Wall</span>
          </button>
        </div>
      </div>

      {/* Panoramic Side-by-Side Devices */}
      <div
        className="flex-1 overflow-auto p-6"
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        <div className="flex min-w-max items-start gap-6">
          {DEVICES.map((device) => {
            const Icon = device.icon;
            const scaledW = Math.round(device.width * wallScale);
            const scaledH = Math.round(device.height * wallScale);
            return (
              <div key={device.id} className="flex flex-col items-start gap-2 shrink-0">
                <div className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Icon className="h-3.5 w-3.5 text-blue-600" />
                    <span>{device.label}</span>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-slate-400">
                    {device.width}px
                  </span>
                </div>

                <div
                  className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg"
                  style={{ width: scaledW, height: scaledH }}
                >
                  <iframe
                    title={`${device.label} live preview`}
                    srcDoc={srcDoc}
                    sandbox="allow-scripts allow-same-origin"
                    style={{
                      width: device.width,
                      height: device.height,
                      transform: `scale(${wallScale})`,
                      transformOrigin: 'top left',
                      border: 'none',
                      backgroundColor: '#ffffff',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
