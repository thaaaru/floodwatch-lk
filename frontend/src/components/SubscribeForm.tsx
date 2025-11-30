'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { districts } from '@/lib/districts';

export default function SubscribeForm() {
  const [phone, setPhone] = useState('+94');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(['Colombo']);
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleDistrictToggle = (district: string) => {
    setSelectedDistricts(prev =>
      prev.includes(district)
        ? prev.filter(d => d !== district)
        : [...prev, district]
    );
  };

  const handleSelectAll = () => {
    setSelectedDistricts(districts.map(d => d.name));
  };

  const handleClearAll = () => {
    setSelectedDistricts([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (selectedDistricts.length === 0) {
      setError('Please select at least one district');
      setLoading(false);
      return;
    }

    try {
      await api.subscribe({
        phone_number: phone,
        districts: selectedDistricts,
        language,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-green-800 mb-2">Successfully Subscribed!</h3>
        <p className="text-green-700">You will receive flood alerts for your selected districts.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+94771234567"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Sri Lankan format: +94XXXXXXXXX</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="en">English</option>
          <option value="si">Sinhala</option>
          <option value="ta">Tamil</option>
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Districts to Monitor ({selectedDistricts.length} selected)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded border border-blue-300"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-50 rounded border border-gray-300"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto border rounded-lg p-3">
          {districts.map((district) => (
            <label key={district.name} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={selectedDistricts.includes(district.name)}
                onChange={() => handleDistrictToggle(district.name)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">{district.name}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
      >
        {loading ? 'Subscribing...' : 'Subscribe to Alerts'}
      </button>
    </form>
  );
}
