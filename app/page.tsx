'use client';

import dynamic from 'next/dynamic';

const StudioWorkspace = dynamic(
  () => import('@/components/studio/StudioWorkspace'),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading WebD Studio…
      </main>
    ),
  }
);

export default function HomePage() {
  return <StudioWorkspace />;
}
