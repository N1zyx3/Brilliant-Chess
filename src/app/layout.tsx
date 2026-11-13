import type { Metadata, Viewport } from "next"
import "./globals.css"

import { Roboto } from 'next/font/google'
import I18nContextProvider from "@/context/i18n"
import { translations } from "@/i18n"

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
})

export const metadata: Metadata = {
  title: translations.en.metadata.title,
  description: translations.en.metadata.description,
  keywords: translations.en.metadata.keywords,
  authors: [{ name: 'Delo', url: "https://github.com/wdeloo" }],
  applicationName: "Brilliant Chess",

  icons: {
    icon: "favicon.ico"
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#302E2B",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`app-body flex navTop:flex-row flex-col items-center justify-start w-screen overflow-x-clip ${roboto.className}`}>
        <I18nContextProvider>{children}</I18nContextProvider>
      </body>
    </html>
  )
}
