import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { VerificationList } from "@/components/admin/VerificationList";

export default async function VerificationsPage() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect("/login");
  }

  // Check if user is platform admin
  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
  });

  if (!user || !user.isPlatformAdmin) {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Organization Verifications</h1>
        <p className="mt-2 text-gray-600">
          Review and approve pending organization registrations
        </p>
      </div>

      <VerificationList />
    </div>
  );
}
