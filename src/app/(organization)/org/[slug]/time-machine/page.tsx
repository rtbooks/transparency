import type { Metadata } from 'next';
import TimeMachineClient from './TimeMachineClient';

export const metadata: Metadata = { title: 'Time Machine' };

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TimeMachinePage({ params }: PageProps) {
  const resolvedParams = await params;
  return <TimeMachineClient params={resolvedParams} />;
}
