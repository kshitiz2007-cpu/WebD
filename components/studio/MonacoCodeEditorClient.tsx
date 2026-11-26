'use client';

import React, { useEffect, useRef } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

let monacoConfigured = false;

function ensureMonacoConfigured() {
  if (monacoConfigured || typeof window === 'undefined') return;
  monacoConfigured = true;

  if (!monaco.languages.getLanguages().some((language) => language.id === 'kotlin')) {
    monaco.languages.register({ id: 'kotlin', extensions: ['.kt', '.kts'], aliases: ['Kotlin', 'kotlin'] });
    monaco.languages.setMonarchTokensProvider('kotlin', {
      keywords: ['package', 'import', 'class', 'object', 'interface', 'fun', 'val', 'var', 'return', 'if', 'else', 'when', 'for', 'while', 'in', 'is', 'as', 'try', 'catch', 'finally', 'throw', 'private', 'public', 'protected', 'internal', 'override', 'open', 'abstract', 'data', 'sealed', 'enum', 'inline', 'suspend', 'const', 'lateinit', 'this', 'super', 'null', 'true', 'false'],
      typeKeywords: ['String', 'Int', 'Long', 'Float', 'Double', 'Boolean', 'Unit', 'Any', 'List', 'Map', 'Set'],
      operators: ['=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%'],
      tokenizer: {
        root: [
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          [/@[\w.]+/, 'annotation'],
          [/\b[A-Z][\w]*\b/, 'type.identifier'],
          [/\b\d+(\.\d+)?\b/, 'number'],
          [/"/, 'string', '@string'],
          [/'/, 'string', '@stringSingle'],
          [/[a-zA-Z_$][\w$]*/, { cases: { '@keywords': 'keyword', '@typeKeywords': 'type', '@default': 'identifier' } }],
          [/[{}()[\]]/, '@brackets'],
          [/[;,.]/, 'delimiter'],
          [/[=><!~?&|+\-*\/%^]/, 'operator'],
        ],
        comment: [[/[^/*]+/, 'comment'], [/\*\//, 'comment', '@pop'], [/[/\*]/, 'comment']],
        string: [[/\\./, 'string.escape'], [/[^\\"]+/, 'string'], [/"/, 'string', '@pop']],
        stringSingle: [[/\\./, 'string.escape'], [/[^\\']+/, 'string'], [/'/, 'string', '@pop']],
      },
    });
  }

  const win = window as unknown as {
    MonacoEnvironment?: {
      getWorker?: (_moduleId: string, label: string) => Worker;
    };
  };

  if (!win.MonacoEnvironment) {
    win.MonacoEnvironment = {
      getWorker(_moduleId: string, label: string) {
        if (label === 'json') {
          return new Worker(
            new URL('monaco-editor/language/json/json.worker.js', import.meta.url),
            { type: 'module' }
          );
        }
        if (label === 'css' || label === 'scss' || label === 'less') {
          return new Worker(
            new URL('monaco-editor/language/css/css.worker.js', import.meta.url),
            { type: 'module' }
          );
        }
        if (label === 'html' || label === 'handlebars' || label === 'razor') {
          return new Worker(
            new URL('monaco-editor/language/html/html.worker.js', import.meta.url),
            { type: 'module' }
          );
        }
        if (label === 'typescript' || label === 'javascript') {
          return new Worker(
            new URL('monaco-editor/language/typescript/ts.worker.js', import.meta.url),
            { type: 'module' }
          );
        }
        return new Worker(
          new URL('monaco-editor/editor/editor.worker.js', import.meta.url),
          { type: 'module' }
        );
      },
    };
  }

  loader.config({ monaco });

  const tsDefaults = monaco.typescript?.typescriptDefaults;
  if (tsDefaults) {
    tsDefaults.setCompilerOptions({
      target: monaco.typescript.ScriptTarget.ESNext,
      module: monaco.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
      jsx: monaco.typescript.JsxEmit.ReactJSX,
      allowJs: true,
      allowNonTsExtensions: true,
      esModuleInterop: true,
      noEmit: true,
      strict: false,
    });
    tsDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
  }

  const jsDefaults = monaco.typescript?.javascriptDefaults;
  if (jsDefaults) {
    jsDefaults.setCompilerOptions({
      target: monaco.typescript.ScriptTarget.ESNext,
      module: monaco.typescript.ModuleKind.ESNext,
      jsx: monaco.typescript.JsxEmit.ReactJSX,
      allowJs: true,
      allowNonTsExtensions: true,
    });
    jsDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
  }

  const cssDefaults = monaco.css?.cssDefaults;
  if (cssDefaults) {
    cssDefaults.setOptions({
      validate: false,
    });
  }
}

export function detectMonacoLanguage(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.kt') || lower.endsWith('.kts')) return 'kotlin';
  if (lower.endsWith('.tsx') || lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.jsx') || lower.endsWith('.js') || lower.endsWith('.mjs')) return 'javascript';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.md') || lower.endsWith('.mdx')) return 'markdown';
  return 'plaintext';
}

export interface MonacoCodeEditorClientProps {
  filePath: string;
  value: string;
  theme?: 'vs-dark' | 'vs';
  wordWrap?: 'on' | 'off';
  onChange: (nextValue: string) => void;
  onSaveShortcut?: () => void;
  onRegisterFormat?: (formatFn: (() => void) | null) => void;
}

export default function MonacoCodeEditorClient({
  filePath,
  value,
  theme = 'vs-dark',
  wordWrap = 'on',
  onChange,
  onSaveShortcut,
  onRegisterFormat,
}: MonacoCodeEditorClientProps) {
  ensureMonacoConfigured();

  const onSaveRef = useRef(onSaveShortcut);
  const onRegisterFormatRef = useRef(onRegisterFormat);

  useEffect(() => {
    onSaveRef.current = onSaveShortcut;
    onRegisterFormatRef.current = onRegisterFormat;
  }, [onSaveShortcut, onRegisterFormat]);

  useEffect(() => {
    return () => {
      onRegisterFormatRef.current?.(null);
    };
  }, []);

  const handleMount: OnMount = (editor, monacoInstance) => {
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => {
        onSaveRef.current?.();
      }
    );

    onRegisterFormatRef.current?.(() => {
      const action = editor.getAction('editor.action.formatDocument');
      if (action) {
        void action.run();
      }
    });
  };

  const language = detectMonacoLanguage(filePath);

  return (
    <div data-testid="monaco-editor-host" className="h-full w-full min-h-0">
      <Editor
        height="100%"
        width="100%"
        path={filePath}
        language={language}
        value={value}
        theme={theme}
        onChange={(val) => onChange(val ?? '')}
        onMount={handleMount}
        loading={
          <div className="flex h-full w-full items-center justify-center bg-slate-950 font-mono text-xs text-slate-400">
            Initializing Monaco Editor...
          </div>
        }
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          lineHeight: 19,
          fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace",
          tabSize: 2,
          insertSpaces: true,
          wordWrap,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          smoothScrolling: true,
          bracketPairColorization: { enabled: true },
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: 'line',
          overviewRulerLanes: 0,
        }}
      />
    </div>
  );
}
