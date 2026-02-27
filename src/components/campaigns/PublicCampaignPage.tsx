'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Heart, Target, Calendar, Users, Share2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/account-tree';
import { useState } from 'react';
import { CampaignShareDialog } from './CampaignShareDialog';

interface CampaignTier {
  id: string;
  name: string;
  amount: number;
  maxSlots: number | null;
  slotsFilled: number;
}

interface CampaignData {
  id: string;
  name: string;
  description: string | null;
  targetAmount: number | null;
  amountRaised: number;
  donationCount: number;
  progressPercent: number;
  campaignType: string;
  unitPrice: number | null;
  maxUnits: number | null;
  unitLabel: string | null;
  allowMultiUnit: boolean;
  unitsSold: number;
  unitsRemaining: number | null;
  startDate: string | null;
  endDate: string | null;
  tiers: CampaignTier[];
}

interface PublicCampaignPageProps {
  campaign: CampaignData;
  organizationName: string;
  organizationSlug: string;
  organizationMission: string | null;
  primaryColor: string | null;
}

export function PublicCampaignPage({
  campaign,
  organizationName,
  organizationSlug,
  primaryColor,
}: PublicCampaignPageProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const donateUrl = `/org/${organizationSlug}/donate?campaignId=${campaign.id}`;
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/org/${organizationSlug}/donate/${campaign.id}`
    : `/org/${organizationSlug}/donate/${campaign.id}`;

  const accentColor = primaryColor || '#16a34a';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href={`/org/${organizationSlug}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← {organizationName}
          </Link>
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Campaign Hero */}
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <div className="mb-6">
            <p className="mb-2 text-sm font-medium text-gray-500">{organizationName}</p>
            <h1 className="text-3xl font-bold text-gray-900">{campaign.name}</h1>
            {campaign.description && (
              <p className="mt-3 text-lg text-gray-600">{campaign.description}</p>
            )}
          </div>

          {/* Progress Section */}
          <div className="mb-6 rounded-lg bg-gray-50 p-6">
            {campaign.campaignType === 'FIXED_UNIT' && (
              <FixedUnitProgress campaign={campaign} accentColor={accentColor} />
            )}
            {campaign.campaignType === 'TIERED' && (
              <TieredProgress campaign={campaign} />
            )}
            {campaign.campaignType === 'OPEN' && (
              <OpenProgress campaign={campaign} accentColor={accentColor} />
            )}
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-gray-400">
                <Heart className="h-4 w-4" />
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaign.donationCount}
              </p>
              <p className="text-xs text-gray-500">Donations</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-gray-400">
                <Target className="h-4 w-4" />
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatCurrency(campaign.amountRaised)}
              </p>
              <p className="text-xs text-gray-500">Raised</p>
            </div>
            {campaign.endDate && (
              <div>
                <div className="flex items-center justify-center gap-1 text-gray-400">
                  <Calendar className="h-4 w-4" />
                </div>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {getDaysRemaining(campaign.endDate)}
                </p>
                <p className="text-xs text-gray-500">Days Left</p>
              </div>
            )}
          </div>

          {/* Tier Details */}
          {campaign.campaignType === 'TIERED' && campaign.tiers.length > 0 && (
            <div className="mb-6 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Users className="h-4 w-4" /> Donation Tiers
              </h3>
              {campaign.tiers.map((tier) => {
                const slotsAvailable = tier.maxSlots ? tier.maxSlots - tier.slotsFilled : null;
                const soldOut = slotsAvailable !== null && slotsAvailable <= 0;
                return (
                  <div
                    key={tier.id}
                    className={`flex items-center justify-between rounded-lg border p-4 ${
                      soldOut ? 'bg-gray-100 opacity-60' : 'bg-white'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{tier.name}</p>
                      {tier.maxSlots && (
                        <p className="text-xs text-gray-500">
                          {soldOut
                            ? 'Sold out'
                            : `${slotsAvailable} of ${tier.maxSlots} spots remaining`}
                        </p>
                      )}
                    </div>
                    <p className={`text-lg font-bold ${soldOut ? 'text-gray-400' : 'text-purple-700'}`}>
                      {formatCurrency(tier.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* CTA */}
          <Link href={donateUrl}>
            <Button
              className="w-full py-6 text-lg font-semibold"
              style={{ backgroundColor: accentColor }}
            >
              <Heart className="mr-2 h-5 w-5" />
              Donate Now
            </Button>
          </Link>
        </div>
      </main>

      <CampaignShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        campaignName={campaign.name}
        organizationName={organizationName}
        organizationSlug={organizationSlug}
        campaignId={campaign.id}
        shareUrl={shareUrl}
      />
    </div>
  );
}

function FixedUnitProgress({ campaign, accentColor }: { campaign: CampaignData; accentColor: string }) {
  const total = campaign.maxUnits || 0;
  const sold = campaign.unitsSold;
  const percent = total > 0 ? Math.min(100, (sold / total) * 100) : 0;
  const label = campaign.unitLabel || 'unit';

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-bold text-gray-900">
          {sold} <span className="text-base font-normal text-gray-500">of {total} {label}s claimed</span>
        </p>
        <p className="text-lg font-semibold" style={{ color: accentColor }}>
          {formatCurrency(campaign.unitPrice!)} each
        </p>
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: accentColor }}
        />
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {campaign.unitsRemaining !== null ? `${campaign.unitsRemaining} remaining` : ''}
      </p>
    </div>
  );
}

function TieredProgress({ campaign }: { campaign: CampaignData }) {
  const totalSlots = campaign.tiers.reduce((sum, t) => sum + (t.maxSlots || 0), 0);
  const filledSlots = campaign.tiers.reduce((sum, t) => sum + t.slotsFilled, 0);
  const percent = totalSlots > 0 ? Math.min(100, (filledSlots / totalSlots) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-bold text-gray-900">
          {formatCurrency(campaign.amountRaised)}
        </p>
        {campaign.targetAmount && (
          <p className="text-sm text-gray-500">
            of {formatCurrency(campaign.targetAmount)} goal
          </p>
        )}
      </div>
      {totalSlots > 0 && (
        <>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {filledSlots} of {totalSlots} spots filled
          </p>
        </>
      )}
    </div>
  );
}

function OpenProgress({ campaign, accentColor }: { campaign: CampaignData; accentColor: string }) {
  const percent = campaign.targetAmount
    ? Math.min(100, (campaign.amountRaised / campaign.targetAmount) * 100)
    : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-bold text-gray-900">
          {formatCurrency(campaign.amountRaised)}
        </p>
        {campaign.targetAmount && (
          <p className="text-sm text-gray-500">
            of {formatCurrency(campaign.targetAmount)} goal
          </p>
        )}
      </div>
      {campaign.targetAmount && (
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percent}%`, backgroundColor: accentColor }}
          />
        </div>
      )}
    </div>
  );
}

function getDaysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
