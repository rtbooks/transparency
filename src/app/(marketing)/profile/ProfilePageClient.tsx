'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Building,
  DollarSign,
  Heart,
  Clock,
  Plus,
  Search,
  UserCircle,
  Mail,
  Calendar,
  ArrowRight,
} from 'lucide-react';

interface UserOrganization {
  id: string;
  role: string;
  organizationId: string;
  organization: {
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  contactName: string | null;
  contactRoles: string[];
}

interface UserDonation {
  id: string;
  organizationName: string;
  organizationSlug: string;
  campaignName: string | null;
  amount: string;
  amountReceived: string;
  type: string;
  status: string;
  donationDate: string;
  dueDate: string | null;
}

interface ProfilePageClientProps {
  user: {
    name: string;
    email: string;
    avatarUrl: string | null;
    totalDonated: string;
    createdAt: string;
  };
  organizations: UserOrganization[];
  donations: UserDonation[];
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    RECEIVED: { variant: 'default', className: 'bg-green-600' },
    PLEDGED: { variant: 'secondary', className: 'bg-amber-100 text-amber-800' },
    PARTIAL: { variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
    CANCELLED: { variant: 'destructive' },
  };
  const config = variants[status] || { variant: 'outline' };
  return <Badge variant={config.variant} className={config.className}>{status}</Badge>;
}

function getTypeBadge(type: string) {
  return (
    <Badge variant="outline" className="text-xs">
      {type === 'ONE_TIME' ? 'One-time' : 'Pledge'}
    </Badge>
  );
}

export function ProfilePageClient({ user, organizations, donations }: ProfilePageClientProps) {
  const totalDonated = parseFloat(user.totalDonated) || 0;
  const totalDonations = donations.length;
  const pendingPledges = donations.filter(d => d.status === 'PLEDGED' || d.status === 'PARTIAL');
  const receivedDonations = donations.filter(d => d.status === 'RECEIVED');
  const totalPledged = pendingPledges.reduce((sum, d) => sum + parseFloat(d.amount), 0);
  const totalOutstanding = pendingPledges.reduce(
    (sum, d) => sum + (parseFloat(d.amount) - parseFloat(d.amountReceived)),
    0
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Profile Header */}
      <div className="mb-8 flex items-start gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-gray-500">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <UserCircle className="h-12 w-12" />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{user.name}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Mail className="h-4 w-4" /> {user.email}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" /> Member since {format(new Date(user.createdAt), 'MMM yyyy')}
            </span>
          </div>
        </div>
      </div>

      {/* Donation Summary Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Donated</p>
                <p className="text-2xl font-bold">${totalDonated.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Heart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Donations</p>
                <p className="text-2xl font-bold">{totalDonations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Pledges</p>
                <p className="text-2xl font-bold">{pendingPledges.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding</p>
                <p className="text-2xl font-bold">${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Your Organizations */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Your Organizations
          </CardTitle>
          <Link href="/organizations/new">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> New Organization
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {organizations.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {organizations.map((orgUser) => (
                <Link
                  key={orgUser.id}
                  href={`/org/${orgUser.organization.slug}/dashboard`}
                  className="group flex items-center gap-4 rounded-lg border p-4 transition hover:border-blue-300 hover:bg-blue-50/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600">
                    {orgUser.organization.logoUrl ? (
                      <img
                        src={`/api/organizations/${orgUser.organization.slug}/logo`}
                        alt={orgUser.organization.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      orgUser.organization.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 group-hover:text-blue-900">
                      {orgUser.organization.name}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Badge variant="outline" className="text-xs">{orgUser.role}</Badge>
                      {orgUser.contactRoles.map((r) => (
                        <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-blue-500" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
              <Building className="mx-auto h-10 w-10 text-gray-400" />
              <p className="mt-2 font-medium text-gray-900">No organizations yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Create a new organization or browse existing ones to get started.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Link href="/organizations/new">
                  <Button size="sm">
                    <Plus className="mr-1 h-4 w-4" /> Create Organization
                  </Button>
                </Link>
                <Link href="/organizations">
                  <Button variant="outline" size="sm">
                    <Search className="mr-1 h-4 w-4" /> Browse Organizations
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Pledges */}
      {pendingPledges.length > 0 && (
        <Card className="mb-8 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Clock className="h-5 w-5" />
              Pending Pledges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingPledges.map((donation) => (
                <Link
                  key={donation.id}
                  href={`/org/${donation.organizationSlug}/my-donations`}
                  className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 p-4 transition hover:bg-amber-50"
                >
                  <div>
                    <div className="font-medium text-gray-900">{donation.organizationName}</div>
                    <div className="text-sm text-gray-500">
                      {donation.campaignName && <span>{donation.campaignName} · </span>}
                      Pledged {format(new Date(donation.donationDate), 'MMM d, yyyy')}
                      {donation.dueDate && <span> · Due {format(new Date(donation.dueDate), 'MMM d, yyyy')}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      ${(parseFloat(donation.amount) - parseFloat(donation.amountReceived)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500">
                      of ${parseFloat(donation.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Donations */}
      {donations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Donation History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">Organization</th>
                    <th className="pb-3 font-medium">Campaign</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {donations.map((donation) => (
                    <tr key={donation.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <Link
                          href={`/org/${donation.organizationSlug}/my-donations`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {donation.organizationName}
                        </Link>
                      </td>
                      <td className="py-3 text-gray-600">{donation.campaignName || '—'}</td>
                      <td className="py-3 text-gray-600">{format(new Date(donation.donationDate), 'MMM d, yyyy')}</td>
                      <td className="py-3">{getTypeBadge(donation.type)}</td>
                      <td className="py-3 text-right font-medium">
                        ${parseFloat(donation.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3">{getStatusBadge(donation.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Heart className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-2 font-medium text-gray-900">No donations yet</p>
            <p className="mt-1 text-sm text-gray-500">
              When you donate to organizations on RadBooks, your donation history will appear here.
            </p>
            <Link href="/organizations" className="mt-4 inline-block">
              <Button variant="outline" size="sm">
                <Search className="mr-1 h-4 w-4" /> Browse Organizations
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
