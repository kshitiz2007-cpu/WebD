'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { buildPreviewDocument } from '@/lib/studio/preview-runner';
import { ProjectPage, VirtualProject } from '@/lib/studio/types';

interface SplitMobileTwinProps {
  project: VirtualProject;
  activePage: ProjectPage;
  compiledTailwindCss: string;
  isIsolatedComponent: boolean;
  isHtmlPage: boolean;
  reactPayload: ReturnType<typeof import('@/lib/studio/preview-runner').compileReactPreviewPayload> | null;
  htmlPayload: ReturnType<typeof import('@/lib/studio/preview-runner').compileHtmlBodyPayload> | null;
  lucideVersion: number;
  externalLibVersion: number;
  frameHeight: number;
  twinScale?: number;
}

export default function SplitMobileTwin({
  project,
  activePage,
  compiledTailwindCss,
  isIsolatedComponent,
  isHtmlPage,
  reactPayload,
  htmlPayload,
  lucideVersion,
  externalLibVersion,
  frameHeight,
  twinScale = 0.56,
}: SplitMobileTwinProps) {
  const twinIframeRef = useRef<HTMLIFrameElement>(null);
  const [twinReadyKey, setTwinReadyKey] = useState<string | null>(null);
  const docKey = `twin:${project.framework}:${activePage.filePath}:${isIsolatedComponent ? 1 : 0}`;

  const [prevDocKey, setPrevDocKey] = useState<string>('');
  const [docHtml, setDocHtml] = useState<string>(
    '<!doctype html><html><body style="margin:0;background:#ffffff"></body></html>'
  );
  const latestRef = useRef({
    compiledTailwindCss,
    isHtmlPage,
    reactPayload,
    htmlPayload,
  });

  useEffect(() => {
    latestRef.current = {
      compiledTailwindCss,
      isHtmlPage,
      reactPayload,
      htmlPayload,
    };
  });

  if (docKey !== prevDocKey) {
    setPrevDocKey(docKey);
    const built = buildPreviewDocument(
      project,
      activePage,
      compiledTailwindCss,
      'interact',
      null,
      { isolateComponent: isIsolatedComponent }
    );
    setDocHtml(built.html);
    setTwinReadyKey(null);
  }

  useEffect(() => {
    if (twinReadyKey !== docKey) return;
    const win = twinIframeRef.current?.contentWindow;
    if (!win) return;
    if (isHtmlPage && htmlPayload) {
      win.postMessage(
        {
          type: 'studio:hot-update-html',
          bodyHtml: htmlPayload.bodyHtml,
          userCss: htmlPayload.userCss,
          tailwindCss: latestRef.current.compiledTailwindCss,
        },
        '*'
      );
    } else if (reactPayload) {
      win.postMessage(
        {
          type: 'studio:hot-update',
          payload: reactPayload,
          tailwindCss: latestRef.current.compiledTailwindCss,
        },
        '*'
      );
    }
  }, [twinReadyKey, docKey, isHtmlPage, reactPayload, htmlPayload]);

  useEffect(() => {
    if (twinReadyKey !== docKey) return;
    twinIframeRef.current?.contentWindow?.postMessage(
      { type: 'studio:update-css', tailwindCss: compiledTailwindCss },
      '*'
    );
  }, [twinReadyKey, docKey, compiledTailwindCss]);

  useEffect(() => {
    if (twinReadyKey !== docKey) return;
    twinIframeRef.current?.contentWindow?.postMessage({ type: 'studio:refresh-runtime' }, '*');
  }, [twinReadyKey, docKey, lucideVersion, externalLibVersion]);

  const twinWidth = 390;
  const scaledW = Math.round(twinWidth * twinScale);
  const scaledH = Math.round(frameHeight * twinScale);

  return (
    <div
      data-testid="studio-split-mobile-twin"
      className="flex shrink-0 flex-col items-center gap-1.5"
    >
      <div className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          <Smartphone className="h-3 w-3 text-blue-600" />
          <span>Mobile Live Mirror</span>
        </span>
        <span className="font-mono text-[10px] tabular-nums text-slate-400">390px</span>
      </div>
      <div
        className="relative shrink-0 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md"
        style={{ width: scaledW, height: scaledH }}
      >
        <div
          className="origin-top-left"
          style={{
            width: twinWidth,
            height: frameHeight,
            transform: `scale(${twinScale})`,
          }}
        >
          <iframe
            ref={twinIframeRef}
            title={`Mobile mirror preview of ${activePage.route}`}
            srcDoc={docHtml}
            onLoad={() => {
              setTwinReadyKey(docKey);
              const win = twinIframeRef.current?.contentWindow;
              if (!win) return;
              const cur = latestRef.current;
              if (cur.isHtmlPage && cur.htmlPayload) {
                win.postMessage(
                  {
                    type: 'studio:hot-update-html',
                    bodyHtml: cur.htmlPayload.bodyHtml,
                    userCss: cur.htmlPayload.userCss,
                    tailwindCss: cur.compiledTailwindCss,
                  },
                  '*'
                );
              } else if (cur.reactPayload) {
                win.postMessage(
                  {
                    type: 'studio:hot-update',
                    payload: cur.reactPayload,
                    tailwindCss: cur.compiledTailwindCss,
                  },
                  '*'
                );
              }
            }}
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0 bg-white"
          />
        </div>
      </div>
    </div>
  );
}
