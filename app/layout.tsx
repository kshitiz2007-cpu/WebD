import type { Metadata } from 'next';
import './globals.css';


export const metadata: Metadata = {
  title: 'Atelier Studio — Visual Web Code Designer',
  description:
    'Upload a project ZIP or import a GitHub repository to visually edit, resize, drag layout, and apply 3-stop & 4-stop hex gradients synced directly to your codebase.',
  openGraph: {
    title: 'Atelier Studio — Visual Web Code Designer',
    description:
      'Visual web designer that runs your project pages, lets you tap, resize, drag-reorder, and restyle with multi-stop gradients directly into the source code.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Atelier Studio — Visual Web Code Designer',
    description:
      'Visual web designer with live multi-page preview, drag layout, and 3-stop/4-stop hex gradient builder.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ '--font-sans': 'Arial, Helvetica, sans-serif', '--font-mono': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } as React.CSSProperties}>
      <body className="font-sans antialiased bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
