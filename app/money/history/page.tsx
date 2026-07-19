import { headers } from 'next/headers';
import MoneyHistoryClient from './MoneyHistoryClient';

export default async function MoneyHistoryPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const standalone = host.startsWith('money.');

  return <MoneyHistoryClient standalone={standalone} />;
}
