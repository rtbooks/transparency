"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { formatDistance } from "date-fns";

interface PendingOrganization {
  id: string;
  name: string;
  slug: string;
  ein: string | null;
  mission: string | null;
  createdAt: string;
  einVerifiedAt: string | null;
  organizationUsers: Array<{
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

export function VerificationList() {
  const [organizations, setOrganizations] = useState<PendingOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingOrganizations();
  }, []);

  const fetchPendingOrganizations = async () => {
    try {
      const response = await fetch("/api/admin/verifications");
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      }
    } catch (error) {
      console.error("Error fetching pending organizations:", error);
      toast({
        title: "Error",
        description: "Failed to load pending organizations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orgId: string, orgName: string) => {
    try {
      setProcessingId(orgId);

      const response = await fetch(`/api/admin/organizations/${orgId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes[orgId] || "" }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve organization");
      }

      toast({
        title: "Organization Approved",
        description: `${orgName} has been approved and is now live!`,
      });

      // Remove from list
      setOrganizations((orgs) => orgs.filter((org) => org.id !== orgId));
    } catch (error) {
      console.error("Error approving organization:", error);
      toast({
        title: "Error",
        description: "Failed to approve organization",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (orgId: string, orgName: string) => {
    const reason = notes[orgId];
    
    if (!reason || reason.trim().length === 0) {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessingId(orgId);

      const response = await fetch(`/api/admin/organizations/${orgId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject organization");
      }

      toast({
        title: "Organization Rejected",
        description: `${orgName} has been rejected`,
      });

      // Remove from list
      setOrganizations((orgs) => orgs.filter((org) => org.id !== orgId));
    } catch (error) {
      console.error("Error rejecting organization:", error);
      toast({
        title: "Error",
        description: "Failed to reject organization",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">No organizations pending verification</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {organizations.map((org) => {
        const admin = org.organizationUsers[0]?.user;
        const createdAgo = formatDistance(new Date(org.createdAt), new Date(), {
          addSuffix: true,
        });

        return (
          <Card key={org.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl">{org.name}</CardTitle>
                  <CardDescription className="mt-2">
                    Submitted {createdAgo}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  Pending Verification
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Organization Details */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">
                    Organization Info
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Slug:</span>
                      <code className="rounded bg-gray-100 px-2 py-0.5">
                        /org/{org.slug}
                      </code>
                      <a
                        href={`/org/${org.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    {org.ein && (
                      <div>
                        <span className="text-gray-600">EIN:</span>{" "}
                        <span className="font-mono">{org.ein}</span>
                        {org.einVerifiedAt && (
                          <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                            ✓ Verified via ProPublica
                          </Badge>
                        )}
                      </div>
                    )}
                    {org.mission && (
                      <div>
                        <span className="text-gray-600">Mission:</span>
                        <p className="text-gray-900 mt-1">{org.mission}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">
                    Organization Admin
                  </h4>
                  {admin ? (
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-gray-600">Name:</span>{" "}
                        <span className="font-medium">{admin.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Email:</span>{" "}
                        <a
                          href={`mailto:${admin.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {admin.email}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No admin assigned</p>
                  )}
                </div>
              </div>

              {/* Notes / Reason */}
              <div>
                <label
                  htmlFor={`notes-${org.id}`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Notes / Rejection Reason
                </label>
                <Textarea
                  id={`notes-${org.id}`}
                  placeholder="Add notes about verification or reason for rejection..."
                  rows={3}
                  value={notes[org.id] || ""}
                  onChange={(e) =>
                    setNotes({ ...notes, [org.id]: e.target.value })
                  }
                  disabled={processingId === org.id}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => handleApprove(org.id, org.name)}
                  disabled={processingId === org.id}
                  className="flex-1"
                >
                  {processingId === org.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Approve Organization
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(org.id, org.name)}
                  disabled={processingId === org.id}
                  className="flex-1"
                >
                  {processingId === org.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
