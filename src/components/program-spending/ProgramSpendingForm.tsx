'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProgramSpendingFormProps {
  organizationSlug: string;
  initialData?: {
    title: string;
    description: string;
    estimatedAmount: number;
    targetDate: string | null;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  onSuccess: (id?: string) => void;
  onCancel: () => void;
}

export function ProgramSpendingForm({
  organizationSlug,
  initialData,
  onSuccess,
  onCancel,
}: ProgramSpendingFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [estimatedAmount, setEstimatedAmount] = useState(
    initialData?.estimatedAmount?.toString() || ''
  );
  const [targetDate, setTargetDate] = useState(
    initialData?.targetDate ? initialData.targetDate.split('T')[0] : ''
  );
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(
    initialData?.priority || 'MEDIUM'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: 'Error', description: 'Title is required', variant: 'destructive' });
      return;
    }

    const amount = parseFloat(estimatedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Error', description: 'Enter a valid amount', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(
        `/api/organizations/${organizationSlug}/program-spending`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            estimatedAmount: amount,
            targetDate: targetDate || null,
            priority,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create');
      }

      const created = await res.json();
      toast({ title: 'Created', description: 'Program spending item created successfully' });
      onSuccess(created.id);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create item',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Community Garden Supplies"
          maxLength={200}
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this spending is for..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="estimatedAmount">Estimated Amount *</Label>
          <Input
            id="estimatedAmount"
            type="number"
            min="0.01"
            step="0.01"
            value={estimatedAmount}
            onChange={(e) => setEstimatedAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div>
          <Label htmlFor="targetDate">Target Date</Label>
          <Input
            id="targetDate"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>Priority</Label>
        <Select value={priority} onValueChange={(v) => setPriority(v as 'HIGH' | 'MEDIUM' | 'LOW')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Item'}
        </Button>
      </div>
    </form>
  );
}
