import type { Metadata } from 'next';
import { Prompt } from 'next/font/google';
import './globals.css';

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['400', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'ศึกชิงบัลลังกเอวเอส 3D | Waist-S Championship',
  description: 'สนามแข่งลดน้ำหนักสุดกวน ลดได้มงลง น้ำหนักพุ่งไฟลุกก้น!',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={prompt.className}>{children}</body>
    </html>
  );
}
