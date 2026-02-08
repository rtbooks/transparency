import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function ProfilePage() {
  const user = await currentUser();

  if (!user) {
    redirect('/login');
  }

  // Try to find or create user in our database
  let dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
    include: {
      organizations: {
        include: {
          organization: true,
        },
      },
    },
  });

  // Create user if doesn't exist
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        authId: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        name: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`
          : user.username || 'User',
        avatarUrl: user.imageUrl,
      },
      include: {
        organizations: {
          include: {
            organization: true,
          },
        },
      },
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="mt-2 text-gray-600">Welcome, {dbUser.name}!</p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Your Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="font-medium text-gray-700">Name:</span>{' '}
              <span className="text-gray-900">{dbUser.name}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Email:</span>{' '}
              <span className="text-gray-900">{dbUser.email}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Total Donated:</span>{' '}
              <span className="text-gray-900">
                ${dbUser.totalDonated.toString()}
              </span>
            </div>
          </div>
        </div>

        {dbUser.organizations.length > 0 && (
          <div className="mt-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Your Organizations
            </h2>
            <ul className="space-y-3">
              {dbUser.organizations.map((orgUser) => (
                <li key={orgUser.id}>
                  <a
                    href={`/org/${orgUser.organization.slug}/dashboard`}
                    className="block rounded-lg border border-gray-200 p-4 transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">
                      {orgUser.organization.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Role: {orgUser.role}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {dbUser.organizations.length === 0 && (
          <div className="mt-8 rounded-lg bg-blue-50 p-6">
            <p className="text-blue-900">
              You're not part of any organizations yet. Start by exploring
              organizations on the platform or contact an organization
              administrator to get access.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
