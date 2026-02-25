'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Check, Copy, Mail, Loader2 } from 'lucide-react';

interface CampaignShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignName: string;
  organizationName: string;
  organizationSlug: string;
  campaignId: string;
  shareUrl: string;
}

export function CampaignShareDialog({
  open,
  onOpenChange,
  campaignName,
  organizationName,
  organizationSlug,
  campaignId,
  shareUrl,
}: CampaignShareDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const shareText = `Support ${organizationName} — donate to "${campaignName}"`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: 'Link copied!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const handleSocialShare = (platform: 'twitter' | 'facebook' | 'linkedin') => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    let url = '';

    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
    }

    window.open(url, '_blank', 'width=600,height=400');
  };

  const handleEmailInvite = async () => {
    if (!email.trim()) return;

    setSendingEmail(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/campaigns/${campaignId}/invite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), message: message.trim() || undefined }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send invite');
      }

      toast({ title: 'Invitation sent!', description: `Sent to ${email}` });
      setEmail('');
      setMessage('');
      setShowEmailForm(false);
    } catch (error) {
      toast({
        title: 'Failed to send invite',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Campaign</DialogTitle>
          <DialogDescription>
            Invite others to donate to &quot;{campaignName}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Copy Link */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Campaign Link
            </label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="text-sm"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Social Share */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Share on Social Media
            </label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleSocialShare('twitter')}
              >
                𝕏 Twitter
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleSocialShare('facebook')}
              >
                Facebook
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleSocialShare('linkedin')}
              >
                LinkedIn
              </Button>
            </div>
          </div>

          {/* Email Invite */}
          <div>
            {!showEmailForm ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowEmailForm(true)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Invite by Email
              </Button>
            ) : (
              <div className="space-y-3 rounded-lg border p-4">
                <Input
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Textarea
                  placeholder="Add a personal message (optional)"
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEmailForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!email.trim() || sendingEmail}
                    onClick={handleEmailInvite}
                  >
                    {sendingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Invite
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
