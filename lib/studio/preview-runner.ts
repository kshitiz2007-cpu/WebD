import { transform } from 'sucrase';
import { instrumentSourceWithStudioIds } from './source-editor';
import { ProjectPage, VirtualProject } from './types';

function resolveVirtualModulePath(
  fromFile: string,
  specifier: string,
  files: Record<string, string>
): string | null {
  let candidateBase = '';
  if (specifier.startsWith('@/')) {
    const rest = specifier.slice(2);
    // Support both root `@/` and `src/` alias convention
    if (hasFileCandidate(rest, files)) {
      candidateBase = rest;
    } else if (hasFileCandidate(`src/${rest}`, files)) {
      candidateBase = `src/${rest}`;
    } else {
      candidateBase = rest;
    }
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const dirParts = fromFile.split('/').slice(0, -1);
    const relParts = specifier.split('/');
    for (const part of relParts) {
      if (part === '.' || part === '') continue;
      if (part === '..') dirParts.pop();
      else dirParts.push(part);
    }
    candidateBase = dirParts.join('/');
  } else {
    return null;
  }

  const exts = ['', '.tsx', '.ts', '.jsx', '.js', '.json', '.css', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
  for (const ext of exts) {
    const full = candidateBase + ext;
    if (files[full] !== undefined) return full;
  }
  return null;
}

function hasFileCandidate(base: string, files: Record<string, string>): boolean {
  const exts = ['', '.tsx', '.ts', '.jsx', '.js', '.json', '.css', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
  return exts.some((ext) => files[base + ext] !== undefined);
}

export interface CompiledPreviewBundle {
  html: string;
  compileErrors: string[];
}

function escapeScriptClose(str: string): string {
  return str.replace(/<\/script>/gi, '<\\/script>');
}

function buildDesignerBridgeScript(activeRoute: string, interactionMode: 'design' | 'interact'): string {
  return `
(function() {
  var CURRENT_MODE = ${JSON.stringify(interactionMode)};
  var ACTIVE_ROUTE = ${JSON.stringify(activeRoute)};
  var SELECTED_ID = null;
  var HOVER_ID = null;
  var EDITING_EL = null;

  function parseStudioId(id) {
    if (!id) return null;
    var sep = id.lastIndexOf('::');
    if (sep === -1) return null;
    return { filePath: id.slice(0, sep), elementIndex: Number(id.slice(sep + 2)) };
  }

  function getFriendlyLabel(el) {
    var tag = el.tagName.toLowerCase();
    var text = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3) {
        text += el.childNodes[i].textContent;
      }
    }
    text = text.trim().replace(/\\s+/g, ' ');
    if (text) return tag + ' "' + (text.length > 22 ? text.slice(0, 22) + '...' : text) + '"';
    if (el.id) return tag + '#' + el.id;
    var cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '';
    return cls ? tag + '.' + cls : tag;
  }

  function getDirectText(el) {
    var hasChildEl = false;
    var text = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 1) hasChildEl = true;
      else if (n.nodeType === 3) text += n.textContent;
    }
    return { text: text.trim(), isTextEditable: !hasChildEl || text.trim().length > 0 };
  }

  function buildLayerTree(rootEl) {
    var result = [];
    function walk(node) {
      if (!node || node.nodeType !== 1) return null;
      var sid = node.getAttribute('data-studio-id');
      var childLayers = [];
      for (var i = 0; i < node.children.length; i++) {
        var c = walk(node.children[i]);
        if (c) {
          if (Array.isArray(c)) childLayers = childLayers.concat(c);
          else childLayers.push(c);
        }
      }
      if (!sid) {
        return childLayers;
      }
      var parsed = parseStudioId(sid);
      return {
        studioId: sid,
        filePath: parsed ? parsed.filePath : '',
        elementIndex: parsed ? parsed.elementIndex : 0,
        tagName: node.tagName.toLowerCase(),
        label: getFriendlyLabel(node),
        children: childLayers
      };
    }
    var walked = walk(rootEl);
    if (Array.isArray(walked)) result = walked;
    else if (walked) result = [walked];
    return result;
  }

  function extractSnapshot(el) {
    var sid = el.getAttribute('data-studio-id');
    var parsed = parseStudioId(sid);
    var rect = el.getBoundingClientRect();
    var cs = window.getComputedStyle(el);
    var inlineObj = {};
    for (var i = 0; i < el.style.length; i++) {
      var prop = el.style[i];
      inlineObj[prop] = el.style.getPropertyValue(prop);
    }

    var parentEl = el.parentElement ? el.parentElement.closest('[data-studio-id]') : null;
    var parentSid = parentEl ? parentEl.getAttribute('data-studio-id') : null;
    var rawParentEl = el.parentElement;
    var parentRectRaw = rawParentEl ? rawParentEl.getBoundingClientRect() : null;
    var siblingEls = [];
    var siblingRects = [];
    if (el.parentElement) {
      for (var k = 0; k < el.parentElement.children.length; k++) {
        var childNode = el.parentElement.children[k];
        if (childNode.hasAttribute('data-studio-id')) {
          siblingEls.push(childNode);
          if (childNode !== el) {
            var sr = childNode.getBoundingClientRect();
            if (sr.width > 0 && sr.height > 0) {
              siblingRects.push({ x: sr.left, y: sr.top, width: sr.width, height: sr.height });
            }
          }
        }
      }
    }
    // Also collect major landmark sibling/section rects on the page for richer alignment guides
    var allBench = document.querySelectorAll('section[data-studio-id], article[data-studio-id], header[data-studio-id], footer[data-studio-id], main[data-studio-id]');
    for (var b = 0; b < allBench.length && siblingRects.length < 36; b++) {
      var bel = allBench[b];
      if (bel === el || bel.contains(el) || el.contains(bel)) continue;
      var br = bel.getBoundingClientRect();
      if (br.width > 0 && br.height > 0) {
        siblingRects.push({ x: br.left, y: br.top, width: br.width, height: br.height });
      }
    }
    var siblingIdx = siblingEls.indexOf(el);
    var textMeta = getDirectText(el);

    return {
      studioId: sid,
      filePath: parsed ? parsed.filePath : '',
      elementIndex: parsed ? parsed.elementIndex : 0,
      tagName: el.tagName.toLowerCase(),
      label: getFriendlyLabel(el),
      textContent: textMeta.text,
      isTextEditable: textMeta.isTextEditable,
      className: typeof el.className === 'string' ? el.className : '',
      inlineStyles: inlineObj,
      computedStyles: {
        backgroundImage: cs.backgroundImage,
        backgroundColor: cs.backgroundColor,
        backgroundClip: cs.webkitBackgroundClip || cs.backgroundClip,
        color: cs.color,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textAlign: cs.textAlign,
        width: cs.width,
        height: cs.height,
        paddingTop: cs.paddingTop,
        paddingRight: cs.paddingRight,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        marginTop: cs.marginTop,
        marginRight: cs.marginRight,
        marginBottom: cs.marginBottom,
        marginLeft: cs.marginLeft,
        display: cs.display,
        flexDirection: cs.flexDirection,
        flexWrap: cs.flexWrap,
        flexGrow: cs.flexGrow,
        flexShrink: cs.flexShrink,
        alignSelf: cs.alignSelf,
        gap: cs.gap,
        rowGap: cs.rowGap,
        columnGap: cs.columnGap,
        justifyContent: cs.justifyContent,
        alignItems: cs.alignItems,
        justifyItems: cs.justifyItems,
        gridTemplateColumns: cs.gridTemplateColumns,
        gridTemplateRows: cs.gridTemplateRows,
        position: cs.position,
        top: cs.top,
        right: cs.right,
        bottom: cs.bottom,
        left: cs.left,
        zIndex: cs.zIndex,
        overflow: cs.overflow,
        borderRadius: cs.borderRadius,
        borderWidth: cs.borderTopWidth,
        borderColor: cs.borderTopColor,
        boxShadow: cs.boxShadow,
        opacity: cs.opacity,
        transform: cs.transform
      },
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      parentStudioId: parentSid,
      parentRect: parentRectRaw ? { x: parentRectRaw.left, y: parentRectRaw.top, width: parentRectRaw.width, height: parentRectRaw.height } : null,
      siblingRects: siblingRects,
      viewportSize: { width: window.innerWidth, height: window.innerHeight },
      siblingIndex: siblingIdx,
      siblingCount: siblingEls.length,
      canReorderSiblings: siblingEls.length > 1 && parentSid !== null,
      href: el.getAttribute('href') || undefined,
      src: el.getAttribute('src') || undefined
    };
  }

  function findStudioElement(sid) {
    if (!sid) return null;
    try {
      return document.querySelector('[data-studio-id="' + CSS.escape(sid) + '"]');
    } catch (e) {
      return null;
    }
  }

  function postTree() {
    var root = document.getElementById('root') || document.body;
    window.parent.postMessage({
      type: 'studio:tree',
      tree: buildLayerTree(root),
      activeRoute: ACTIVE_ROUTE
    }, '*');
  }

  function postSelectedRect() {
    if (!SELECTED_ID) return;
    var el = findStudioElement(SELECTED_ID);
    if (!el) return;
    var r = el.getBoundingClientRect();
    window.parent.postMessage({
      type: 'studio:selected-rect',
      studioId: SELECTED_ID,
      rect: { x: r.left, y: r.top, width: r.width, height: r.height }
    }, '*');
  }

  document.addEventListener('mouseover', function(e) {
    if (CURRENT_MODE !== 'design') return;
    var target = e.target && e.target.closest ? e.target.closest('[data-studio-id]') : null;
    if (!target) {
      if (HOVER_ID) {
        HOVER_ID = null;
        window.parent.postMessage({ type: 'studio:hover', studioId: null }, '*');
      }
      return;
    }
    var sid = target.getAttribute('data-studio-id');
    if (sid === SELECTED_ID) {
      window.parent.postMessage({ type: 'studio:hover', studioId: null }, '*');
      return;
    }
    HOVER_ID = sid;
    var r = target.getBoundingClientRect();
    window.parent.postMessage({
      type: 'studio:hover',
      studioId: sid,
      tagName: target.tagName.toLowerCase(),
      rect: { x: r.left, y: r.top, width: r.width, height: r.height }
    }, '*');
  }, true);

  document.addEventListener('mouseleave', function() {
    HOVER_ID = null;
    window.parent.postMessage({ type: 'studio:hover', studioId: null }, '*');
  });

  document.addEventListener('click', function(e) {
    if (CURRENT_MODE === 'interact') {
      var link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (link) {
        var href = link.getAttribute('href');
        if (href && (href.startsWith('/') || href.endsWith('.html'))) {
          e.preventDefault();
          window.parent.postMessage({ type: 'studio:navigate', route: href }, '*');
        }
      }
      return;
    }

    if (EDITING_EL && EDITING_EL.contains(e.target)) {
      return;
    }

    var target = e.target && e.target.closest ? e.target.closest('[data-studio-id]') : null;
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();

    SELECTED_ID = target.getAttribute('data-studio-id');
    window.parent.postMessage({
      type: 'studio:select',
      element: extractSnapshot(target)
    }, '*');
  }, true);

  document.addEventListener('dblclick', function(e) {
    if (CURRENT_MODE !== 'design') return;
    var target = e.target && e.target.closest ? e.target.closest('[data-studio-id]') : null;
    if (!target) return;
    var textMeta = getDirectText(target);
    if (!textMeta.isTextEditable || target.children.length > 0) return;

    e.preventDefault();
    e.stopPropagation();
    EDITING_EL = target;
    var originalText = target.textContent;
    target.setAttribute('contenteditable', 'true');
    target.style.outline = '2px solid #2563EB';
    target.focus();

    function finishEdit(save) {
      target.removeAttribute('contenteditable');
      target.style.outline = '';
      target.removeEventListener('blur', onBlur);
      target.removeEventListener('keydown', onKeyDown);
      EDITING_EL = null;
      if (save) {
        var nextText = target.textContent || '';
        if (nextText !== originalText) {
          window.parent.postMessage({
            type: 'studio:inline-text',
            studioId: target.getAttribute('data-studio-id'),
            textContent: nextText
          }, '*');
        }
      } else {
        target.textContent = originalText;
      }
    }
    function onBlur() { finishEdit(true); }
    function onKeyDown(ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        finishEdit(true);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        finishEdit(false);
      }
    }
    target.addEventListener('blur', onBlur);
    target.addEventListener('keydown', onKeyDown);
  }, true);

  window.addEventListener('scroll', postSelectedRect, true);
  window.addEventListener('resize', postSelectedRect);

  window.addEventListener('message', function(ev) {
    var msg = ev.data || {};
    if (msg.type === 'studio:set-mode') {
      CURRENT_MODE = msg.mode;
    } else if (msg.type === 'studio:select-by-id') {
      var el = findStudioElement(msg.studioId);
      if (el) {
        SELECTED_ID = msg.studioId;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(function() {
          window.parent.postMessage({
            type: 'studio:select',
            element: extractSnapshot(el)
          }, '*');
        }, 60);
      }
    } else if (msg.type === 'studio:preview-style') {
      var el2 = findStudioElement(msg.studioId);
      if (el2 && msg.styles) {
        Object.keys(msg.styles).forEach(function(k) {
          var v = msg.styles[k];
          if (v === null || v === '') {
            el2.style[k] = '';
          } else {
            el2.style[k] = v;
          }
        });
        postSelectedRect();
      }
    } else if (msg.type === 'studio:drag-probe') {
      var dragEl = findStudioElement(msg.studioId);
      if (!dragEl || !dragEl.parentElement) return;
      var siblings = [];
      for (var i = 0; i < dragEl.parentElement.children.length; i++) {
        var ch = dragEl.parentElement.children[i];
        if (ch.hasAttribute('data-studio-id')) siblings.push(ch);
      }
      if (siblings.length < 2) return;
      var bestIdx = siblings.indexOf(dragEl);
      var bestDist = Infinity;
      var indicatorRect = null;
      var parentCs = window.getComputedStyle(dragEl.parentElement);
      var isHorizontal = (parentCs.display === 'flex' && parentCs.flexDirection.startsWith('row')) || parentCs.display === 'grid';

      siblings.forEach(function(sib, idx) {
        var r = sib.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var d = Math.hypot(msg.x - cx, msg.y - cy);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
          if (isHorizontal) {
            var after = msg.x > cx;
            indicatorRect = {
              x: after ? r.right + 2 : r.left - 4,
              y: r.top,
              width: 3,
              height: r.height
            };
          } else {
            var afterY = msg.y > cy;
            indicatorRect = {
              x: r.left,
              y: afterY ? r.bottom + 2 : r.top - 4,
              width: r.width,
              height: 3
            };
          }
        }
      });

      window.parent.postMessage({
        type: 'studio:drop-target',
        targetIndex: bestIdx,
        indicatorRect: indicatorRect
      }, '*');
    } else if (msg.type === 'studio:ping-tree') {
      postTree();
      if (SELECTED_ID) {
        var sel = findStudioElement(SELECTED_ID);
        if (sel) {
          window.parent.postMessage({
            type: 'studio:select',
            element: extractSnapshot(sel)
          }, '*');
        }
      }
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(postTree, 50);
  } else {
    window.addEventListener('DOMContentLoaded', function() { setTimeout(postTree, 50); });
  }
})();
`;
}

export function buildPreviewDocument(
  project: VirtualProject,
  activePage: ProjectPage,
  compiledTailwindCss: string,
  interactionMode: 'design' | 'interact',
  selectedStudioId: string | null,
  options?: { isolateComponent?: boolean }
): CompiledPreviewBundle {
  const compileErrors: string[] = [];
  const isolateComponent = Boolean(options?.isolateComponent);

  // Pure HTML mode
  if (project.framework === 'html' || /\.html?$/i.test(activePage.filePath)) {
    const rawHtml = project.files[activePage.filePath] || '<div>Empty HTML page</div>';
    const instrumentedHtml = instrumentSourceWithStudioIds(rawHtml, activePage.filePath, true);
    const cssParts = project.globalCssPaths
      .map((p) => project.files[p] || '')
      .join('\n');
    const bridge = buildDesignerBridgeScript(activePage.route, interactionMode);
    const injection = `<style>${compiledTailwindCss}\n${cssParts}</style><script>${escapeScriptClose(
      bridge
    )}</script>`;

    let finalHtml = instrumentedHtml;
    if (/<\/head>/i.test(finalHtml)) {
      finalHtml = finalHtml.replace(/<\/head>/i, `${injection}</head>`);
    } else {
      finalHtml = `<!doctype html><html><head>${injection}</head><body>${finalHtml}</body></html>`;
    }
    if (selectedStudioId) {
      finalHtml = finalHtml.replace(
        /<\/body>/i,
        `<script>setTimeout(function(){window.postMessage({type:'studio:select-by-id',studioId:${JSON.stringify(
          selectedStudioId
        )}},'*')},120);</script></body>`
      );
    }
    return { html: finalHtml, compileErrors };
  }

  // React / Next.js TSX/JSX bundle mode
  const compiledModules: Record<string, string> = {};
  const cssContent = project.globalCssPaths
    .map((p) => {
      const css = project.files[p] || '';
      // Strip Tailwind directives since compiledTailwindCss already includes full compiled CSS
      return css
        .replace(/@import\s+["']tailwindcss["']\s*;/g, '')
        .replace(/@tailwind\s+[^;]+;/g, '');
    })
    .join('\n');

  const sourceEntries = Object.entries(project.files).filter(([path]) =>
    /\.(tsx|ts|jsx|js)$/i.test(path)
  );

  for (const [filePath, code] of sourceEntries) {
    const isJsx = /\.(tsx|jsx)$/i.test(filePath);
    const instrumented = isJsx
      ? instrumentSourceWithStudioIds(code, filePath, false)
      : code;

    try {
      const transformed = transform(instrumented, {
        transforms: ['typescript', 'jsx', 'imports'],
        jsxRuntime: 'classic',
        jsxPragma: 'React.createElement',
        jsxFragmentPragma: 'React.Fragment',
        filePath,
      });
      compiledModules[filePath] = transformed.code;
    } catch (err) {
      compileErrors.push(
        `${filePath}: ${err instanceof Error ? err.message : 'Transform failed'}`
      );
    }
  }

  // Build resolution lookup map so the iframe's require() resolves relative & alias imports
  const resolutionMap: Record<string, Record<string, string>> = {};
  for (const [filePath] of sourceEntries) {
    const code = project.files[filePath];
    const imports: Record<string, string> = {};
    const importRegex = /(?:from|require\()\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(code)) !== null) {
      const spec = m[1];
      if (spec.startsWith('.') || spec.startsWith('@/')) {
        const resolved = resolveVirtualModulePath(filePath, spec, project.files);
        if (resolved) imports[spec] = resolved;
      }
    }
    resolutionMap[filePath] = imports;
  }

  const runtimeScript = `
(function bootStudioRuntime() {
  var RT = window.parent && window.parent.__STUDIO_RUNTIME__;
  if (!RT || !RT.React || !RT.ReactDOMClient) {
    setTimeout(bootStudioRuntime, 16);
    return;
  }
  var React = RT.React;
  var ReactDOMClient = RT.ReactDOMClient;
  var LucideIcons = RT.LucideIcons || {};
  var MODULES = ${escapeScriptClose(JSON.stringify(compiledModules))};
  var RES_MAP = ${escapeScriptClose(JSON.stringify(resolutionMap))};
  var JSON_FILES = ${escapeScriptClose(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(project.files).filter(([p]) => p.endsWith('.json'))
      )
    )
  )};
  var ACTIVE_ROUTE = ${JSON.stringify(activePage.route)};
  var ENTRY_FILE = ${JSON.stringify(activePage.filePath)};
  var ISOLATE_COMPONENT = ${JSON.stringify(isolateComponent)};
  var LAYOUT_FILE = ${JSON.stringify(
    isolateComponent
      ? null
      : ['app/layout.tsx', 'app/layout.jsx', 'src/app/layout.tsx', 'src/app/layout.jsx'].find(
          (p) => Boolean(project.files[p])
        ) || null
  )};
  var CACHE = {};

  // Wrap React.createElement so Next.js RootLayout <html> and <body> render safely inside #root
  var StudioReact = Object.assign({}, React, {
    createElement: function(type, props) {
      var args = Array.prototype.slice.call(arguments, 2);
      if (type === 'html' || type === 'body') {
        var nextProps = props ? Object.assign({}, props) : {};
        delete nextProps.lang;
        delete nextProps.suppressHydrationWarning;
        return React.createElement.apply(React, ['div', nextProps].concat(args));
      }
      return React.createElement.apply(React, [type, props].concat(args));
    }
  });

  function createFallbackProxy(label) {
    var fn = function FallbackComponent(props) {
      return props && props.children ? React.createElement('div', { 'data-fallback': label }, props.children) : null;
    };
    return new Proxy(fn, {
      get: function(target, prop) {
        if (prop === '__esModule') return true;
        if (prop === 'default') return fn;
        if (prop === 'then') return undefined;
        return createFallbackProxy(String(prop));
      },
      apply: function() {
        return createFallbackProxy(label);
      }
    });
  }

  var MotionProxy = new Proxy({}, {
    get: function(_, tag) {
      if (tag === '__esModule') return true;
      var elTag = typeof tag === 'string' ? tag : 'div';
      return React.forwardRef(function MotionWrapper(props, ref) {
        var clean = {};
        if (props) {
          Object.keys(props).forEach(function(k) {
            if (['initial','animate','exit','transition','whileHover','whileTap','whileInView','variants','viewport','layout','layoutId'].indexOf(k) === -1) {
              clean[k] = props[k];
            }
          });
        }
        clean.ref = ref;
        return React.createElement(elTag, clean);
      });
    }
  });

  var LucideProxy = new Proxy({}, {
    get: function(_, name) {
      if (name === '__esModule') return true;
      if (LucideIcons[name]) return LucideIcons[name];
      if (LucideIcons.Box) return LucideIcons.Box;
      return function IconStub() { return React.createElement('span', { className: 'inline-block w-4 h-4' }); };
    }
  });

  var LinkStub = function Link(props) {
    var href = typeof props.href === 'string' ? props.href : '#';
    var clean = Object.assign({}, props, {
      href: href,
      onClick: function(e) {
        if (props.onClick) props.onClick(e);
      }
    });
    return React.createElement('a', clean, props.children);
  };

  function createSupabaseStub() {
    var emptyResult = { data: [], error: null };
    var singleResult = { data: null, error: null };
    var chainTarget = function() {};
    var chain = new Proxy(chainTarget, {
      get: function(_, prop) {
        if (prop === 'then') {
          return function(res, rej) { return Promise.resolve(emptyResult).then(res, rej); };
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return function() { return Promise.resolve(singleResult); };
        }
        return function() { return chain; };
      }
    });
    return {
      from: function() { return chain; },
      rpc: function() { return Promise.resolve(emptyResult); },
      storage: {
        from: function() {
          return {
            getPublicUrl: function() { return { data: { publicUrl: '' } }; },
            upload: function() { return Promise.resolve(singleResult); },
            list: function() { return Promise.resolve(emptyResult); }
          };
        }
      },
      channel: function() {
        return { on: function() { return this; }, subscribe: function() { return { unsubscribe: function(){} }; } };
      },
      removeChannel: function() {},
      auth: {
        getSession: function() { return Promise.resolve({ data: { session: null }, error: null }); },
        getUser: function() { return Promise.resolve({ data: { user: null }, error: null }); },
        signOut: function() { return Promise.resolve({ error: null }); },
        onAuthStateChange: function() { return { data: { subscription: { unsubscribe: function(){} } } }; }
      }
    };
  }

  function createZustandStub(initializer) {
    var state;
    var listeners = new Set();
    var setState = function(partial) {
      var next = typeof partial === 'function' ? partial(state) : partial;
      state = Object.assign({}, state, next);
      listeners.forEach(function(l) { l(state); });
    };
    var getState = function() { return state; };
    state = typeof initializer === 'function' ? initializer(setState, getState, {}) : {};
    return function useStore(selector) {
      var snap = React.useState(0);
      React.useEffect(function() {
        var l = function() { snap[1](function(n) { return n + 1; }); };
        listeners.add(l);
        return function() { listeners.delete(l); };
      }, []);
      return selector ? selector(state) : state;
    };
  }

  function resolveBuiltIn(spec) {
    if (spec === 'react') return StudioReact;
    if (spec === 'react-dom') return ReactDOMClient;
    if (spec === 'react-dom/client') return ReactDOMClient;
    if (spec === 'lucide-react') return LucideProxy;
    if (spec === 'motion/react' || spec === 'framer-motion') {
      return {
        motion: MotionProxy,
        AnimatePresence: function(p) { return p.children || null; },
        MotionConfig: function(p) { return p.children || null; },
        useScroll: function() { return { scrollY: { get: function(){return 0;} }, scrollYProgress: { get: function(){return 0;} } }; },
        useTransform: function() { return 0; },
        useSpring: function(v) { return v; },
        useInView: function() { return true; }
      };
    }
    if (spec === 'next/link') return { __esModule: true, default: LinkStub };
    if (spec === 'next/image') {
      return {
        __esModule: true,
        default: function NextImage(p) {
          var clean = Object.assign({}, p);
          delete clean.fill; delete clean.priority; delete clean.unoptimized; delete clean.quality;
          return React.createElement('img', clean);
        }
      };
    }
    if (spec === 'next/navigation') {
      return {
        useRouter: function() {
          return {
            push: function(r) { window.parent.postMessage({ type: 'studio:navigate', route: r }, '*'); },
            replace: function(r) { window.parent.postMessage({ type: 'studio:navigate', route: r }, '*'); },
            back: function() {},
            refresh: function() {}
          };
        },
        usePathname: function() { return ACTIVE_ROUTE; },
        useSearchParams: function() { return new URLSearchParams(); },
        useParams: function() { return {}; },
        redirect: function() {},
        notFound: function() {}
      };
    }
    if (spec.startsWith('next/font')) {
      return new Proxy({}, {
        get: function() {
          return function() { return { className: '', variable: '', style: {} }; };
        }
      });
    }
    if (spec === 'clsx') {
      return {
        __esModule: true,
        default: function clsx() {
          return Array.from(arguments).flat().filter(Boolean).join(' ');
        },
        clsx: function clsx() {
          return Array.from(arguments).flat().filter(Boolean).join(' ');
        }
      };
    }
    if (spec === 'tailwind-merge') {
      return {
        twMerge: function() { return Array.from(arguments).filter(Boolean).join(' '); }
      };
    }
    if (spec === 'zustand') {
      return {
        __esModule: true,
        create: function(init) { return init ? createZustandStub(init) : function(i) { return createZustandStub(i); }; }
      };
    }
    if (spec === 'zustand/middleware') {
      return { persist: function(fn) { return fn; } };
    }
    if (spec === '@supabase/supabase-js') {
      return { createClient: createSupabaseStub };
    }
    if (/\\.(css|scss|sass|less)$/i.test(spec)) {
      return {};
    }
    return null;
  }

  function loadModule(filePath) {
    if (CACHE[filePath]) return CACHE[filePath].exports;
    if (JSON_FILES[filePath]) {
      var parsed = JSON.parse(JSON_FILES[filePath]);
      CACHE[filePath] = { exports: parsed };
      return parsed;
    }
    var code = MODULES[filePath];
    if (!code) return createFallbackProxy(filePath);

    var mod = { exports: {} };
    CACHE[filePath] = mod;
    var localRequire = function(spec) {
      var builtIn = resolveBuiltIn(spec);
      if (builtIn) return builtIn;
      var resolved = RES_MAP[filePath] && RES_MAP[filePath][spec];
      if (resolved) return loadModule(resolved);
      return createFallbackProxy(spec);
    };

    try {
      var fn = new Function('require', 'module', 'exports', 'React', 'process', code);
      fn(localRequire, mod, mod.exports, StudioReact, { env: {} });
    } catch (err) {
      console.error('Module error in ' + filePath + ':', err);
      mod.exports = {
        __esModule: true,
        default: function ErrorView() {
          return React.createElement('div', {
            style: { padding: '24px', margin: '24px', border: '1px solid #fecaca', borderRadius: '12px', background: '#fef2f2', color: '#991b1b', fontFamily: 'sans-serif' }
          }, 'Preview render notice in ' + filePath + ': ' + (err && err.message ? err.message : String(err)));
        }
      };
    }
    return mod.exports;
  }

  function AsyncBridge(props) {
    var Comp = props.Comp;
    var state = React.useState(null);
    React.useEffect(function() {
      var mounted = true;
      Promise.resolve(Comp({ params: {}, searchParams: {} })).then(function(el) {
        if (mounted) state[1](el);
      }).catch(function(e) {
        if (mounted) state[1](React.createElement('div', { style: { padding: 24, color: '#991b1b' } }, String(e)));
      });
      return function() { mounted = false; };
    }, [Comp]);
    return state[0] || React.createElement('div', { style: { padding: 32, color: '#64748b' } }, 'Rendering page...');
  }

  class StudioErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
      return { error: error };
    }
    render() {
      if (this.state.error) {
        return React.createElement('div', {
          style: { padding: '24px', margin: '24px', border: '1px solid #fecaca', borderRadius: '12px', background: '#fef2f2', color: '#991b1b', fontFamily: 'sans-serif', fontSize: '14px' }
        }, 'Component preview fallback: ' + (this.state.error.message || String(this.state.error)));
      }
      return this.props.children;
    }
  }

  function StudioRoot() {
    var pageMod = loadModule(ENTRY_FILE);
    var PageComp = pageMod.default || pageMod;
    if (typeof PageComp !== 'function') {
      var firstFn = Object.values(pageMod).find(function(v) { return typeof v === 'function'; });
      PageComp = firstFn || function() { return React.createElement('div', { style: { padding: 32 } }, 'No default React component exported by ' + ENTRY_FILE); };
    }
    var pageNode = (PageComp.constructor && PageComp.constructor.name === 'AsyncFunction')
      ? React.createElement(AsyncBridge, { Comp: PageComp })
      : React.createElement(PageComp, { params: {}, searchParams: {} });

    if (ISOLATE_COMPONENT) {
      return React.createElement(
        StudioErrorBoundary,
        null,
        React.createElement(
          'div',
          { className: 'min-h-screen bg-slate-50 p-8' },
          pageNode
        )
      );
    }

    if (LAYOUT_FILE && ENTRY_FILE !== LAYOUT_FILE) {
      var layoutMod = loadModule(LAYOUT_FILE);
      var LayoutComp = layoutMod && (layoutMod.default || Object.values(layoutMod).find(function(v) { return typeof v === 'function'; }));
      if (typeof LayoutComp === 'function') {
        return React.createElement(
          StudioErrorBoundary,
          null,
          React.createElement(LayoutComp, { children: pageNode })
        );
      }
    }
    return React.createElement(StudioErrorBoundary, null, pageNode);
  }

  var rootNode = document.getElementById('root');
  if (rootNode) {
    ReactDOMClient.createRoot(rootNode).render(React.createElement(StudioRoot));
    setTimeout(function() {
      window.postMessage({ type: 'studio:ping-tree' }, '*');
      if (${JSON.stringify(Boolean(selectedStudioId))}) {
        window.postMessage({ type: 'studio:select-by-id', studioId: ${JSON.stringify(selectedStudioId)} }, '*');
      }
    }, 120);
  }
})();
`;

  const bridgeScript = buildDesignerBridgeScript(activePage.route, interactionMode);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${compiledTailwindCss}\n${cssContent}</style>
</head>
<body>
  <div id="root"></div>
  <script>${escapeScriptClose(runtimeScript)}</script>
  <script>${escapeScriptClose(bridgeScript)}</script>
</body>
</html>`;

  return { html, compileErrors };
}
