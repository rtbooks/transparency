import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (_resend) return _resend;
  if (process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
    return _resend;
  }
  return null;
}

const DEFAULT_FROM = 'RadBooks <noreply@radbooks.org>';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  attachments?: EmailAttachment[];
}

/**
 * Send an email via Resend. In dev without an API key, logs to console instead.
 * Returns true if sent (or logged), false on error.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  const resend = getResendClient();

  if (!resend) {
    console.log('[Email] No RESEND_API_KEY — logging email instead of sending:');
    console.log(`  To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    console.log(`  From: ${from}`);
    console.log(`  Subject: ${options.subject}`);
    if (options.attachments?.length) {
      console.log(`  Attachments: ${options.attachments.map(a => a.filename).join(', ')}`);
    }
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      react: options.react,
      attachments: options.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    if (error) {
      console.error('[Email] Resend API error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Email] Failed to send email:', err);
    return false;
  }
}
