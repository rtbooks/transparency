import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const DEFAULT_FROM = 'RadBooks <onboarding@resend.dev>';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
}

/**
 * Send an email via Resend. In dev without an API key, logs to console instead.
 * Returns true if sent (or logged), false on error.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  if (!resend) {
    console.log('[Email] No RESEND_API_KEY — logging email instead of sending:');
    console.log(`  To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    console.log(`  From: ${from}`);
    console.log(`  Subject: ${options.subject}`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      react: options.react,
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
