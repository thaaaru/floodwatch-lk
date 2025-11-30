// Sri Lanka major river paths (simplified coordinates)
// These rivers are monitored by the Navy flood monitoring system

export interface RiverPath {
  name: string;
  code: string;
  color: string;
  coordinates: [number, number][]; // [lat, lng] pairs
}

export const riverPaths: RiverPath[] = [
  {
    name: "Kelani River",
    code: "KLN",
    color: "#3b82f6", // Blue
    coordinates: [
      [7.2544, 80.6350], // Source area (Sri Pada)
      [7.1944, 80.5250],
      [7.1544, 80.4350],
      [7.1044, 80.3450],
      [7.0744, 80.2550],
      [7.0244, 80.1650],
      [6.9744, 80.0850],
      [6.9544, 79.9950],
      [6.9544, 79.9350],
      [6.9544, 79.8850], // Colombo (mouth)
    ],
  },
  {
    name: "Kalu River",
    code: "KLU",
    color: "#0ea5e9", // Sky blue
    coordinates: [
      [6.7944, 80.4850], // Source (Peak Wilderness)
      [6.7344, 80.3950],
      [6.6744, 80.3050],
      [6.6144, 80.2150],
      [6.5544, 80.1350],
      [6.4944, 80.0550],
      [6.4344, 79.9850],
      [6.4044, 79.9350], // Kalutara (mouth)
    ],
  },
  {
    name: "Mahaweli River",
    code: "MHL",
    color: "#0284c7", // Dark blue
    coordinates: [
      [7.0044, 80.7650], // Source area (Horton Plains)
      [7.1544, 80.6850],
      [7.2944, 80.6350],
      [7.4044, 80.6550],
      [7.5044, 80.7050],
      [7.6044, 80.7550],
      [7.7044, 80.8050],
      [7.8044, 80.8750],
      [7.9044, 80.9350],
      [8.0544, 80.9850],
      [8.2544, 81.0850],
      [8.4544, 81.1850],
      [8.5744, 81.2450], // Trincomalee (mouth)
    ],
  },
  {
    name: "Nilwala River",
    code: "NWL",
    color: "#06b6d4", // Cyan
    coordinates: [
      [6.3344, 80.5250], // Source
      [6.2744, 80.4350],
      [6.2144, 80.3450],
      [6.1544, 80.2650],
      [6.1044, 80.1950],
      [6.0544, 80.1350], // Matara (mouth)
    ],
  },
  {
    name: "Gin River",
    code: "GIN",
    color: "#14b8a6", // Teal
    coordinates: [
      [6.4544, 80.3850], // Source
      [6.3944, 80.3050],
      [6.3344, 80.2250],
      [6.2744, 80.1450],
      [6.2044, 80.0650],
      [6.1244, 80.0150], // Gintota (mouth)
    ],
  },
  {
    name: "Walawe River",
    code: "WLW",
    color: "#22c55e", // Green
    coordinates: [
      [6.8044, 80.7050], // Source (Horton Plains)
      [6.7044, 80.6050],
      [6.5544, 80.5550],
      [6.4044, 80.5850],
      [6.2544, 80.6150],
      [6.1544, 80.6550],
      [6.0744, 80.7050], // Ambalantota (mouth)
    ],
  },
  {
    name: "Deduru Oya",
    code: "DDR",
    color: "#8b5cf6", // Purple
    coordinates: [
      [7.5044, 80.4550], // Source
      [7.5544, 80.3550],
      [7.6044, 80.2550],
      [7.6544, 80.1550],
      [7.7044, 80.0550],
      [7.7344, 79.9550], // Chilaw (mouth)
    ],
  },
  {
    name: "Ma Oya",
    code: "MAO",
    color: "#a855f7", // Purple
    coordinates: [
      [7.3544, 80.4050], // Source
      [7.3744, 80.3050],
      [7.3944, 80.2050],
      [7.4144, 80.1050],
      [7.4144, 80.0050],
      [7.3944, 79.9050], // Negombo area (mouth)
    ],
  },
  {
    name: "Attanagalu Oya",
    code: "ATG",
    color: "#ec4899", // Pink
    coordinates: [
      [7.1544, 80.1550], // Source
      [7.1244, 80.0750],
      [7.0944, 79.9950],
      [7.0544, 79.9250],
      [7.0144, 79.8750], // Negombo lagoon (mouth)
    ],
  },
  {
    name: "Maha Oya",
    code: "MHO",
    color: "#f97316", // Orange
    coordinates: [
      [7.4544, 80.5550], // Source
      [7.4244, 80.4550],
      [7.3944, 80.3550],
      [7.3644, 80.2550],
      [7.3344, 80.1550],
      [7.3044, 80.0550], // Kochchikade (mouth)
    ],
  },
  {
    name: "Kala Oya",
    code: "KLO",
    color: "#eab308", // Yellow
    coordinates: [
      [8.0544, 80.4550], // Anuradhapura area
      [8.1544, 80.3550],
      [8.2544, 80.2550],
      [8.3544, 80.1550],
      [8.4044, 80.0550], // Puttalam lagoon (mouth)
    ],
  },
  {
    name: "Yan Oya",
    code: "YNO",
    color: "#84cc16", // Lime
    coordinates: [
      [8.2544, 80.8550], // Source
      [8.3544, 80.9050],
      [8.4544, 80.9550],
      [8.5544, 81.0050],
      [8.6544, 81.0550], // Trincomalee (mouth)
    ],
  },
  {
    name: "Mundeni Aru",
    code: "MDA",
    color: "#10b981", // Emerald
    coordinates: [
      [7.4044, 81.2550], // Source
      [7.5044, 81.3050],
      [7.6044, 81.3550],
      [7.7044, 81.4050],
      [7.8044, 81.4550], // East coast (mouth)
    ],
  },
];

// Function to get river path by code
export function getRiverPath(code: string): RiverPath | undefined {
  return riverPaths.find(r => r.code === code);
}

// Function to get all river codes
export function getRiverCodes(): string[] {
  return riverPaths.map(r => r.code);
}
