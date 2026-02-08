import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export default function RegisterSSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
