import type { Metadata, Viewport } from 'next';
import { Kanit, Prompt } from 'next/font/google';
import './globals.css';

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-prompt',
});

const kanit = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['500', '700', '800'],
  variable: '--font-kanit',
});

export const metadata: Metadata = {
  title: 'ศึกชิงบัลลังก์เอวเอส 3D | Weight-Loss 3D Arena',
  description: 'หมุนดูพุงเพื่อนได้ 360° • ใครแพ้เลี้ยงชาบู!',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${prompt.variable} ${kanit.variable}`}>
      <body className="font-[family-name:var(--font-prompt)]">{children}</body>
    </html>
  );
}
