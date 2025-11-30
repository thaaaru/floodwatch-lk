export interface DistrictData {
  name: string;
  latitude: number;
  longitude: number;
  name_si: string;
  name_ta: string;
}

export const districts: DistrictData[] = [
  { name: "Colombo", latitude: 6.9271, longitude: 79.8612, name_si: "කොළඹ", name_ta: "கொழும்பு" },
  { name: "Gampaha", latitude: 7.0917, longitude: 79.9953, name_si: "ගම්පහ", name_ta: "கம்பஹா" },
  { name: "Kalutara", latitude: 6.5854, longitude: 79.9607, name_si: "කළුතර", name_ta: "களுத்துறை" },
  { name: "Kandy", latitude: 7.2906, longitude: 80.6337, name_si: "මහනුවර", name_ta: "கண்டி" },
  { name: "Matale", latitude: 7.4675, longitude: 80.6234, name_si: "මාතලේ", name_ta: "மாத்தளை" },
  { name: "Nuwara Eliya", latitude: 6.9497, longitude: 80.7891, name_si: "නුවරඑළිය", name_ta: "நுவரெலியா" },
  { name: "Galle", latitude: 6.0535, longitude: 80.2210, name_si: "ගාල්ල", name_ta: "காலி" },
  { name: "Matara", latitude: 5.9549, longitude: 80.5550, name_si: "මාතර", name_ta: "மாத்தறை" },
  { name: "Hambantota", latitude: 6.1429, longitude: 81.1212, name_si: "හම්බන්තොට", name_ta: "அம்பாந்தோட்டை" },
  { name: "Jaffna", latitude: 9.6615, longitude: 80.0255, name_si: "යාපනය", name_ta: "யாழ்ப்பாணம்" },
  { name: "Kilinochchi", latitude: 9.3803, longitude: 80.3770, name_si: "කිලිනොච්චි", name_ta: "கிளிநொச்சி" },
  { name: "Mannar", latitude: 8.9810, longitude: 79.9044, name_si: "මන්නාරම", name_ta: "மன்னார்" },
  { name: "Mullaitivu", latitude: 9.2671, longitude: 80.8142, name_si: "මුලතිව්", name_ta: "முல்லைத்தீவு" },
  { name: "Vavuniya", latitude: 8.7542, longitude: 80.4982, name_si: "වව්නියාව", name_ta: "வவுனியா" },
  { name: "Trincomalee", latitude: 8.5874, longitude: 81.2152, name_si: "ත්‍රිකුණාමලය", name_ta: "திருகோணமலை" },
  { name: "Batticaloa", latitude: 7.7310, longitude: 81.6747, name_si: "මඩකලපුව", name_ta: "மட்டக்களப்பு" },
  { name: "Ampara", latitude: 7.2975, longitude: 81.6820, name_si: "අම්පාර", name_ta: "அம்பாறை" },
  { name: "Kurunegala", latitude: 7.4863, longitude: 80.3647, name_si: "කුරුණෑගල", name_ta: "குருநாகல்" },
  { name: "Puttalam", latitude: 8.0362, longitude: 79.8283, name_si: "පුත්තලම", name_ta: "புத்தளம்" },
  { name: "Anuradhapura", latitude: 8.3114, longitude: 80.4037, name_si: "අනුරාධපුරය", name_ta: "அனுராதபுரம்" },
  { name: "Polonnaruwa", latitude: 7.9403, longitude: 81.0188, name_si: "පොළොන්නරුව", name_ta: "பொலன்னறுவை" },
  { name: "Badulla", latitude: 6.9934, longitude: 81.0550, name_si: "බදුල්ල", name_ta: "பதுளை" },
  { name: "Monaragala", latitude: 6.8728, longitude: 81.3507, name_si: "මොණරාගල", name_ta: "மொனராகலை" },
  { name: "Ratnapura", latitude: 6.7056, longitude: 80.3847, name_si: "රත්නපුර", name_ta: "இரத்தினபுரி" },
  { name: "Kegalle", latitude: 7.2513, longitude: 80.3464, name_si: "කෑගල්ල", name_ta: "கேகாலை" },
];

export const getAlertColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'red': return '#ef4444';
    case 'orange': return '#f97316';
    case 'yellow': return '#eab308';
    default: return '#22c55e';
  }
};

export const getAlertBadgeClass = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'red': return 'badge-red';
    case 'orange': return 'badge-orange';
    case 'yellow': return 'badge-yellow';
    default: return 'badge-green';
  }
};
