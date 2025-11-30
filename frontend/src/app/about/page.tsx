export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">About FloodWatch LK</h1>

      <div className="prose prose-lg max-w-none">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Our Mission</h2>
          <p className="text-gray-600">
            FloodWatch LK is a flood monitoring and early warning system designed to help protect
            communities across Sri Lanka. By providing real-time rainfall data and flood alerts,
            we aim to give people the information they need to stay safe during extreme weather events.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">How It Works</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>We monitor rainfall data from Open-Meteo weather API for all 25 districts of Sri Lanka</li>
            <li>We track global flood alerts from GDACS (Global Disaster Alert and Coordination System)</li>
            <li>When rainfall exceeds warning thresholds, subscribers receive SMS alerts</li>
            <li>The dashboard shows real-time conditions across the country</li>
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-900">Open-Meteo</h3>
              <p className="text-sm text-gray-600 mt-1">Free weather API providing rainfall, temperature, and humidity data.</p>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-gray-900">GDACS</h3>
              <p className="text-sm text-gray-600 mt-1">Global Disaster Alert and Coordination System for flood event tracking.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Coverage</h2>
          <p className="text-gray-600 mb-4">FloodWatch LK monitors all 25 districts of Sri Lanka:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-sm text-gray-600">
            {['Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 'Galle', 'Matara',
              'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar', 'Mullaitivu', 'Vavuniya', 'Trincomalee',
              'Batticaloa', 'Ampara', 'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla',
              'Monaragala', 'Ratnapura', 'Kegalle'].map((d) => (
              <span key={d} className="bg-gray-100 px-2 py-1 rounded">{d}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
