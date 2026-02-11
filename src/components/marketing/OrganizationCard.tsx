"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  verificationStatus: string;
  _count: {
    transactions: number;
  };
}

interface OrganizationCardProps {
  organization: Organization;
}

export function OrganizationCard({ organization: org }: OrganizationCardProps) {
  const router = useRouter();

  const handlePublicPageClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/org/${org.slug}`);
  };

  // Determine verification status display
  const getVerificationBadge = () => {
    switch (org.verificationStatus) {
      case "VERIFIED":
        return {
          text: "Verified",
          color: "bg-green-100 text-green-800",
          icon: "✓",
        };
      case "PENDING_VERIFICATION":
        return {
          text: "Pending Review",
          color: "bg-yellow-100 text-yellow-800",
          icon: "⏳",
        };
      case "VERIFICATION_FAILED":
        return {
          text: "Verification Failed",
          color: "bg-red-100 text-red-800",
          icon: "✗",
        };
      case "SUSPENDED":
        return {
          text: "Suspended",
          color: "bg-gray-100 text-gray-800",
          icon: "⊘",
        };
      default:
        return {
          text: "Unknown",
          color: "bg-gray-100 text-gray-800",
          icon: "?",
        };
    }
  };

  const badge = getVerificationBadge();
  const isVerified = org.verificationStatus === "VERIFIED";

  return (
    <Link
      href={`/org/${org.slug}/dashboard`}
      className="group rounded-lg border border-gray-200 p-6 transition-shadow hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="mb-1 text-xl font-semibold text-gray-900 group-hover:text-blue-600">
            {org.name}
          </h3>
          <p className="mb-3 text-sm text-gray-500">
            {org._count.transactions} transactions
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.color}`}>
            {badge.icon} {badge.text}
          </span>
        </div>
      </div>
      <div className="mt-4 flex gap-4 border-t pt-4">
        <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">
          Open Dashboard →
        </span>
        {isVerified && (
          <button
            onClick={handlePublicPageClick}
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            View Public Page
          </button>
        )}
      </div>
    </Link>
  );
}
