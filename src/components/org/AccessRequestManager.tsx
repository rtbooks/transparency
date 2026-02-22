'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface AccessRequestItem {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface AccessRequestManagerProps {
  organizationSlug: string;
}

export function AccessRequestManager({ organizationSlug }: AccessRequestManagerProps) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<AccessRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationSlug}/access-requests`);
      if (!res.ok) return;
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      // Silently fail - section is optional
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [organizationSlug]);

  const handleReview = async (requestId: string, action: 'approve' | 'deny') => {
    try {
      setProcessingId(requestId);
      const res = await fetch(
        `/api/organizations/${organizationSlug}/access-requests/${requestId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process request');
      }

      toast({
        title: action === 'approve' ? 'Request Approved' : 'Request Denied',
        description: action === 'approve'
          ? 'The user has been added as a donor.'
          : 'The access request has been denied.',
      });

      // Remove from list
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Access Requests</h2>
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Access Requests</h2>
        {requests.length > 0 && (
          <Badge variant="destructive">{requests.length} pending</Badge>
        )}
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-gray-500">No pending access requests.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-start justify-between rounded-lg border p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{request.user.name}</p>
                  <Badge variant="outline">
                    <Clock className="mr-1 h-3 w-3" />
                    Pending
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{request.user.email}</p>
                {request.message && (
                  <p className="mt-2 text-sm text-gray-700 italic">
                    "{request.message}"
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Requested {new Date(request.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleReview(request.id, 'deny')}
                  disabled={processingId === request.id}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Deny
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleReview(request.id, 'approve')}
                  disabled={processingId === request.id}
                >
                  {processingId === request.id ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-1 h-4 w-4" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
