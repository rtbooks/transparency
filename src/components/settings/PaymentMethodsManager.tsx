'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard,
  Smartphone,
  Mail,
  Building2,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Link2,
} from 'lucide-react';

type PaymentMethodType =
  | 'STRIPE'
  | 'VENMO'
  | 'PAYPAL'
  | 'CHECK'
  | 'CASH'
  | 'CASH_APP'
  | 'ZELLE'
  | 'BANK_TRANSFER'
  | 'OTHER';

interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  isEnabled: boolean;
  displayOrder: number;
  label: string | null;
  instructions: string | null;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  handle: string | null;
  paymentUrl: string | null;
  payableTo: string | null;
  mailingAddress: string | null;
}

const METHOD_META: Record<
  PaymentMethodType,
  { label: string; icon: React.ElementType; description: string }
> = {
  STRIPE: {
    label: 'Credit / Debit Card',
    icon: CreditCard,
    description: 'Accept card payments via Stripe Connect',
  },
  VENMO: {
    label: 'Venmo',
    icon: Smartphone,
    description: 'Accept Venmo payments',
  },
  PAYPAL: {
    label: 'PayPal',
    icon: Link2,
    description: 'Accept PayPal payments',
  },
  CHECK: {
    label: 'Check',
    icon: Mail,
    description: 'Accept mailed checks',
  },
  CASH: {
    label: 'Cash',
    icon: Building2,
    description: 'Accept cash donations',
  },
  CASH_APP: {
    label: 'Cash App',
    icon: Smartphone,
    description: 'Accept Cash App payments',
  },
  ZELLE: {
    label: 'Zelle',
    icon: Building2,
    description: 'Accept Zelle transfers',
  },
  BANK_TRANSFER: {
    label: 'Bank Transfer / Wire',
    icon: Building2,
    description: 'Accept bank transfers',
  },
  OTHER: {
    label: 'Other',
    icon: Plus,
    description: 'Other payment method',
  },
};

interface PaymentMethodsManagerProps {
  organizationSlug: string;
}

export function PaymentMethodsManager({
  organizationSlug,
}: PaymentMethodsManagerProps) {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
  } | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const fetchMethods = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/payment-methods`
      );
      if (res.ok) {
        const data = await res.json();
        setMethods(data.paymentMethods || []);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationSlug]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const addMethod = async (type: PaymentMethodType) => {
    setShowAddMenu(false);
    setSaving(type);
    try {
      const meta = METHOD_META[type];
      const res = await fetch(
        `/api/organizations/${organizationSlug}/payment-methods`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            label: meta.label,
            isEnabled: type !== 'STRIPE',
          }),
        }
      );
      if (res.ok) {
        toast({ title: `${meta.label} added` });
        await fetchMethods();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to add',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const updateMethod = async (id: string, updates: Partial<PaymentMethod>) => {
    setSaving(id);
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/payment-methods/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );
      if (res.ok) {
        toast({ title: 'Saved' });
        await fetchMethods();
      } else {
        toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const deleteMethod = async (id: string, label: string) => {
    if (!confirm(`Remove ${label}?`)) return;
    setSaving(id);
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/payment-methods/${id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        toast({ title: `${label} removed` });
        await fetchMethods();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to remove', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const connectStripe = () => {
    window.location.href = `/api/organizations/${organizationSlug}/stripe/connect`;
  };

  const disconnectStripe = async () => {
    if (!confirm('Disconnect Stripe account? Online card payments will be disabled.')) return;
    try {
      await fetch(`/api/organizations/${organizationSlug}/stripe/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      setStripeStatus({ connected: false });
      toast({ title: 'Stripe disconnected' });
      await fetchMethods();
    } catch {
      toast({ title: 'Error', description: 'Failed to disconnect', variant: 'destructive' });
    }
  };

  const checkStripeStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/stripe/connect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setStripeStatus(data);
      }
    } catch {
      // Non-critical
    }
  }, [organizationSlug]);

  useEffect(() => {
    const hasStripe = methods.some((m) => m.type === 'STRIPE');
    if (hasStripe) {
      checkStripeStatus();
    }
  }, [methods, checkStripeStatus]);

  const configuredTypes = new Set(methods.map((m) => m.type));
  const availableTypes = (
    Object.keys(METHOD_META) as PaymentMethodType[]
  ).filter((t) => !configuredTypes.has(t));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {methods.length === 0 && (
        <p className="text-sm text-gray-500">
          No payment methods configured. Add one below to enable donations.
        </p>
      )}

      {methods.map((method) => (
        <MethodCard
          key={method.id}
          method={method}
          saving={saving === method.id}
          stripeStatus={method.type === 'STRIPE' ? stripeStatus : null}
          onUpdate={(updates) => updateMethod(method.id, updates)}
          onDelete={() => deleteMethod(method.id, method.label || method.type)}
          onConnectStripe={connectStripe}
          onDisconnectStripe={disconnectStripe}
        />
      ))}

      {availableTypes.length > 0 && (
        <div className="relative">
          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={!!saving}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Payment Method
          </Button>

          {showAddMenu && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border bg-white shadow-lg">
              {availableTypes.map((type) => {
                const meta = METHOD_META[type];
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                    onClick={() => addMethod(type)}
                    disabled={saving === type}
                  >
                    <Icon className="h-5 w-5 text-gray-500" />
                    <div>
                      <div className="text-sm font-medium">{meta.label}</div>
                      <div className="text-xs text-gray-500">
                        {meta.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Individual Method Card ---

interface MethodCardProps {
  method: PaymentMethod;
  saving: boolean;
  stripeStatus: { connected: boolean; chargesEnabled?: boolean; payoutsEnabled?: boolean } | null;
  onUpdate: (updates: Partial<PaymentMethod>) => void;
  onDelete: () => void;
  onConnectStripe: () => void;
  onDisconnectStripe: () => void;
}

function MethodCard({
  method,
  saving,
  stripeStatus,
  onUpdate,
  onDelete,
  onConnectStripe,
  onDisconnectStripe,
}: MethodCardProps) {
  const meta = METHOD_META[method.type];
  const Icon = meta.icon;
  const [editing, setEditing] = useState(false);
  const [formState, setFormState] = useState({
    label: method.label || '',
    instructions: method.instructions || '',
    handle: method.handle || '',
    paymentUrl: method.paymentUrl || '',
    payableTo: method.payableTo || '',
    mailingAddress: method.mailingAddress || '',
  });

  const handleSave = () => {
    const updates: Partial<PaymentMethod> = {};
    if (formState.label !== (method.label || ''))
      updates.label = formState.label || null;
    if (formState.instructions !== (method.instructions || ''))
      updates.instructions = formState.instructions || null;
    if (formState.handle !== (method.handle || ''))
      updates.handle = formState.handle || null;
    if (formState.paymentUrl !== (method.paymentUrl || ''))
      updates.paymentUrl = formState.paymentUrl || null;
    if (formState.payableTo !== (method.payableTo || ''))
      updates.payableTo = formState.payableTo || null;
    if (formState.mailingAddress !== (method.mailingAddress || ''))
      updates.mailingAddress = formState.mailingAddress || null;

    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
    }
    setEditing(false);
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-gray-600" />
          <div>
            <span className="font-medium">
              {method.label || meta.label}
            </span>
            {method.type === 'STRIPE' && stripeStatus && (
              <span className="ml-2">
                {stripeStatus.connected ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-orange-600">
                    <XCircle className="h-3 w-3" /> Not connected
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={method.isEnabled}
            onCheckedChange={(checked) => onUpdate({ isEnabled: checked })}
            disabled={saving}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Close' : 'Edit'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={saving}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>

      {method.type === 'STRIPE' && editing && (
        <div className="mt-4 rounded-md bg-blue-50 p-4">
          {stripeStatus?.connected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>
                  Charges: {stripeStatus.chargesEnabled ? 'Enabled' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>
                  Payouts: {stripeStatus.payoutsEnabled ? 'Enabled' : 'Pending'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onDisconnectStripe}
                className="mt-2"
              >
                Disconnect Stripe
              </Button>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-sm text-gray-700">
                Connect your Stripe account to accept credit and debit card
                payments. Funds go directly to your Stripe account.
              </p>
              <Button onClick={onConnectStripe} size="sm">
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect with Stripe
              </Button>
            </div>
          )}
        </div>
      )}

      {editing && method.type !== 'STRIPE' && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Display Name
            </label>
            <Input
              value={formState.label}
              onChange={(e) =>
                setFormState({ ...formState, label: e.target.value })
              }
              placeholder={meta.label}
            />
          </div>

          {['VENMO', 'PAYPAL', 'CASH_APP', 'ZELLE'].includes(method.type) && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                {method.type === 'PAYPAL' ? 'PayPal Email' : 'Handle / Username'}
              </label>
              <Input
                value={formState.handle}
                onChange={(e) =>
                  setFormState({ ...formState, handle: e.target.value })
                }
                placeholder={
                  method.type === 'VENMO'
                    ? '@your-handle'
                    : method.type === 'PAYPAL'
                    ? 'email@example.com'
                    : method.type === 'CASH_APP'
                    ? '$cashtag'
                    : 'email or phone'
                }
              />
            </div>
          )}

          {['VENMO', 'PAYPAL', 'CASH_APP'].includes(method.type) && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Payment Link (optional)
              </label>
              <Input
                value={formState.paymentUrl}
                onChange={(e) =>
                  setFormState({ ...formState, paymentUrl: e.target.value })
                }
                placeholder="https://..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Direct payment link donors can click
              </p>
            </div>
          )}

          {method.type === 'CHECK' && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Make Checks Payable To
                </label>
                <Input
                  value={formState.payableTo}
                  onChange={(e) =>
                    setFormState({ ...formState, payableTo: e.target.value })
                  }
                  placeholder="Organization Name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Mailing Address
                </label>
                <Textarea
                  value={formState.mailingAddress}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      mailingAddress: e.target.value,
                    })
                  }
                  placeholder={"123 Main St\nCity, ST 12345"}
                  rows={3}
                />
              </div>
            </>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700">
              Instructions for Donors
            </label>
            <Textarea
              value={formState.instructions}
              onChange={(e) =>
                setFormState({ ...formState, instructions: e.target.value })
              }
              placeholder="Additional instructions for donors..."
              rows={2}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
