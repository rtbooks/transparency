import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface InvitationEmailProps {
  inviterName: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
  expiresInDays: number;
}

export function InvitationEmail({
  inviterName,
  organizationName,
  role,
  inviteUrl,
  expiresInDays,
}: InvitationEmailProps) {
  const roleName = role === 'ORG_ADMIN' ? 'Organization Admin' : 'Donor';

  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to join {organizationName} on RadBooks
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="https://radbooks.org/logo.png"
              width="40"
              height="40"
              alt="RadBooks"
              style={logo}
            />
            <Text style={brandName}>RadBooks</Text>
          </Section>

          <Heading style={heading}>
            You&apos;ve been invited!
          </Heading>

          <Text style={paragraph}>
            <strong>{inviterName}</strong> has invited you to join{' '}
            <strong>{organizationName}</strong> on RadBooks as a{' '}
            <strong>{roleName}</strong>.
          </Text>

          <Text style={paragraph}>
            RadBooks provides radical financial transparency for charitable
            organizations. By joining, you&apos;ll be able to view and
            participate in the organization&apos;s financial activities.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={inviteUrl}>
              Accept Invitation
            </Button>
          </Section>

          <Text style={smallText}>
            This invitation expires in {expiresInDays} day{expiresInDays !== 1 ? 's' : ''}.
            If you did not expect this invitation, you can safely ignore this email.
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

// Styles
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

const logo = {
  display: 'inline-block',
  verticalAlign: 'middle',
  marginRight: '8px',
};

const brandName = {
  display: 'inline-block',
  verticalAlign: 'middle',
  fontSize: '20px',
  fontWeight: '700' as const,
  color: '#1a1a1a',
  margin: '0',
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

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const button = {
  backgroundColor: '#0f172a',
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
  margin: '0 0 16px',
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
