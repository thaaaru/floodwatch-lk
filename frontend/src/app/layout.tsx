import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import Header from '@/components/Header';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FloodWatch LK - Sri Lanka Flood Monitoring System',
  description: 'Real-time flood monitoring and early warning system for Sri Lanka. Get SMS alerts for flood warnings in your district.',
  keywords: 'flood, sri lanka, monitoring, alerts, weather, rainfall, disaster',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-X70YJR4WSV"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-X70YJR4WSV');
          `}
        </Script>
      </head>
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-grow">{children}</main>
          <footer className="bg-gray-800 text-white py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <p className="text-sm text-gray-400">FloodWatch LK - Flood Monitoring System for Sri Lanka</p>
                <div className="flex space-x-4 mt-4 md:mt-0">
                  <span className="text-sm text-gray-400">Data: Open-Meteo, GDACS</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
