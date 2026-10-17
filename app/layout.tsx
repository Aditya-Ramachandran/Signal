import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Signal — Less noise. More signal.',
  description: 'A focused daily job-search briefing.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
