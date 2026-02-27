import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;

  const org = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
    select: { name: true },
  });

  const orgName = org?.name || slug;

  return {
    title: {
      template: `%s — ${orgName} | RadBooks`,
      default: `${orgName} | RadBooks`,
    },
  };
}

export default function OrgSlugLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
