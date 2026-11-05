import { themeCssVariables } from '@apniride/shared';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// Colours and corner sizes come from the one shared theme (packages/shared/src/theme.ts) as CSS variables.
const themeCss = themeCssVariables('admin');

export const metadata: Metadata = {
  title: 'ApniRide Admin',
  description: 'Approve drivers, view rides, set fares',
  // Internal tool: keep it out of search engines.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Static string from our own theme file, not user input. */}
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
