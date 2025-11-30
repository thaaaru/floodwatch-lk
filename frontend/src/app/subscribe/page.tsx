import SubscribeForm from '@/components/SubscribeForm';

export default function SubscribePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Subscribe to Flood Alerts</h1>
        <p className="mt-2 text-gray-600">Get SMS notifications when flood warnings are issued for your selected districts</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <SubscribeForm />
      </div>

      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-4">Alert Levels</h2>
        <div className="space-y-3">
          <div className="flex items-start">
            <span className="w-4 h-4 rounded-full bg-yellow-500 mt-1 mr-3"></span>
            <div>
              <p className="font-medium text-gray-900">Yellow Alert (Watch)</p>
              <p className="text-sm text-gray-600">Rainfall exceeds 50mm in 24 hours. Monitor conditions.</p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="w-4 h-4 rounded-full bg-orange-500 mt-1 mr-3"></span>
            <div>
              <p className="font-medium text-gray-900">Orange Alert (Warning)</p>
              <p className="text-sm text-gray-600">Rainfall exceeds 100mm in 24 hours or GDACS level 1 flood alert.</p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="w-4 h-4 rounded-full bg-red-500 mt-1 mr-3"></span>
            <div>
              <p className="font-medium text-gray-900">Red Alert (Emergency)</p>
              <p className="text-sm text-gray-600">Rainfall exceeds 150mm in 24 hours or GDACS level 2+ flood alert.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
