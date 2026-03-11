import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import LoginPage from './login-page';

export default async function Home({params: {locale}}: {params: {locale: string}}) {
  const t = await getTranslations({locale, namespace: 'app'});
  
  return <LoginPage locale={locale} />;
}