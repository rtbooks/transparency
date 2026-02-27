import type { Metadata } from 'next';
import { AdminCreateOrganizationClient } from './AdminCreateOrganizationClient';

export const metadata: Metadata = { title: 'New Organization — Admin' };

export default function AdminCreateOrganizationPage() {
  return <AdminCreateOrganizationClient />;
}
