'use client';

import { QRCodeSVG } from 'qrcode.react';

interface VenmoQRCodeProps {
  handle: string;
  amount?: number;
  note?: string;
}

/**
 * Renders a Venmo deep-link QR code.
 * Scanning opens the Venmo app pre-filled with recipient, amount, and note.
 */
export function VenmoQRCode({ handle, amount, note }: VenmoQRCodeProps) {
  // Strip leading @ if present
  const username = handle.replace(/^@/, '');
  const params = new URLSearchParams({ txn: 'pay' });
  if (amount) params.set('amount', amount.toFixed(2));
  if (note) params.set('note', note);

  const url = `https://venmo.com/${encodeURIComponent(username)}?${params.toString()}`;

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <QRCodeSVG value={url} size={140} level="M" />
      <p className="text-xs text-gray-500">Scan with your phone to pay via Venmo</p>
    </div>
  );
}
