import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '智能简历管理系统',
  description: 'AI驱动的智能简历管理系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}