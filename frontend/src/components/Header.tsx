'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              <span className="font-bold text-xl text-gray-900">FloodWatch LK</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-gray-700 hover:text-blue-600 transition-colors">Dashboard</Link>
            <Link href="/intel" className="text-red-600 hover:text-red-700 font-semibold transition-colors">Emergency Intel</Link>
            <Link href="/contacts" className="text-orange-600 hover:text-orange-700 font-semibold transition-colors">Emergency Contacts</Link>
            <Link href="/forecast" className="text-gray-700 hover:text-blue-600 transition-colors">Forecast</Link>
            <Link href="/alerts" className="text-gray-700 hover:text-blue-600 transition-colors">Alerts</Link>
            <Link href="/subscribe" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">Subscribe</Link>
          </div>

          <div className="md:hidden flex items-center">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-700 hover:text-blue-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden pb-4">
            <div className="flex flex-col space-y-3">
              <Link href="/" className="text-gray-700 hover:text-blue-600" onClick={() => setIsMenuOpen(false)}>Dashboard</Link>
              <Link href="/intel" className="text-red-600 font-semibold hover:text-red-700" onClick={() => setIsMenuOpen(false)}>Emergency Intel</Link>
              <Link href="/contacts" className="text-orange-600 font-semibold hover:text-orange-700" onClick={() => setIsMenuOpen(false)}>Emergency Contacts</Link>
              <Link href="/forecast" className="text-gray-700 hover:text-blue-600" onClick={() => setIsMenuOpen(false)}>Forecast</Link>
              <Link href="/alerts" className="text-gray-700 hover:text-blue-600" onClick={() => setIsMenuOpen(false)}>Alerts</Link>
              <Link href="/subscribe" className="text-gray-700 hover:text-blue-600" onClick={() => setIsMenuOpen(false)}>Subscribe</Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
