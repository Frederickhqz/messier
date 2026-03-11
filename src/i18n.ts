import {notFound} from 'next/navigation';
import {getRequestConfig} from 'next-intl/server';

export const locales = ['en', 'es', 'pt'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({locale}) => {
  if (!locales.includes(locale as Locale)) notFound();
  
  return {
    messages: (await import(`../messages/${locale}.json`)).default
  };
});