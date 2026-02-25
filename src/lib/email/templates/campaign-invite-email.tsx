import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface CampaignInviteEmailProps {
  senderName: string;
  organizationName: string;
  campaignName: string;
  campaignDescription: string | null;
  personalMessage: string | null;
  donateUrl: string;
  organizationLogoUrl?: string;
}

export function CampaignInviteEmail({
  senderName,
  organizationName,
  campaignName,
  campaignDescription,
  personalMessage,
  donateUrl,
  organizationLogoUrl,
}: CampaignInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {senderName} invited you to donate to {campaignName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            {organizationLogoUrl ? (
              <Img src={organizationLogoUrl} alt={organizationName} width="48" height="48" style={logoImg} />
            ) : (
              <Text style={brandName}>📚 RadBooks</Text>
            )}
          </Section>

          <Heading style={heading}>
            You&apos;re invited to donate!
          </Heading>

          <Text style={paragraph}>
            <strong>{senderName}</strong> has invited you to support{' '}
            <strong>{organizationName}</strong> by donating to their campaign:
          </Text>

          <Section style={campaignCard}>
            <Text style={campaignTitle}>{campaignName}</Text>
            {campaignDescription && (
              <Text style={campaignDesc}>{campaignDescription}</Text>
            )}
          </Section>

          {personalMessage && (
            <Section style={messageSection}>
              <Text style={messageLabel}>Message from {senderName}:</Text>
              <Text style={messageText}>&ldquo;{personalMessage}&rdquo;</Text>
            </Section>
          )}

          <Section style={buttonContainer}>
            <Button style={button} href={donateUrl}>
              Donate Now
            </Button>
          </Section>

          <Text style={smallText}>
            If the button above doesn&apos;t work, copy and paste this link into your browser:
          </Text>
          <Text style={linkText}>
            <Link href={donateUrl} style={linkStyle}>{donateUrl}</Link>
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            RadBooks — Radical Financial Transparency for 501(c)(3) Organizations
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
  borderRadius: '8px',
};

const header = {
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const brandName = {
  fontSize: '22px',
  fontWeight: '700' as const,
  color: '#1a1a1a',
  margin: '0',
};

const logoImg = {
  margin: '0 auto',
  borderRadius: '8px',
};

const heading = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#1a1a1a',
  textAlign: 'center' as const,
  margin: '0 0 16px',
};

const paragraph = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#4a4a4a',
  margin: '0 0 16px',
};

const campaignCard = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 16px',
  borderLeft: '4px solid #16a34a',
};

const campaignTitle = {
  fontSize: '18px',
  fontWeight: '700' as const,
  color: '#1a1a1a',
  margin: '0 0 4px',
};

const campaignDesc = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0',
  lineHeight: '1.5',
};

const messageSection = {
  backgroundColor: '#fffbeb',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '0 0 16px',
};

const messageLabel = {
  fontSize: '12px',
  fontWeight: '600' as const,
  color: '#92400e',
  margin: '0 0 4px',
};

const messageText = {
  fontSize: '14px',
  fontStyle: 'italic' as const,
  color: '#78350f',
  margin: '0',
  lineHeight: '1.5',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const button = {
  backgroundColor: '#16a34a',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '12px 24px',
  display: 'inline-block',
};

const smallText = {
  fontSize: '13px',
  color: '#888888',
  lineHeight: '1.5',
  margin: '0 0 8px',
};

const linkText = {
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0 0 16px',
  wordBreak: 'break-all' as const,
};

const linkStyle = {
  color: '#2563eb',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e6e6e6',
  margin: '24px 0',
};

const footer = {
  fontSize: '12px',
  color: '#999999',
  textAlign: 'center' as const,
  margin: '0',
};
