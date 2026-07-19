import { headers } from 'next/headers';
import MoneyCalculatorClient from './MoneyCalculatorClient';

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  // money.subhsafaltraders.in (and any "money.*" host) is the standalone,
  // chromeless version — no dashboard hamburger/nav. Reached via the main
  // site's own /money route, it renders inside the normal app shell instead.
  const standalone = host.startsWith('money.');

  const params = await searchParams;
  const editId = typeof params.edit === 'string' ? params.edit : undefined;

  return <MoneyCalculatorClient standalone={standalone} editId={editId} />;
}
