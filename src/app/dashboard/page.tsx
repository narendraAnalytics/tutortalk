import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const firstName = user.firstName ?? user.emailAddresses[0]?.emailAddress.split('@')[0] ?? 'there';

  return <DashboardClient firstName={firstName} />;
}
