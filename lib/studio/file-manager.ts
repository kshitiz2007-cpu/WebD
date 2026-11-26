export const SUPPORTED_SOURCE_FILE_EXTENSIONS = new Set([
  'tsx','ts','jsx','js','css','scss','json','md','mdx','html','htm','svg','txt','yaml','yml'
]);

export function normalizeProjectFilePath(input: string): string {
  const raw = input.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!raw || raw.length > 240) throw new Error('Enter a valid file path (maximum 240 characters).');
  const segments = raw.split('/');
  if (segments.some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Path traversal and empty folder names are not allowed.');
  }
  if (segments.some((part) => /[<>:"|?*\u0000-\u001f]/.test(part))) {
    throw new Error('The path contains characters that are not supported.');
  }
  const fileName = segments[segments.length - 1];
  if (fileName === '.gitkeep') return segments.join('/');
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  if (!SUPPORTED_SOURCE_FILE_EXTENSIONS.has(extension)) {
    throw new Error('Supported files: TSX, TS, JSX, JS, CSS, JSON, MD, MDX, HTML, SVG, TXT, YAML.');
  }
  return segments.join('/');
}

export function getFileDirectory(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index < 0 ? '' : normalized.slice(0, index);
}

export function getProjectFileTree(files: Record<string, string>) {
  type Node = { name: string; path: string; kind: 'folder' | 'file'; children: Node[] };
  const root: Node = { name: '', path: '', kind: 'folder', children: [] };
  for (const path of Object.keys(files).sort((a, b) => a.localeCompare(b))) {
    const parts = path.split('/');
    let current = root;
    parts.forEach((part, index) => {
      const nodePath = parts.slice(0, index + 1).join('/');
      let child = current.children.find((node) => node.name === part);
      const isFile = index === parts.length - 1;
      if (!child) {
        child = { name: part, path: nodePath, kind: isFile ? 'file' : 'folder', children: [] };
        current.children.push(child);
      }
      current = child;
    });
  }
  const sortNodes = (nodes: Node[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(root.children);
  return root.children;
}

export function createProjectFile(files: Record<string, string>, rawPath: string, content = '') {
  const path = normalizeProjectFilePath(rawPath);
  if (Object.prototype.hasOwnProperty.call(files, path)) throw new Error('A file already exists at this path.');
  const nextFiles = { ...files, [path]: content };
  return { files: nextFiles, path };
}

export function renameProjectFile(files: Record<string, string>, oldPath: string, rawNewPath: string) {
  const newPath = normalizeProjectFilePath(rawNewPath);
  if (!Object.prototype.hasOwnProperty.call(files, oldPath)) throw new Error('The source file no longer exists.');
  if (oldPath === newPath) return files;
  if (Object.prototype.hasOwnProperty.call(files, newPath)) throw new Error('A file already exists at the destination.');
  return Object.fromEntries(Object.entries(files).map(([path, content]) => [path === oldPath ? newPath : path, content]));
}

export function deleteProjectFile(files: Record<string, string>, path: string) {
  if (!Object.prototype.hasOwnProperty.call(files, path)) throw new Error('The file no longer exists.');
  const nextFiles = { ...files };
  delete nextFiles[path];
  return nextFiles;
}

export function renameProjectFolder(files: Record<string, string>, oldFolder: string, rawNewFolder: string) {
  const folder = rawNewFolder.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!folder || folder.split('/').some((part) => !part || part === '.' || part === '..') || /[<>:"|?*\u0000-\u001f]/.test(folder)) {
    throw new Error('Enter a valid folder path.');
  }
  const prefix = oldFolder.replace(/\\/g, '/').replace(/\/+$/g, '') + '/';
  const matches = Object.keys(files).filter((path) => path.startsWith(prefix));
  if (matches.length === 0) throw new Error('The folder is empty or no longer exists.');
  const next = { ...files };
  for (const oldPath of matches) {
    const newPath = folder + oldPath.slice(oldFolder.length);
    if (Object.prototype.hasOwnProperty.call(files, newPath) && !matches.includes(newPath)) {
      throw new Error('A file already exists in the destination folder.');
    }
  }
  for (const oldPath of matches) delete next[oldPath];
  for (const oldPath of matches) next[folder + oldPath.slice(oldFolder.length)] = files[oldPath];
  return next;
}
