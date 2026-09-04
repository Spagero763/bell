// AAPLc on Base, hourly, 28 to 31 August 2026, reconstructed from Uniswap V3 swap
// events on the 0.05% USDC pool at 0xa3b1e3f9747065e2073722ff4c9027d3ea4994f0.
// Prices are the last trade in each hour, volumes the USDC crossed in it.

export const HOURS = 77;
export const CLOSE_INDEX = 3; // Friday 16:00 ET, last print before the feed froze
export const BELL_INDEX = 69; // Monday 09:30 ET falls inside this hour
export const CLOSE_PRICE = 319.98;

export const PRICES = [
  321.01, 319.71, 319.95, 319.98, 320.19, 320.16, 320.16, 320.0, 320.2, 320.24, 321.39, 321.4,
  321.39, 321.28, 321.06, 321.52, 321.47, 321.4, 321.32, 321.31, 321.11, 320.6, 320.68, 320.63,
  320.86, 320.79, 320.76, 320.6, 320.6, 320.53, 320.53, 320.52, 320.34, 320.57, 320.61, 320.45,
  320.49, 320.52, 320.54, 320.53, 320.79, 320.77, 321.09, 321.2, 321.6, 320.95, 321.01, 321.18,
  321.38, 321.34, 321.31, 321.31, 321.23, 321.14, 319.88, 318.91, 319.48, 319.46, 319.19, 319.42,
  319.79, 319.81, 319.46, 319.07, 319.66, 319.84, 319.81, 319.15, 319.13, 317.78, 315.69, 314.96,
  313.96, 315.27, 315.52, 317.21, 316.82,
];

export const VOLUMES = [
  298005, 184234, 120950, 293992, 101087, 24356, 87805, 281245, 60157, 42307, 142398, 27793, 12675,
  22911, 31043, 77780, 42781, 67523, 41610, 4278, 63018, 319709, 90197, 14158, 82330, 84036, 23529,
  88502, 23630, 120731, 7267, 13122, 110336, 129074, 25155, 147802, 186995, 50447, 29799, 17337,
  133929, 163875, 96516, 23009, 132521, 82556, 43431, 45254, 37492, 43696, 34277, 18624, 32307,
  96511, 413012, 210475, 110156, 61486, 59494, 57755, 58727, 82742, 68008, 70457, 197004, 63503,
  34230, 165777, 113363, 1032821, 312748, 199917, 223562, 217093, 376228, 250982, 54408,
];

export function labelFor(i: number) {
  const days = ["Fri", "Sat", "Sun", "Mon"];
  const starts = [12, 0, 0, 0];
  let d = 0;
  let idx = i;
  const lengths = [12, 24, 24, 17];
  while (idx >= lengths[d]) {
    idx -= lengths[d];
    d++;
  }
  const hour = starts[d] + idx;
  return `${days[d]} ${String(hour).padStart(2, "0")}:00 ET`;
}

export const FACTS = {
  swaps: 16909,
  volume: 5629032,
  blackoutHours: 65.5,
  low: 318.73,
  high: 321.99,
  preBell: 319.88,
  thirtyAfter: 317.78,
  mondayLow: 313.43,
  rushVolume: 1032821,
  rushSwaps: 1218,
};
