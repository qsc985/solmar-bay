// The story: Danny Reyes, a driver for hire in Solmar Bay, works off a debt
// to the fixer Lena Cruz. Five missions, then free roam with taxi fares. Each
// mission is a small state machine: an objective, a target point, and the thing
// that completes it. Coordinates are world units on the 2600 x 1900 map.
export const MISSION_DEFS = [
  {
    id: 'fare', name: 'First Fare', reward: 150,
    brief: 'Lena: "A client waits at the hotel. Take the yellow taxi and bring him to the pier — and don\'t scratch it."',
    objective: 'Get in the taxi, then drive to the pier marker',
    start: { x: 500, y: 460 }, // taxi depot
    target: { x: 2050, y: 1560, r: 70 }, // pier
    kind: 'drive',
  },
  {
    id: 'package', name: 'The Package', reward: 200,
    brief: 'Lena: "A package is stashed in the alley behind the market. Walk it to the docks — on foot, no attention."',
    objective: 'Pick up the package (E), then walk it to the docks',
    start: { x: 1100, y: 950 },
    pickup: { x: 1130, y: 1010, r: 34 },
    target: { x: 2080, y: 1360, r: 70 },
    kind: 'fetch',
  },
  {
    id: 'wheels', name: 'Hot Wheels', reward: 350,
    brief: 'Lena: "A red Comet GT sits in the showroom lot on 5th. Borrow it. The cops will notice — lose them."',
    objective: 'Steal the red sports car, then lose your wanted level',
    start: { x: 1700, y: 700 },
    target: { x: 1700, y: 700, r: 60 }, // showroom lot
    kind: 'steal',
  },
  {
    id: 'payback', name: 'Payback', reward: 500,
    brief: 'Lena: "The Vipers jumped one of my drivers at the docks. Four of them. Make it even."',
    objective: 'Defeat all 4 Vipers at the docks',
    start: { x: 2050, y: 1300 },
    target: { x: 2120, y: 1360, r: 130 },
    kind: 'fight',
  },
  {
    id: 'score', name: 'The Big Score', reward: 1000,
    brief: 'Lena: "Solmar Bank, noon. Grab the bag, and whatever you do — don\'t get caught. Meet me at the safehouse."',
    objective: 'Grab the cash at the bank, then reach the safehouse',
    start: { x: 1150, y: 760 },
    pickup: { x: 1180, y: 790, r: 34 },
    target: { x: 240, y: 270, r: 80 },
    kind: 'score',
  },
];

export function createMissions() {
  return {
    index: 0, // 0..4 story, 5 = free roam
    stage: 'go', // go | pickup | deliver | escape | done
    done: false,
    banner: '', bannerT: 0,
    dialogue: '', dialogueT: 0,
    fare: null, // active taxi fare {from, to, pay}
    killed: 0, // Vipers down in the Payback mission
  };
}

export function currentMission(M) {
  return MISSION_DEFS[M.index] ?? null;
}

// The marker the renderer draws for the current objective, or null.
export function missionTarget(M) {
  const m = currentMission(M);
  if (!m) return null;
  if (m.id === 'wheels' && M.stage === 'escape') return null; // no marker while losing the cops
  if (M.stage === 'pickup' && m.pickup) return m.pickup;
  return m.target;
}

export function setBanner(M, text, t = 2.6) {
  M.banner = text;
  M.bannerT = t;
}

export function setDialogue(M, text, t = 5) {
  M.dialogue = text;
  M.dialogueT = t;
}

export function updateMissions(M, dt) {
  M.bannerT = Math.max(0, M.bannerT - dt);
  M.dialogueT = Math.max(0, M.dialogueT - dt);
}

// A repeatable taxi fare for free roam: pick a random hotel/casino, drive the client there.
export function startFare(rng, city) {
  const spots = [
    { x: 500, y: 200, name: 'Hotel Miramar' },
    { x: 2300, y: 450, name: 'Casino Sol' },
    { x: 200, y: 1450, name: 'Marina' },
    { x: 1400, y: 200, name: 'Airport' },
    { x: 2300, y: 1700, name: 'Pier' },
    { x: 800, y: 1200, name: 'Plaza' },
  ];
  const to = rng.pick(spots);
  return { to, pay: rng.int(40, 90) };
}
