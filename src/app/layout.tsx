import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DW Reports',
  description: 'Report management system for Degler Whiting',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}