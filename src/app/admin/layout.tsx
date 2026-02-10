import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TopNavWrapper } from '@/components/navigation/TopNavWrapper';
import { getPlatformAdminNavLinks } from '@/lib/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  // Find user and check if they're a platform admin
  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
    select: {
      id: true,
      name: true,
      isPlatformAdmin: true,
    },
  });

  // Check platform admin status from user field
  if (!user || !user.isPlatformAdmin) {
    redirect('/');
  }

  const navLinks = getPlatformAdminNavLinks();

  return (
    <>
      <TopNavWrapper navLinks={navLinks} />
      <div className="min-h-screen bg-gray-50">
        <main>{children}</main>
      </div>
    </>
  );
}
