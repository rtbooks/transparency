'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, DollarSign, TrendingUp, TrendingDown, UserPlus, Clock, ArrowRight, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils/account-tree';

interface PublicOrgContentProps {
  organization: {
    name: string;
    slug: string;
    mission: string | null;
    ein: string | null;
    donorAccessMode: string;
  };
  financials: {
    transactionCount: number;
    totalRevenue: number;
    totalExpenses: number;
  };
  userState: 'anonymous' | 'member' | 'pending_request' | 'can_request';
}

export function PublicOrgContent({
  organization,
  financials,
  userState,
}: PublicOrgContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserState, setCurrentUserState] = useState(userState);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch(`/api/organizations/${organization.slug}/campaigns`);
        if (res.ok) {
          const data = await res.json();
          setCampaigns((data.campaigns || []).filter((c: any) => c.status === 'ACTIVE'));
        }
      } catch (e) {
        // Ignore
      }
    }
    fetchCampaigns();
  }, [organization.slug]);

  const netIncome = financials.totalRevenue - financials.totalExpenses;

  const handleAccessRequest = async () => {
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/organizations/${organization.slug}/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: requestMessage || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit request');
      }

      const result = await res.json();

      if (result.autoApproved) {
        toast({
          title: 'Welcome!',
          description: 'Your access has been approved. Redirecting to dashboard...',
        });
        setCurrentUserState('member');
        setTimeout(() => {
          router.push(`/org/${organization.slug}/dashboard`);
        }, 1500);
      } else {
        toast({
          title: 'Request Submitted',
          description: "You'll be notified when your request is reviewed.",
        });
        setCurrentUserState('pending_request');
      }

      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-4xl font-bold text-gray-900">
              {organization.name}
            </h1>
            <Shield className="h-7 w-7 text-green-600" />
          </div>
          {organization.ein && (
            <p className="mt-1 text-sm text-gray-500">EIN: {organization.ein}</p>
          )}
          {organization.mission && (
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              {organization.mission}
            </p>
          )}
        </div>

        {/* Financial Summary */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-lg border bg-white p-6 text-center">
            <TrendingUp className="mx-auto h-8 w-8 text-green-600" />
            <p className="mt-2 text-sm text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(financials.totalRevenue)}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-6 text-center">
            <TrendingDown className="mx-auto h-8 w-8 text-red-600" />
            <p className="mt-2 text-sm text-gray-600">Total Expenses</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(financials.totalExpenses)}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-6 text-center">
            <DollarSign className="mx-auto h-8 w-8 text-blue-600" />
            <p className="mt-2 text-sm text-gray-600">Net Income</p>
            <p className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(netIncome)}
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          {financials.transactionCount} transactions recorded
        </p>

        {/* Active Campaigns */}
        {campaigns.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
              Active Campaigns
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-lg border bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {campaign.name}
                    </h3>
                  </div>
                  {campaign.description && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                      {campaign.description}
                    </p>
                  )}
                  <div className="mt-4">
                    <p className="text-xl font-bold text-green-700">
                      {formatCurrency(campaign.amountRaised)}
                      {campaign.targetAmount && (
                        <span className="text-sm font-normal text-gray-500">
                          {' '}of {formatCurrency(campaign.targetAmount)}
                        </span>
                      )}
                    </p>
                    {campaign.targetAmount && campaign.targetAmount > 0 && (
                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${campaign.progressPercent || 0}%` }}
                        />
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {campaign.donationCount} donation{campaign.donationCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-12 text-center">
          {currentUserState === 'anonymous' && (
            <div className="rounded-lg border bg-white p-8">
              <h2 className="text-xl font-semibold text-gray-900">
                Want to support this organization?
              </h2>
              <p className="mt-2 text-gray-600">
                Sign in to request access and make a donation pledge.
              </p>
              <Link href="/login">
                <Button className="mt-4" size="lg">
                  Sign In to Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}

          {currentUserState === 'member' && (
            <div className="rounded-lg border bg-white p-8">
              <h2 className="text-xl font-semibold text-gray-900">
                You're a member of this organization
              </h2>
              <Link href={`/org/${organization.slug}/dashboard`}>
                <Button className="mt-4" size="lg">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}

          {currentUserState === 'pending_request' && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-8">
              <Clock className="mx-auto h-8 w-8 text-yellow-600" />
              <h2 className="mt-2 text-xl font-semibold text-gray-900">
                Access Request Pending
              </h2>
              <p className="mt-2 text-gray-600">
                Your request to join this organization is being reviewed.
                You'll be notified once it's approved.
              </p>
            </div>
          )}

          {currentUserState === 'can_request' && (
            <div className="rounded-lg border bg-white p-8">
              <h2 className="text-xl font-semibold text-gray-900">
                Want to support this organization?
              </h2>
              <p className="mt-2 text-gray-600">
                Request access to make donation pledges and track your contributions.
              </p>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="mt-4" size="lg">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Request Access
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Access to {organization.name}</DialogTitle>
                    <DialogDescription>
                      {organization.donorAccessMode === 'AUTO_APPROVE'
                        ? 'Your request will be automatically approved.'
                        : 'An administrator will review your request.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Message (optional)
                    </label>
                    <Textarea
                      placeholder="Tell the organization why you'd like to join..."
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAccessRequest} disabled={isSubmitting}>
                      {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
