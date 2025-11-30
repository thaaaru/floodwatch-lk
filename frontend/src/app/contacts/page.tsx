'use client';

export default function EmergencyContacts() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-red-800 border-b border-red-700 px-4 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold">Emergency Contacts</h1>
          <p className="text-red-200">ආපදා සහන ලබාගැනීමේ හදිසි ඇමතුම් අංක</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* National Emergency Numbers */}
        <section className="bg-gray-800 rounded-lg p-6 border-l-4 border-red-500">
          <h2 className="text-xl font-bold mb-4 text-red-400">
            National Emergency Numbers
            <span className="block text-sm font-normal text-gray-400">ජාතික මට්ටමේ හදිසි ඇමතුම් අංක</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ContactCard
              number="117"
              title="Disaster Management Centre (DMC)"
              titleSi="ආපදා කළමනාකරණ මධ්‍යස්ථානය"
              description="Emergency disaster reporting and relief coordination"
              descriptionSi="හදිසි ආපදා දැනුම් දීම් සහ සහන සේවා සම්බන්ධීකරණය"
              color="red"
            />
            <ContactCard
              number="119"
              title="Police Emergency"
              titleSi="පොලිස් හදිසි ඇමතුම්"
              description="Life-saving and emergency security needs"
              descriptionSi="ජීවිතාරක්ෂක හා හදිසි ආරක්ෂක අවශ්‍යතා"
              color="blue"
            />
            <ContactCard
              number="1990"
              title="Suwa Seriya Ambulance"
              titleSi="සුව සැරිය ගිලන් රථ සේවාව"
              description="Patient hospitalization"
              descriptionSi="රෝගීන් රෝහල් ගත කිරීම සඳහා"
              color="green"
            />
            <ContactCard
              number="110"
              title="Fire Brigade"
              titleSi="ගිනි නිවන හමුදාව"
              description="Fire incidents and victim rescue"
              descriptionSi="ගිනි ගැනීම් සහ විපතට පත් වූවන් බේරා ගැනීම"
              color="orange"
            />
            <ContactCard
              number="011 258 8946"
              title="NBRO (Landslide Warnings)"
              titleSi="ජාතික ගොඩනැගිලි පර්යේෂණ සංවිධානය"
              description="Landslide risk reporting"
              descriptionSi="නායයෑම් අවදානම් දැනුම් දීමට"
              color="yellow"
            />
            <ContactCard
              number="011 268 6686"
              title="Meteorological Department"
              titleSi="කාලගුණ විද්‍යා දෙපාර්තමේන්තුව"
              description="Weather forecasts"
              descriptionSi="කාලගුණ අනාවැකි දැනගැනීමට"
              color="cyan"
            />
            <ContactCard
              number="011 244 5368"
              title="Navy Headquarters"
              titleSi="නාවික හමුදා මූලස්ථානය"
              description="Boat services and flood rescue"
              descriptionSi="ගංවතුරකදී බෝට්ටු සේවා සහ බේරා ගැනීම්"
              color="blue"
            />
            <ContactCard
              number="113"
              title="Army Headquarters"
              titleSi="යුධ හමුදා මූලස්ථානය"
              description="Emergency disaster relief and rescue"
              descriptionSi="හදිසි ආපදා සහන සහ බේරා ගැනීම්"
              color="green"
            />
            <ContactCard
              number="116"
              title="Air Force Headquarters"
              titleSi="ගුවන් හමුදා මූලස්ථානය"
              description="Helicopter rescue operations"
              descriptionSi="හෙලිකොප්ටර් යානා මගින් සිදුකරන බේරා ගැනීම් සඳහා"
              color="purple"
            />
          </div>
        </section>

        {/* Western Province */}
        <ProvinceSection
          title="Western Province"
          titleSi="බස්නාහිර පළාත"
          note="High flood risk areas"
          noteSi="ගංවතුර අවදානම වැඩිම ප්‍රදේශ සඳහා"
          districts={[
            { name: 'Colombo', nameSi: 'කොළඹ', phone1: '011 243 4028', phone2: '077 395 7893' },
            { name: 'Gampaha', nameSi: 'ගම්පහ', phone1: '033 223 4676', phone2: '077 395 7888' },
            { name: 'Kalutara', nameSi: 'කළුතර', phone1: '034 222 2344', phone2: '077 395 7887' },
          ]}
        />

        {/* Southern Province */}
        <ProvinceSection
          title="Southern Province"
          titleSi="දකුණු පළාත"
          districts={[
            { name: 'Galle', nameSi: 'ගාල්ල', phone1: '091 224 2355', phone2: '077 395 7889' },
            { name: 'Matara', nameSi: 'මාතර', phone1: '041 223 4030', phone2: '077 395 7894' },
            { name: 'Hambantota', nameSi: 'හම්බන්තොට', phone1: '047 225 8056', phone2: '077 395 7895' },
          ]}
        />

        {/* Sabaragamuwa Province */}
        <ProvinceSection
          title="Sabaragamuwa Province"
          titleSi="සබරගමුව පළාත"
          note="Landslide and flood prone areas"
          noteSi="නායයෑම් සහ ගංවතුර බහුල ප්‍රදේශ"
          districts={[
            { name: 'Ratnapura', nameSi: 'රත්නපුර', phone1: '045 222 5522', phone2: '077 395 7898' },
            { name: 'Kegalle', nameSi: 'කෑගල්ල', phone1: '035 222 2843', phone2: '077 395 7891' },
          ]}
        />

        {/* North Western Province */}
        <ProvinceSection
          title="North Western Province"
          titleSi="වයඹ පළාත"
          districts={[
            { name: 'Kurunegala', nameSi: 'කුරුණෑගල', phone1: '037 222 0455', phone2: '077 395 7892' },
            { name: 'Puttalam', nameSi: 'පුත්තලම', phone1: '032 226 5345', phone2: '077 395 7896' },
          ]}
        />

        {/* Central Province */}
        <ProvinceSection
          title="Central Province"
          titleSi="මධ්‍යම පළාත"
          districts={[
            { name: 'Kandy', nameSi: 'මහනුවර', phone1: '081 220 2875', phone2: '077 395 7890' },
            { name: 'Nuwara Eliya', nameSi: 'නුවරඑළිය', phone1: '052 222 3448', phone2: '077 395 7897' },
            { name: 'Matale', nameSi: 'මාතලේ', phone1: '066 223 0926', phone2: '077 395 7886' },
          ]}
        />

        {/* North Central Province */}
        <ProvinceSection
          title="North Central Province"
          titleSi="උතුරු මැද පළාත"
          districts={[
            { name: 'Anuradhapura', nameSi: 'අනුරාධපුරය', phone1: '025 222 5333', phone2: '077 395 7883' },
            { name: 'Polonnaruwa', nameSi: 'පොළොන්නරුව', phone1: '027 222 6676', phone2: '077 395 7884' },
          ]}
        />

        {/* Uva Province */}
        <ProvinceSection
          title="Uva Province"
          titleSi="ඌව පළාත"
          districts={[
            { name: 'Badulla', nameSi: 'බදුල්ල', phone1: '055 222 4434', phone2: '077 395 7885' },
            { name: 'Monaragala', nameSi: 'මොනරාගල', phone1: '055 227 6378', phone2: '077 395 7893' },
          ]}
        />

        {/* FloodSupport Link */}
        <section className="bg-blue-900 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold mb-2">Report an Emergency</h2>
          <p className="text-blue-200 mb-4">Submit SOS requests for immediate rescue assistance</p>
          <a
            href="https://floodsupport.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-bold text-lg"
          >
            FloodSupport.org - Report Emergency
          </a>
        </section>
      </main>
    </div>
  );
}

function ContactCard({
  number,
  title,
  titleSi,
  description,
  descriptionSi,
  color,
}: {
  number: string;
  title: string;
  titleSi: string;
  description: string;
  descriptionSi: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    red: 'bg-red-700 hover:bg-red-600',
    blue: 'bg-blue-700 hover:bg-blue-600',
    green: 'bg-green-700 hover:bg-green-600',
    orange: 'bg-orange-700 hover:bg-orange-600',
    yellow: 'bg-yellow-700 hover:bg-yellow-600',
    cyan: 'bg-cyan-700 hover:bg-cyan-600',
    purple: 'bg-purple-700 hover:bg-purple-600',
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-gray-400">{titleSi}</div>
        </div>
        <a
          href={`tel:${number.replace(/\s/g, '')}`}
          className={`${colorClasses[color] || 'bg-gray-600'} text-white px-4 py-2 rounded font-bold text-lg`}
        >
          {number}
        </a>
      </div>
      <div className="text-sm text-gray-300">{description}</div>
      <div className="text-xs text-gray-500">{descriptionSi}</div>
    </div>
  );
}

function ProvinceSection({
  title,
  titleSi,
  note,
  noteSi,
  districts,
}: {
  title: string;
  titleSi: string;
  note?: string;
  noteSi?: string;
  districts: Array<{ name: string; nameSi: string; phone1: string; phone2: string }>;
}) {
  return (
    <section className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-lg font-bold mb-1 text-yellow-400">
        {title}
        <span className="block text-sm font-normal text-gray-400">{titleSi}</span>
      </h2>
      {note && (
        <p className="text-sm text-orange-400 mb-4">
          {note} <span className="text-gray-500">| {noteSi}</span>
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {districts.map((d) => (
          <div key={d.name} className="bg-gray-700 rounded-lg p-3">
            <div className="font-semibold">{d.name}</div>
            <div className="text-xs text-gray-400 mb-2">{d.nameSi}</div>
            <div className="flex flex-col gap-1">
              <a href={`tel:${d.phone1.replace(/\s/g, '')}`} className="text-sm bg-gray-600 hover:bg-blue-600 px-2 py-1 rounded text-center">
                {d.phone1}
              </a>
              <a href={`tel:${d.phone2.replace(/\s/g, '')}`} className="text-sm bg-gray-600 hover:bg-green-600 px-2 py-1 rounded text-center">
                {d.phone2}
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
