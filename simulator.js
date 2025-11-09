const SHIP_CLASSES = [
  {
    id: 'corvette',
    name: 'Corvette',
    attack: 45,
    defense: 25,
    hull: 300,
    speed: 90,
    shieldLevel: 0,
    shieldCapacity: 0,
    shieldRegen: 0,
    archetype: 'skirmish',
    category: 'escort'
  },
  {
    id: 'destroyer',
    name: 'Destroyer',
    attack: 70,
    defense: 55,
    hull: 550,
    speed: 65,
    shieldLevel: 1,
    shieldCapacity: 200,
    shieldRegen: 10,
    archetype: 'escort',
    category: 'escort'
  },
  {
    id: 'heavy_frigate',
    name: 'Heavy Frigate',
    attack: 90,
    defense: 75,
    hull: 800,
    speed: 45,
    shieldLevel: 2,
    shieldCapacity: 300,
    shieldRegen: 15,
    archetype: 'line',
    category: 'capital'
  },
  {
    id: 'cruiser',
    name: 'Cruiser',
    attack: 130,
    defense: 90,
    hull: 1200,
    speed: 35,
    shieldLevel: 3,
    shieldCapacity: 500,
    shieldRegen: 20,
    archetype: 'line',
    category: 'capital'
  },
  {
    id: 'battleship',
    name: 'Battleship',
    attack: 190,
    defense: 130,
    hull: 2000,
    speed: 20,
    shieldLevel: 4,
    shieldCapacity: 800,
    shieldRegen: 25,
    archetype: 'capital',
    category: 'capital'
  },
  {
    id: 'mega_station',
    name: 'Mega Battle Station',
    attack: 1300,
    defense: 900,
    hull: 12000,
    speed: 0,
    shieldLevel: 5,
    shieldCapacity: 5000,
    shieldRegen: 50,
    archetype: 'anchor',
    category: 'super'
  }
];

const CLASS_LOOKUP = SHIP_CLASSES.reduce((acc, cls) => {
  acc[cls.id] = cls;
  return acc;
}, {});

const DAMAGE_POOL_WEIGHTS = {
  escort: 0.24,
  line: 0.26,
  capital: 0.3,
  super: 0.2
};

const BASELINE_SHIELD_PIERCE = 0.12;
const GLOBAL_SHIELD_REGEN_PENALTY = -0.25;
const ATTRITION_BASE_PERCENT = 0.012;
const LOW_MORALE_ATTRITION_PENALTY = 0.006;
const CRITICAL_MORALE_ATTRITION_PENALTY = 0.004;

const REPAIR_COST_RANGES = {
  corvette: { min: 100, max: 500 },
  destroyer: { min: 300, max: 700 },
  heavy_frigate: { min: 700, max: 1400 },
  cruiser: { min: 1300, max: 1800 },
  battleship: { min: 2000, max: 3000 }
};

const COMMANDERS = [
  {
    id: 'none',
    name: 'No Assigned Commander',
    summary: 'Baseline operations with standard discipline.',
    traits: ['Unassigned'],
    flavor: 'Deck chiefs handle the board in shifts.',
    border: 'grid',
    effects: {}
  },
  {
    id: 'vahl',
    name: 'Cmdr. Serin Vahl',
    summary: '+5% accuracy and +3 initiative (sensor prodigy).',
    traits: ['Tactician', 'Sensor Prodigy'],
    flavor: '“No ghost-lock survives a cold equation.”',
    border: 'grid',
    effects: { accuracyBonus: 0.05, initiativeBonus: 3 }
  },
  {
    id: 'cole',
    name: 'Cmdr. Idris Cole',
    summary: '+10% shield regeneration and +5 morale each round.',
    traits: ['Bulwark', 'Stalwart'],
    flavor: '“Hold the line. The choir sings for us.”',
    border: 'shield',
    effects: { shieldRegenMult: 0.1, moralePerRound: 5 }
  },
  {
    id: 'eztan',
    name: 'Cmdr. Mara Eztan',
    summary: '+6 initiative, +5% withdraw success (hit-and-fade specialist).',
    traits: ['Harrier', 'Zealot'],
    flavor: '“Speed is absolution. Strike and fade.”',
    border: 'flare',
    effects: { initiativeBonus: 6, withdrawBonus: 0.05 }
  },
  {
    id: 'sar',
    name: 'Commodore Nyla Sar',
    summary: '+6% damage output, -4% incoming damage (decisive tactician).',
    traits: ['Tactician', 'Resolute'],
    flavor: '“Break them cleanly and tend the wounded later.”',
    border: 'grid',
    effects: { damageMult: 0.06, incomingDamageMult: -0.04 }
  }
];

const COMMANDER_QUIPS = {
  none: {
    victory: 'Deck control reports stable lines. Requesting next drill.',
    defeat: 'Auxiliary crews note morale dip; awaiting directives.',
    stalemate: 'Ops chatter: “We held. Barely.”',
    withdrawal: 'Deck chiefs log the withdrawal as orderly, pending review.'
  },
  vahl: {
    victory: '“Angles aligned. Push before their ghosts settle.”',
    defeat: '“Static lied to us. I will recalibrate every node.”',
    stalemate: '“Sensors say enough. Next pass, we own the lattice.”',
    withdrawal: '“Slip the net. We strike again once the choir fades.”'
  },
  cole: {
    victory: '“Shield crews sing. Let the wounded rest easy.”',
    defeat: '“We bend but do not break. Recycle the capacitors.”',
    stalemate: '“Hold fast. We buy time for the sector.”',
    withdrawal: '“Everyone home. Recharge, regroup, return.”'
  },
  eztan: {
    victory: '“See? Hit-and-fade, and the void applauds.”',
    defeat: '“They tagged us. Next time, we vanish between breaths.”',
    stalemate: '“They matched our tempo. Unacceptable. Adjust vectors.”',
    withdrawal: '“Engines hot. We choose the next field.”'
  },
  sar: {
    victory: '“Formations hold. Catalog the wreckage for intel.”',
    defeat: '“We ceded ground. Refit and ready the reserve.”',
    stalemate: '“No trophies, no graves. We reset the board.”',
    withdrawal: '“Orderly retreat. Prepare the counterstroke.”'
  }
};

function getCommanderQuip(commanderId, outcomeType) {
  const normalized = outcomeType.toLowerCase();
  let key = 'stalemate';
  if (normalized.includes('victory')) key = 'victory';
  else if (normalized.includes('defeat')) key = 'defeat';
  else if (normalized.includes('withdraw')) key = 'withdrawal';
  const quips = COMMANDER_QUIPS[commanderId] || COMMANDER_QUIPS.none;
  return quips[key] || COMMANDER_QUIPS.none[key];
}

const FORMATIONS = [
  {
    id: 'spearhead',
    name: 'Spearhead',
    summary: '+15% attack, but +10% incoming damage from exposed flanks.',
    quote: '“Drive through their centerline.”',
    cardEffects: '+15% dmg | -10% defense | +2 init',
    effects: { damageMult: 0.15, incomingDamageMult: 0.1, initiativeBonus: 2 }
  },
  {
    id: 'phalanx',
    name: 'Phalanx',
    summary: '+10% defense, +25% shield regen, -4 initiative.',
    quote: '“Interlock shields. Nothing breaches.”',
    cardEffects: '-10% dmg taken | +25% regen | -4 init',
    effects: { incomingDamageMult: -0.1, shieldRegenMult: 0.25, initiativeBonus: -4 }
  },
  {
    id: 'dispersed',
    name: 'Dispersed Line',
    summary: '+10% evasion (damage reduction) but -8% accuracy.',
    quote: '“Keep them chasing ghosts.”',
    cardEffects: '-10% dmg taken | -8% accuracy | +1 init',
    effects: { incomingDamageMult: -0.1, accuracyBonus: -0.08, initiativeBonus: 1 }
  }
];

const TACTICS = [
  {
    id: 'aggressive',
    name: 'Aggressive',
    summary: 'Damage spikes (+25% R1, +15% later), +5% crit, but +10% incoming damage and -5% shield regen.',
    quote: '“Fire before they even steady their aim.”',
    cardEffects: '+25% dmg R1 | +5% crit | fragile',
    roundEffects: (round) => ({
      damageMult: round === 1 ? 0.25 : 0.15,
      critBonus: 0.05,
      incomingDamageMult: 0.1,
      shieldRegenMult: -0.05
    })
  },
  {
    id: 'balanced',
    name: 'Balanced',
    summary: '+5% accuracy, +5% damage, -5% incoming damage, +8 morale at end of round.',
    quote: '“Measure twice. Cut once.”',
    cardEffects: '+5% acc | +5% dmg | +8 morale',
    roundEffects: () => ({
      accuracyBonus: 0.05,
      damageMult: 0.05,
      incomingDamageMult: -0.05,
      moralePerRound: 8
    })
  },
  {
    id: 'defensive',
    name: 'Defensive',
    summary: '-15% damage, +30% shield regen, +10% shield cap, +10% withdraw success, escorts +5% evasion.',
    quote: '“Let them exhaust themselves on the bulwark.”',
    cardEffects: '+30% regen | +10% cap | safer withdraw',
    roundEffects: () => ({
      damageMult: -0.15,
      shieldRegenMult: 0.3,
      shieldCapMult: 0.1,
      incomingDamageMult: -0.05,
      withdrawBonus: 0.1
    })
  }
];

const THEATERS = [
  {
    id: 'gas_giant',
    name: 'Gas-Giant Storm Layer',
    summary: 'Storm-choir interference: beam accuracy ↓, shield regen ↑.',
    describe: 'Sensor static and storm-choirs scramble targeting but energize shield capacitors.',
    skin: 'gas_giant',
    helper: 'Storm lightning crackles across the command glass.',
    effects: () => ({ accuracyBonus: -0.05, shieldRegenMult: 0.18, initiativeBonus: -2 }),
    events: ['storm_static', 'choir_surge']
  },
  {
    id: 'asteroid_belt',
    name: 'Asteroid Belt',
    summary: 'Debris swarms: escorts weave free, capitals risk hull strikes.',
    describe: 'Dense rock fields favor evasive craft; capital signatures struggle to maneuver cleanly.',
    skin: 'asteroid_belt',
    helper: 'Collision alarms ping across the deck.',
    effects: () => ({ incomingDamageMult: -0.05, initiativeBonus: -3, collisionRisk: true }),
    events: ['debris_screen', 'impact_warning']
  },
  {
    id: 'station_yard',
    name: 'Station Yard / High Orbit',
    summary: 'Orbital batteries lend fire; civilian lanes demand precision.',
    describe: 'Orbital defenses bolster accuracy while defensive grids catch stray fire.',
    skin: 'station_yard',
    helper: 'Station controllers feed firing solutions into the deck.',
    effects: () => ({ damageMult: 0.05, incomingDamageMult: -0.03, moralePerRound: 2 }),
    events: ['turret_assist', 'civilian_lane']
  },
  {
    id: 'graveglass',
    name: 'Graveglass Veil / Nebula',
    summary: 'Ghost-lock echoes: targeting hazy, initiative slips.',
    describe: 'Nebular interference muddles initiative and causes misfire checks.',
    skin: 'graveglass',
    helper: 'Spectral contacts hum just beyond sensor tolerances.',
    effects: () => ({ accuracyBonus: -0.03, initiativeBonus: -4, ghostLock: true }),
    events: ['ghost_ping', 'nebula_shear']
  },
  {
    id: 'temporal_slip',
    name: 'Temporal-Slip Corridor',
    summary: 'Time-shear: initiative shuffles, critical anomalies spike.',
    describe: 'Reality twitches; time-skews can produce anomalous results and risky retreats.',
    skin: 'temporal_slip',
    helper: 'Chronometers desync—crew whisper of déjà vu.',
    effects: () => ({ initiativeChaos: true, critBonus: 0.05 }),
    events: ['time_echo', 'retrograde_wave']
  },
  {
    id: 'intense_firefight',
    name: 'Intense Firefight',
    summary: 'Close-range maelstrom: shields buckle, hull attrition climbs.',
    describe: 'Battered task forces exchange brutal salvos at knifefight ranges, overwhelming defensive grids.',
    skin: 'intense_firefight',
    helper: 'Damage control reports stream in with every volley.',
    effects: () => ({ directHullFraction: 0.08, shieldRegenMult: -0.25, moralePerRound: -4 }),
    events: ['shield_breach', 'hull_quake']
  }
];

const SYNERGY_RULES = [
  {
    id: 'relay-lock',
    description: 'Cruiser Command Relay + Destroyer Target Lock → +8% hit chance R2',
    pairs: [
      { classId: 'cruiser', orderId: 'command_relay' },
      { classId: 'destroyer', orderId: 'target_lock' }
    ],
    rounds: [2]
  },
  {
    id: 'barrage-pin',
    description: 'Battleship Shock Barrage + Heavy Frigate Suppressive Volley → enemy -10% accuracy R2',
    pairs: [
      { classId: 'battleship', orderId: 'shock_barrage' },
      { classId: 'heavy_frigate', orderId: 'suppressive' }
    ],
    rounds: [2]
  },
  {
    id: 'shield-dance',
    description: 'Destroyer Shield Screen + Corvette Flank → Escorts +6% survivability R1',
    pairs: [
      { classId: 'destroyer', orderId: 'shield_screen' },
      { classId: 'corvette', orderId: 'flank' }
    ],
    rounds: [1]
  }
];

const THEATER_EVENT_DECK = {
  storm_static: {
    name: 'Storm Static',
    round: 1,
    description: 'Choir lightning blooms across the hull—sensors suffer initiative drag.',
    message: () => 'Storm static blankets the battlespace; initiative buckles under the crackle.'
  },
  choir_surge: {
    name: 'Choir Surge',
    round: 2,
    description: 'Storm harmonics refill capacitors—shield pools surge briefly.',
    message: () => 'Choir resonance dumps charge into fleet shields.'
  },
  debris_screen: {
    name: 'Debris Screen',
    round: 1,
    description: 'Escorts weave debris trails, muddling return fire.',
    message: () => 'Escort pilots spin rock clouds into impromptu cover.'
  },
  impact_warning: {
    name: 'Impact Warning',
    round: 3,
    description: 'Capital hull rattled by close-call asteroid ricochet.',
    message: () => 'Collision klaxons wail as a stray boulder scrapes the hull.'
  },
  turret_assist: {
    name: 'Orbital Assist',
    round: 1,
    description: 'Station turrets volley in-sync with allied fire.',
    message: () => 'Station turrets stitch the engagement with precision bursts.'
  },
  civilian_lane: {
    name: 'Civilian Lane Alert',
    round: 2,
    description: 'Traffic-control corridors force tempered barrages.',
    message: () => 'Civilian lane beacons flare; fleets adjust fire arcs.'
  },
  ghost_ping: {
    name: 'Ghost Ping',
    round: 1,
    description: 'Phantom signatures lace the nebula, obscuring locks.',
    message: () => 'Ghost pings ripple—target lock confidence dips.'
  },
  nebula_shear: {
    name: 'Nebula Shear',
    round: 3,
    description: 'Plasma shear destabilises beam coherence.',
    message: () => 'Nebula shear pulls energy off lance arrays.'
  },
  time_echo: {
    name: 'Time Echo',
    round: 1,
    description: 'Temporal after-images double returns.',
    message: () => 'Temporal echoes create duplicate sensor tracks.'
  },
  retrograde_wave: {
    name: 'Retrograde Wave',
    round: 2,
    description: 'Slipstream wave reverses initiative ordering briefly.',
    message: () => 'Retrograde slipwave scrambles the order of battle.'
  },
  shield_breach: {
    name: 'Shield Breach',
    round: 1,
    description: 'Overpressured shields flare and vent.',
    message: () => 'Overloaded shields vent plasma into the void.'
  },
  hull_quake: {
    name: 'Hull Quake',
    round: 2,
    description: 'Near-hit shakes morale and decks alike.',
    message: () => 'Hull-quake reverbs through every corridor.'
  }
};

const eventCardRefs = new Map();
const synergyLayers = new Map();
let cinematicMode = true;
let audioContext = null;

const THEATER_VISUAL_PATH = 'images/icons/Asteroid Belt.png';
const FLEET_NAME_DEFAULTS = { alpha: 'Fleet Alpha', beta: 'Fleet Beta' };

function getFleetPanel(side) {
  return document.querySelector(`.fleet-panel[data-side="${side}"]`);
}

function getFleetNameInput(source) {
  if (!source) return null;
  if (typeof source === 'string') {
    return getFleetPanel(source)?.querySelector('[data-fleet-name]') || null;
  }
  return source.querySelector ? source.querySelector('[data-fleet-name]') : null;
}

function resolveFleetName(side) {
  const input = getFleetNameInput(side);
  const fallback = FLEET_NAME_DEFAULTS[side] || 'Fleet';
  const value = input && typeof input.value === 'string' ? input.value.trim() : '';
  return value || fallback;
}

function defaultOrder() {
  return { id: 'none', name: 'No Special Order', summary: 'Standard firing patterns.', apply: () => ({}) };
}

const CLASS_ORDERS = {
  corvette: [
    defaultOrder(),
    {
      id: 'flank',
      name: 'Flank',
      summary: '+25% accuracy & +15% crit vs capitals; +20% damage taken.',
      apply: ({ fleet, enemy, modifiers }) => {
        modifiers.damageMult += 0.12;
        if (enemy.composition.capitalShare > 0) modifiers.damageMult += 0.05;
        modifiers.incomingDamageMult += 0.06;
        modifiers.notes.push('Corvettes execute flanking runs on capital hulls.');
      }
    },
    {
      id: 'evade',
      name: 'Evade Pattern',
      summary: '+30% evasion, -30% damage; safer through debris.',
      apply: ({ modifiers }) => {
        modifiers.damageMult -= 0.18;
        modifiers.incomingDamageMult -= 0.12;
        modifiers.notes.push('Corvette screen jukes incoming fire.');
      }
    },
    {
      id: 'overdrive',
      name: 'Overdrive',
      summary: '+20 initiative, +15% damage, -10% accuracy, 10% self-hull tick.',
      apply: ({ fleet, roundReport, modifiers }) => {
        modifiers.damageMult += 0.1;
        modifiers.initiativeBonus += 5;
        modifiers.accuracyBonus -= 0.05;
        roundReport.selfDamage.push({ classId: 'corvette', hullPercent: 0.1, note: 'Corvette overdrive strain.' });
        modifiers.notes.push('Corvette engines redline for initiative.');
      }
    }
  ],
  destroyer: [
    defaultOrder(),
    {
      id: 'shield_screen',
      name: 'Shield Screen',
      summary: 'Redirect 25% hits from escorts; +20% Destroyer shield cap.',
      apply: ({ modifiers }) => {
        modifiers.incomingDamageMult -= 0.05;
        modifiers.shieldCapMult += 0.2;
        modifiers.notes.push('Destroyers raise a protective lattice.');
      }
    },
    {
      id: 'target_lock',
      name: 'Target Lock (Matrix)',
      summary: '+20% accuracy, +10% crit vs escorts; ignore 20% evasion.',
      apply: ({ modifiers }) => {
        modifiers.damageMult += 0.14;
        modifiers.accuracyBonus += 0.08;
        modifiers.notes.push('Destroyer fire-control locks hard on escorts.');
      }
    },
    {
      id: 'pd_overclock',
      name: 'PD Overclock',
      summary: '+50% intercepts; -10% main damage, -5% regen.',
      apply: ({ modifiers }) => {
        modifiers.damageMult -= 0.1;
        modifiers.shieldRegenMult -= 0.05;
        modifiers.notes.push('Destroyer PD grids siphon power from primaries.');
      }
    }
  ],
  heavy_frigate: [
    defaultOrder(),
    {
      id: 'suppressive',
      name: 'Suppressive Volley',
      summary: 'Enemy -15% accuracy & -10% evasion next round; frigates -10% damage now.',
      apply: ({ enemy, round, modifiers }) => {
        modifiers.damageMult -= 0.1;
        enemy.statuses.pending.push({
          round: round + 1,
          type: 'debuff',
          accuracyBonus: -0.15,
          incomingDamageMult: -0.1,
          description: 'Suppressed by heavy frigate barrages.'
        });
        modifiers.notes.push('Heavy frigate barrages suppress enemy sensors.');
      }
    },
    {
      id: 'focus_fire',
      name: 'Focus Fire',
      summary: '+25% damage vs chosen class; -50% vs others.',
      requiresTarget: true,
      targetPrompt: 'Target focus',
      apply: ({ enemy, order, modifiers }) => {
        if (order?.target && enemy.composition.classPresence[order.target]) {
          modifiers.damageMult += 0.25;
          modifiers.notes.push(`Heavy frigates concentrate fire on ${CLASS_LOOKUP[order.target].name}.`);
        } else {
          modifiers.damageMult -= 0.5;
          modifiers.notes.push('Heavy frigates cannot find the designated target.');
        }
      }
    }
  ],
  cruiser: [
    defaultOrder(),
    {
      id: 'broadside',
      name: 'Broadside',
      summary: '+35% damage, cannot use consecutively.',
      cooldown: 1,
      apply: ({ fleet, modifiers, roundReport }) => {
        if (!canUseOrder(fleet, 'broadside')) {
          roundReport.messages.push('Cruiser broadside batteries are still resetting (cooldown).');
          return;
        }
        markOrderUsed(fleet, 'broadside', 2);
        modifiers.damageMult += 0.28;
        modifiers.notes.push('Cruiser broadsides unleash full salvos.');
      }
    },
    {
      id: 'lance_overcharge',
      name: 'Lance Overcharge',
      summary: '50% shield pierce, +20% vs capitals; -20% shield cap next round.',
      apply: ({ fleet, enemy, modifiers, roundReport }) => {
        modifiers.damageMult += 0.12;
        modifiers.directHullFraction += 0.5;
        if (enemy.composition.capitalShare > 0) modifiers.damageMult += 0.08;
        fleet.statuses.pending.push({
          round: roundReport.round + 1,
          type: 'self',
          shieldCapMult: -0.2,
          description: 'Cruiser capacitors recovering from overcharge.'
        });
        modifiers.notes.push('Cruiser lances overcharge for shield-piercing strikes.');
      }
    },
    {
      id: 'command_relay',
      name: 'Command Relay',
      summary: 'Fleet +10% command sync & +10 morale; cruisers -20% damage.',
      apply: ({ fleet, modifiers, roundReport }) => {
        modifiers.damageMult -= 0.2;
        roundReport.moraleDelta += 10;
        modifiers.globalDamageMult += 0.1;
        modifiers.globalIncomingDamageMult -= 0.05;
        modifiers.notes.push('Cruiser relays amplify fleet coordination.');
      }
    }
  ],
  battleship: [
    defaultOrder(),
    {
      id: 'spinal_salvo',
      name: 'Spinal Salvo',
      summary: '+120% burst to one capital target; cooldown 1.',
      apply: ({ fleet, enemy, modifiers, roundReport }) => {
        if (!canUseOrder(fleet, 'spinal_salvo')) {
          roundReport.messages.push('Battleship spinal salvo still reloading (cooldown).');
          return;
        }
        markOrderUsed(fleet, 'spinal_salvo', 2);
        modifiers.damageMult += 0.5;
        modifiers.directHullFraction += 0.4;
        modifiers.notes.push('Battleship spinal salvo targets enemy capital core.');
        roundReport.messages.push('Spinal salvo prioritizes the densest enemy capital signature.');
      }
    },
    {
      id: 'fortress_posture',
      name: 'Fortress Posture',
      summary: '+25% armor & PD, +20% shield regen; -20 initiative, -15% damage.',
      apply: ({ modifiers }) => {
        modifiers.damageMult -= 0.15;
        modifiers.incomingDamageMult -= 0.08;
        modifiers.shieldRegenMult += 0.2;
        modifiers.initiativeBonus -= 5;
        modifiers.notes.push('Battleships lock into fortress posture.');
      }
    },
    {
      id: 'command_beacon',
      name: 'Command Beacon',
      summary: 'Fleet +10% accuracy & +10% crit; escorts +10% evasion; battleship -50% damage.',
      apply: ({ modifiers, roundReport }) => {
        modifiers.damageMult -= 0.5;
        modifiers.globalDamageMult += 0.15;
        modifiers.globalIncomingDamageMult -= 0.05;
        roundReport.moraleDelta += 6;
        modifiers.notes.push('Battleship broadcasts command beacon across the fleet.');
      }
    },
    {
      id: 'shock_barrage',
      name: 'Shock Barrage',
      summary: 'Enemy -20% accuracy & -15% shield regen next round.',
      apply: ({ enemy, round, modifiers }) => {
        enemy.statuses.pending.push({
          round: round + 1,
          type: 'debuff',
          accuracyBonus: -0.2,
          shieldRegenMult: -0.15,
          description: 'Shaken by battleship shock barrage.'
        });
        modifiers.notes.push('Battleship shock barrage disrupts enemy fire-control.');
      }
    }
  ],
  mega_station: [
    defaultOrder(),
    {
      id: 'bastion_shield',
      name: 'Bastion Shield',
      summary: 'Fleet +15% regen & +10% cap; station weapons offline this round.',
      apply: ({ modifiers, roundReport }) => {
        modifiers.shieldRegenMult += 0.15;
        modifiers.shieldCapMult += 0.1;
        modifiers.damageMult -= 1;
        modifiers.notes.push('Station diverts power to fleet-wide bastion shield.');
        roundReport.messages.push('Station heavy batteries go silent while the bastion shield hums.');
      }
    },
    {
      id: 'cataclysm_lance',
      name: 'Cataclysm Lance',
      summary: 'Ignores 60% shields; max 2 uses.',
      apply: ({ fleet, modifiers, roundReport }) => {
        const uses = fleet.statuses.stationCataclysmUses || 0;
        if (uses >= 2) {
          roundReport.messages.push('Cataclysm Lance safety interlocks prevent further firing.');
          return;
        }
        fleet.statuses.stationCataclysmUses = uses + 1;
        modifiers.damageMult += 0.32;
        modifiers.directHullFraction += 0.6;
        modifiers.notes.push('Station fires the Cataclysm Lance through enemy shields.');
      }
    },
    {
      id: 'grav_well',
      name: 'Grav-Well Snare',
      summary: 'Enemy withdraw chance 0%, enemies -10 initiative / evasion.',
      apply: ({ enemy, modifiers, roundReport }) => {
        enemy.statuses.withdrawLocked = true;
        enemy.statuses.pending.push({
          round: roundReport.round,
          type: 'debuff',
          initiativeBonus: -5,
          incomingDamageMult: 0.05,
          description: 'Caught in grav-well snare.'
        });
        modifiers.notes.push('Grav-well snare anchors the battlespace.');
      }
    },
    {
      id: 'dock_repair',
      name: 'Dock & Repair',
      summary: 'Restore 12% hull and +300 shields to a friendly cruiser/battleship.',
      apply: ({ fleet, roundReport }) => {
        const cruiserState = fleet.classStates.cruiser;
        const battleshipState = fleet.classStates.battleship;
        const candidates = [cruiserState, battleshipState]
          .filter((state) => state && computeSurvivorCount(state) > 0)
          .sort((a, b) => {
            const missingA = a.hullPerShip * a.initialCount - a.currentHull;
            const missingB = b.hullPerShip * b.initialCount - b.currentHull;
            return missingB - missingA;
          });
        const targetState = candidates[0];
        if (!targetState) {
          roundReport.messages.push('No cruiser or battleship available for dock repairs.');
          return;
        }
        const maxHull = targetState.hullPerShip * targetState.initialCount;
        const healHull = maxHull * 0.12;
        const hullMissing = Math.max(0, maxHull - targetState.currentHull);
        const hullRestored = Math.min(hullMissing, healHull);
        targetState.currentHull += hullRestored;
        const survivors = computeSurvivorCount(targetState);
        const classCap = targetState.shieldPerShip * survivors;
        const healShield = 300 * survivors;
        const shieldMissing = Math.max(0, classCap - targetState.currentShields);
        const shieldRestored = Math.min(shieldMissing, healShield);
        targetState.currentShields += shieldRestored;
        syncPoolState(fleet.pools[targetState.poolId]);
        recalcFleetVitals(fleet);
        roundReport.messages.push('Station dry-docks a capital hull for rapid repairs.');
        modifiers.notes.push('Dock crews patch up frontline capitals mid-fight.');
      }
    }
  ]
};

function findById(collection, id) {
  return collection.find((item) => item.id === id) || collection[0];
}

function canUseOrder(fleet, orderId) {
  const timer = fleet.statuses.cooldowns[orderId];
  return !timer || timer <= 0;
}

function markOrderUsed(fleet, orderId, cooldownRounds) {
  fleet.statuses.cooldowns[orderId] = cooldownRounds;
}

function decrementCooldowns(fleet) {
  Object.keys(fleet.statuses.cooldowns).forEach((key) => {
    if (fleet.statuses.cooldowns[key] > 0) fleet.statuses.cooldowns[key] -= 1;
  });
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPoolIdForClass(cls) {
  if (cls.category === 'escort') return 'escort';
  if (cls.category === 'super') return 'super';
  if (cls.archetype === 'line') return 'line';
  return 'capital';
}

function computeSurvivorCount(state) {
  if (!state || state.hullPerShip <= 0) return 0;
  if (state.currentHull <= 0) return 0;
  const maxHull = state.hullPerShip * (state.initialCount || 0);
  const ratio = maxHull > 0 ? state.currentHull / maxHull : 0;
  let survivors = Math.floor(state.currentHull / state.hullPerShip);
  if (ratio > 0 && ratio < 0.8 && survivors > 0) {
    survivors -= 1;
  }
  return Math.max(0, Math.min(state.initialCount || 0, survivors));
}

function computeRepairCosts(fleet) {
  const breakdown = [];
  let totalMin = 0;
  let totalMax = 0;

  SHIP_CLASSES.forEach((cls) => {
    const range = REPAIR_COST_RANGES[cls.id];
    if (!range) return;
    const count = fleet.classes[cls.id]?.count || 0;
    if (count <= 0) return;
    const state = fleet.classStates?.[cls.id];
    const hullPerShip = cls.hull;
    const initialHull = count * hullPerShip;
    const remainingHull = state ? Math.max(0, state.currentHull) : 0;
    const hullLost = Math.max(0, initialHull - remainingHull);
    if (hullLost <= 0) return;

    const survivors = state ? computeSurvivorCount(state) : 0;
    const lostShips = Math.max(0, count - survivors);
    const destroyedHull = Math.min(hullLost, lostShips * hullPerShip);
    const partialHullDamage = Math.max(0, hullLost - destroyedHull);
    const partialEquivalents = partialHullDamage / hullPerShip;

    const classMin = partialEquivalents * range.min + lostShips * range.max;
    const classMax = partialEquivalents * range.max + lostShips * range.max;
    if (classMin <= 0 && classMax <= 0) return;

    totalMin += classMin;
    totalMax += classMax;
    breakdown.push({
      classId: cls.id,
      name: cls.name,
      min: classMin,
      max: classMax
    });
  });

  return { totalMin, totalMax, breakdown };
}

function formatCredits(value) {
  return `${Math.round(value).toLocaleString()} cr`;
}

function syncPoolState(pool) {
  if (!pool) return;
  let hull = 0;
  let shields = 0;
  let defenseSum = 0;
  let shipCount = 0;
  let regen = 0;
  pool.classes.forEach((state) => {
    const survivors = computeSurvivorCount(state);
    hull += Math.max(0, state.currentHull);
    shields += Math.max(0, state.currentShields);
    defenseSum += state.defense * survivors;
    shipCount += survivors;
    regen += state.regenPerShip * survivors;
  });
  pool.currentHull = hull;
  pool.currentShields = shields;
  pool.defenseSum = defenseSum;
  pool.shipCount = shipCount;
  pool.regen = regen;
}

function recalcFleetVitals(fleet) {
  if (!fleet || !fleet.pools) return;
  let hull = 0;
  let shields = 0;
  Object.values(fleet.pools).forEach((pool) => {
    hull += pool.currentHull || 0;
    shields += pool.currentShields || 0;
  });
  fleet.currentHull = hull;
  fleet.currentShields = shields;
}

function buildFleetState(config, label) {
  const configName = typeof config.name === 'string' ? config.name.trim() : '';
  const resolvedLabel = configName || label;
  const totals = {
    attack: 0,
    defense: 0,
    hull: 0,
    shieldCapacity: 0,
    shieldRegen: 0,
    speedSum: 0,
    shipCount: 0
  };

  const classPresence = {};
  const classStates = {};
  const pools = {};

  SHIP_CLASSES.forEach((cls) => {
    const count = config.classes[cls.id]?.count || 0;
    if (count <= 0) {
      classPresence[cls.id] = 0;
      classStates[cls.id] = null;
      return;
    }
    totals.attack += cls.attack * count;
    totals.defense += cls.defense * count;
    totals.hull += cls.hull * count;
    totals.shieldCapacity += cls.shieldCapacity * count;
    totals.shieldRegen += cls.shieldRegen * count;
    totals.speedSum += cls.speed * count;
    totals.shipCount += count;
    classPresence[cls.id] = count;

    const poolId = getPoolIdForClass(cls);
    if (!pools[poolId]) {
      pools[poolId] = {
        id: poolId,
        classes: [],
        maxHull: 0,
        currentHull: 0,
        maxShields: 0,
        currentShields: 0,
        defenseSum: 0,
        shipCount: 0,
        regen: 0
      };
    }

    const state = {
      id: cls.id,
      initialCount: count,
      hullPerShip: cls.hull,
      shieldPerShip: cls.shieldCapacity,
      regenPerShip: cls.shieldRegen,
      defense: cls.defense,
      currentHull: cls.hull * count,
      currentShields: cls.shieldCapacity * count,
      poolId
    };
    classStates[cls.id] = state;

    const pool = pools[poolId];
    pool.classes.push(state);
    pool.maxHull += cls.hull * count;
    pool.currentHull += state.currentHull;
    pool.maxShields += cls.shieldCapacity * count;
    pool.currentShields += state.currentShields;
    pool.defenseSum += cls.defense * count;
    pool.shipCount += count;
    pool.regen += cls.shieldRegen * count;
  });

  Object.values(pools).forEach((pool) => {
    pool.classes.sort((a, b) => a.hullPerShip - b.hullPerShip);
    syncPoolState(pool);
  });

  const avgSpeed = totals.shipCount > 0 ? totals.speedSum / totals.shipCount : 0;
  const capitalShare = totals.hull > 0
    ? ((CLASS_LOOKUP.heavy_frigate.hull * (config.classes.heavy_frigate?.count || 0)) +
        (CLASS_LOOKUP.cruiser.hull * (config.classes.cruiser?.count || 0)) +
        (CLASS_LOOKUP.battleship.hull * (config.classes.battleship?.count || 0)) +
        (CLASS_LOOKUP.mega_station.hull * (config.classes.mega_station?.count || 0))) /
      totals.hull
    : 0;
  const escortShare = totals.hull > 0
    ? ((CLASS_LOOKUP.corvette.hull * (config.classes.corvette?.count || 0)) +
        (CLASS_LOOKUP.destroyer.hull * (config.classes.destroyer?.count || 0))) /
      totals.hull
    : 0;

  const fleet = {
    label: resolvedLabel,
    commanderId: config.commander,
    formationId: config.formation,
    tacticId: config.tactic,
    withdrawR1: config.withdrawRound1,
    withdrawR2: config.withdrawRound2,
    volley: config.volley,
    classes: config.classes,
    totals,
    currentHull: totals.hull,
    currentShields: totals.shieldCapacity,
    morale: 50,
    avgSpeed,
    statuses: {
      cooldowns: {},
      pending: [],
      withdrawLocked: false,
      stationCataclysmUses: 0,
      ghostLock: false,
      initiativeChaos: false,
      collisionRisk: false
    },
    composition: {
      combinedArms: SHIP_CLASSES.every((cls) => (config.classes[cls.id]?.count || 0) > 0),
      capitalShare: clamp(capitalShare, 0, 1),
      escortShare: clamp(escortShare, 0, 1),
      classPresence
    },
    classStates,
    pools,
    logs: []
  };

  recalcFleetVitals(fleet);
  return fleet;
}

function prepareOrders(selectEl, options) {
  selectEl.innerHTML = '';
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.id;
    option.textContent = opt.name;
    selectEl.appendChild(option);
  });
}

function updateCommanderChip(panel) {
  const select = panel.querySelector('[data-field="commander"]');
  const chip = panel.querySelector('[data-commander-chip]');
  if (!select || !chip) return;
  const commander = findById(COMMANDERS, select.value) || COMMANDERS[0];
  chip.querySelector('.commander-chip__name').textContent = commander.name;
  chip.querySelector('.commander-chip__traits').textContent = commander.flavor || commander.summary;
  const portrait = chip.querySelector('.commander-chip__portrait');
  portrait.dataset.border = commander.border || 'grid';
}

function renderDoctrineCards(panel, type, options) {
  const select = panel.querySelector(`[data-field="${type}"]`);
  const grid = panel.querySelector(`.doctrine-card-grid[data-doctrine="${type}"]`);
  if (!select || !grid) return;
  select.innerHTML = '';
  grid.innerHTML = '';
  options.forEach((item, index) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    option.dataset.summary = item.summary;
    select.appendChild(option);

    const card = document.createElement('article');
    card.className = 'doctrine-card';
    card.dataset.value = item.id;
    if (item.cooldown) card.dataset.cooldown = `Cooldown ${item.cooldown}`;
    card.innerHTML = `
      <h5 class="doctrine-card__title">${item.name}</h5>
      ${item.quote ? `<p class="doctrine-card__quote">${item.quote}</p>` : ''}
      <p class="doctrine-card__effects">${item.cardEffects || item.summary}</p>
    `;
    card.addEventListener('click', () => {
      select.value = item.id;
      grid.querySelectorAll('.doctrine-card').forEach((el) => {
        el.dataset.active = el.dataset.value === item.id ? 'true' : 'false';
      });
      panel.dispatchEvent(new Event('doctrinechange'));
      updateFleetStatus(panel);
      renderTimelinePreview();
    });
    card.tabIndex = 0;
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        card.click();
      }
    });
    if (index === 0 && !select.value) {
      select.value = item.id;
    }
    if (select.value === item.id) {
      card.dataset.active = 'true';
    }
    grid.appendChild(card);
  });
}

function capacityDotsForClass(cls) {
  if (cls.id === 'mega_station') return 1;
  if (cls.category === 'capital') return 4;
  if (cls.category === 'escort') return 6;
  return 5;
}

function updateCapacityDots(container, value, maxDots) {
  const dots = container.querySelectorAll('.capacity-dots span');
  dots.forEach((dot, index) => {
    dot.dataset.active = index < Math.min(value, maxDots) ? 'true' : 'false';
  });
  container.closest('.count-stepper').dataset.empty = value === 0 ? 'true' : 'false';
}

function buildCountSteppers(panel) {
  const countsContainer = panel.querySelector('[data-counts]');
  countsContainer.innerHTML = '';
  SHIP_CLASSES.forEach((cls) => {
    const defaultValue = cls.id === 'corvette' || cls.id === 'destroyer' ? 4 : cls.id === 'cruiser' ? 2 : 0;
    const stepper = document.createElement('div');
    stepper.className = 'count-stepper';
    stepper.dataset.classId = cls.id;
    const dots = capacityDotsForClass(cls);
    const dotsMarkup = Array.from({ length: dots })
      .map(() => '<span></span>')
      .join('');
    stepper.innerHTML = `
      <div class="count-stepper__label">
        <span>${cls.name}</span>
        <span class="count-stepper__roles">${cls.category === 'capital' ? 'Line Anchor' : cls.category === 'escort' ? 'Escort Screen' : 'Battle Asset'}</span>
      </div>
      <div class="count-stepper__controls">
        <button type="button" data-action="decrement" aria-label="Decrease ${cls.name} count">-</button>
        <input type="number" inputmode="numeric" min="0" step="1" value="${defaultValue}" data-class="${cls.id}" class="ship-count-input" aria-label="${panel.dataset.side} ${cls.name} count" />
        <button type="button" data-action="increment" aria-label="Increase ${cls.name} count">+</button>
      </div>
      <div class="count-stepper__capacity">
        <div class="capacity-dots">${dotsMarkup}</div>
      </div>
    `;
    const input = stepper.querySelector('input');
    const update = () => {
      const value = Number(input.value) || 0;
      updateCapacityDots(stepper.querySelector('.count-stepper__capacity'), value, dots);
      updateFleetStatus(panel);
      renderTimelinePreview();
    };
    stepper.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        const delta = button.dataset.action === 'increment' ? 1 : -1;
        const next = Math.max(0, (Number(input.value) || 0) + delta);
        input.value = next;
        update();
      });
    });
    input.addEventListener('change', update);
    input.addEventListener('input', update);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        document.getElementById('simulate-button').focus();
      }
    });
    updateCapacityDots(stepper.querySelector('.count-stepper__capacity'), defaultValue, dots);
    countsContainer.appendChild(stepper);
  });
}

function setupChipToggles(panel) {
  panel.querySelectorAll('.chip-toggle').forEach((chip) => {
    const input = chip.querySelector('input');
    const sync = () => {
      chip.dataset.active = input.checked ? 'true' : 'false';
      updateFleetStatus(panel);
      renderTimelinePreview();
    };
    input.addEventListener('change', sync);
    const label = chip.querySelector('label');
    if (label) {
      label.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          input.checked = !input.checked;
          input.dispatchEvent(new Event('change'));
        }
      });
    }
    sync();
  });
}

function setDoctrineSelection(panel, type, value) {
  const select = panel.querySelector(`[data-field="${type}"]`);
  const grid = panel.querySelector(`.doctrine-card-grid[data-doctrine="${type}"]`);
  if (select) select.value = value;
  if (grid) {
    grid.querySelectorAll('.doctrine-card').forEach((card) => {
      card.dataset.active = card.dataset.value === value ? 'true' : 'false';
    });
  }
}

function applyPreset(panel, preset) {
  Object.entries(preset.counts).forEach(([classId, value]) => {
    const input = panel.querySelector(`.ship-count-input[data-class="${classId}"]`);
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('change'));
    }
  });
  if (preset.doctrine?.formation) {
    setDoctrineSelection(panel, 'formation', preset.doctrine.formation);
  }
  if (preset.doctrine?.tactic) {
    setDoctrineSelection(panel, 'tactic', preset.doctrine.tactic);
  }
  updateFleetStatus(panel);
  renderTimelinePreview();
}

function applyFleetConfig(panel, config) {
  if (!config) return;
  const nameInput = getFleetNameInput(panel);
  if (nameInput) {
    const defaultName = nameInput.dataset.defaultName || FLEET_NAME_DEFAULTS[panel.dataset.side] || nameInput.value;
    const provided = typeof config.name === 'string' ? config.name.trim() : '';
    nameInput.value = provided || defaultName;
  }
  const commanderSelect = panel.querySelector('[data-field="commander"]');
  if (commanderSelect) {
    commanderSelect.value = config.commander || 'none';
    commanderSelect.dispatchEvent(new Event('change'));
  }
  if (config.formation) setDoctrineSelection(panel, 'formation', config.formation);
  if (config.tactic) setDoctrineSelection(panel, 'tactic', config.tactic);

  ['withdrawRound1', 'withdrawRound2', 'volley'].forEach((key) => {
    const map = { withdrawRound1: 'withdraw-r1', withdrawRound2: 'withdraw-r2', volley: 'volley' };
    const input = panel.querySelector(`[data-field="${map[key]}"]`);
    if (input) {
      input.checked = Boolean(config[key]);
      input.dispatchEvent(new Event('change'));
    }
  });

  Object.entries(config.classes || {}).forEach(([classId, details]) => {
    const count = details?.count ?? 0;
    const input = panel.querySelector(`.ship-count-input[data-class="${classId}"]`);
    if (input) {
      input.value = count;
      input.dispatchEvent(new Event('change'));
    }
    (details.orders || []).forEach((order, idx) => {
      const select = panel.querySelector(`.class-order-select[data-class="${classId}"][data-round="${idx + 1}"]`);
      if (!select) return;
      select.value = order?.id || 'none';
      handleOrderSelectChange(panel, select);
      const targetSelect = panel.querySelector(`.class-order-target[data-class="${classId}"][data-round="${idx + 1}"]`);
      if (targetSelect && !targetSelect.hidden && order?.target) {
        targetSelect.value = order.target;
      }
    });
  });
  updateSynergyOverlay(panel);
  updateFleetStatus(panel);
}

function buildOrderMatrix(panel) {
  const ordersContainer = panel.querySelector('[data-orders]');
  ordersContainer.innerHTML = '';
  SHIP_CLASSES.forEach((cls) => {
    const section = document.createElement('section');
    section.className = 'class-order-block';
    section.dataset.classId = cls.id;
    section.innerHTML = `<h5>${cls.name}</h5>`;
    const grid = document.createElement('div');
    grid.className = 'class-order-grid';
    section.appendChild(grid);
    const options = CLASS_ORDERS[cls.id];
    [1, 2, 3].forEach((round) => {
      const row = document.createElement('div');
      row.className = 'class-order-row';
      row.dataset.round = round;
      row.innerHTML = `<label>R${round}</label>`;
      const picker = document.createElement('div');
      picker.className = 'order-card-picker';
      const select = document.createElement('select');
      select.className = 'class-order-select visually-hidden';
      select.dataset.side = panel.dataset.side;
      select.dataset.class = cls.id;
      select.dataset.round = String(round);
      const targetSelect = document.createElement('select');
      targetSelect.className = 'class-order-target order-target-select visually-hidden';
      targetSelect.dataset.side = panel.dataset.side;
      targetSelect.dataset.class = cls.id;
      targetSelect.dataset.round = String(round);
      targetSelect.hidden = true;
      options.forEach((order, index) => {
        const option = document.createElement('option');
        option.value = order.id;
        option.textContent = order.name;
        select.appendChild(option);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'order-card';
        card.dataset.value = order.id;
        card.innerHTML = `
          <strong>${order.name}</strong>
          <span>${order.summary}</span>
        `;
        card.addEventListener('click', () => {
          select.value = order.id;
          handleOrderSelectChange(panel, select);
        });
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            card.click();
          }
        });
        if (order.id === 'none' && index === 0) {
          card.dataset.active = 'true';
        }
        picker.appendChild(card);
      });
      picker.appendChild(select);
      picker.appendChild(targetSelect);
      row.appendChild(picker);
      grid.appendChild(row);
      select.addEventListener('change', () => handleOrderSelectChange(panel, select));
      handleOrderSelectChange(panel, select);
    });
    ordersContainer.appendChild(section);
  });
  if (!synergyLayers.has(panel)) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('synergy-overlay');
    panel.querySelector('.fleet-orders').appendChild(svg);
    synergyLayers.set(panel, svg);
  }
}

function updateSynergyOverlay(panel) {
  const svg = synergyLayers.get(panel);
  if (!svg) return;
  const ordersSection = panel.querySelector('.fleet-orders');
  if (!ordersSection) return;
  const rect = ordersSection.getBoundingClientRect();
  svg.setAttribute('width', rect.width);
  svg.setAttribute('height', rect.height);
  svg.innerHTML = '';

  SYNERGY_RULES.forEach((rule) => {
    rule.rounds.forEach((round) => {
      const allMatch = rule.pairs.every(({ classId, orderId }) => {
        const select = panel.querySelector(`.class-order-select[data-class="${classId}"][data-round="${round}"]`);
        return select && select.value === orderId;
      });
      if (!allMatch) return;
      const points = rule.pairs.map(({ classId }) => {
        const row = panel.querySelector(`.class-order-block[data-class-id="${classId}"] .class-order-row[data-round="${round}"]`);
        if (!row) return null;
        const rowRect = row.getBoundingClientRect();
        return {
          x: rowRect.left + rowRect.width - rect.left,
          y: rowRect.top + rowRect.height / 2 - rect.top
        };
      }).filter(Boolean);
      if (points.length < 2) return;
      for (let i = 0; i < points.length - 1; i += 1) {
        const start = points[i];
        const end = points[i + 1];
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('synergy-line');
        line.setAttribute('x1', start.x);
        line.setAttribute('y1', start.y);
        line.setAttribute('x2', end.x);
        line.setAttribute('y2', end.y);
        line.setAttribute('data-description', rule.description);
        svg.appendChild(line);
        const pip = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pip.classList.add('synergy-pip');
        pip.setAttribute('cx', (start.x + end.x) / 2);
        pip.setAttribute('cy', (start.y + end.y) / 2);
        pip.setAttribute('r', 6);
        pip.setAttribute('data-description', rule.description);
        pip.addEventListener('mouseenter', () => {
          ordersSection.setAttribute('data-synergy-text', rule.description);
        });
        pip.addEventListener('mouseleave', () => {
          ordersSection.removeAttribute('data-synergy-text');
        });
        svg.appendChild(pip);
      }
    });
  });
}

function hashConfig(configA, configB, theaterId) {
  const json = JSON.stringify({ configA, configB, theaterId });
  let hash = 0;
  for (let i = 0; i < json.length; i += 1) {
    hash = (hash * 31 + json.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) + 1;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function runWithSeed(seed, fn) {
  const original = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function playStormCrackle() {
  if (!cinematicMode) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext = audioContext || new AudioCtx();
    const duration = 0.35;
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      const decay = 1 - i / channel.length;
      channel[i] = (Math.random() * 2 - 1) * 0.25 * decay;
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    const gain = audioContext.createGain();
    gain.gain.value = 0.35;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    source.start();
  } catch (error) {
    console.warn('Audio unavailable', error);
  }
}

function renderTheaterEvents(theater) {
  const container = document.getElementById('theater-event-cards');
  if (!container) return;
  container.innerHTML = '';
  eventCardRefs.clear();
  if (!theater?.events?.length) return;
  theater.events.forEach((eventId) => {
    const def = THEATER_EVENT_DECK[eventId];
    if (!def) return;
    const card = document.createElement('article');
    card.className = 'theater-event-card';
    card.dataset.eventId = eventId;
    card.dataset.status = 'face-down';
    card.innerHTML = `
      <header>
        <span>R${def.round}</span>
        <span>Pending</span>
      </header>
      <p>${def.description}</p>
    `;
    container.appendChild(card);
    eventCardRefs.set(eventId, card);
  });
}

function drawSparkline(canvas, datasets) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 1.5;
  datasets.forEach((dataset) => {
    const points = dataset.series;
    if (!points || points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = dataset.color;
    points.forEach((value, index) => {
      const x = (index / (points.length - 1)) * (width - 12) + 6;
      const y = height - value * (height - 12) - 6;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
}

function renderMicroSimPreview(preview) {
  const container = document.getElementById('micro-sim-sparklines');
  if (!container) return;
  container.innerHTML = '';
  if (!preview || !preview.rounds.length) {
    container.innerHTML = '<p class="micro-sim__empty">Awaiting configuration</p>';
    return;
  }
  const fleets = [
    { key: 'a', side: 'alpha', accessor: (round) => round.alphaState },
    { key: 'b', side: 'beta', accessor: (round) => round.betaState }
  ];
  fleets.forEach((fleet) => {
    const spark = document.createElement('div');
    spark.className = 'micro-sim__sparkline';
    const title = document.createElement('span');
    const previewFleet = preview.fleets?.[fleet.key];
    title.textContent = previewFleet?.label || resolveFleetName(fleet.side);
    spark.appendChild(title);
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 54;
    spark.appendChild(canvas);
    container.appendChild(spark);

    const fleetState = previewFleet;
    const totalHull = fleetState?.totals?.hull || 1;
    const totalShields = fleetState?.totals?.shieldCapacity || 1;
    const hullSeries = [1];
    const shieldSeries = [1];
    const moraleSeries = [0.5];
    preview.rounds.forEach((round) => {
      const state = fleet.accessor(round);
      hullSeries.push(totalHull > 0 ? clamp(state.hull / totalHull, 0, 1) : 0);
      shieldSeries.push(totalShields > 0 ? clamp(state.shields / totalShields, 0, 1) : 0);
      moraleSeries.push(clamp(state.morale / 100, 0, 1));
    });
    drawSparkline(canvas, [
      { series: hullSeries, color: '#f87171' },
      { series: shieldSeries, color: '#3b82f6' },
      { series: moraleSeries, color: '#f59e0b' }
    ]);
  });
}

function renderTimelinePreview() {
  const timeline = document.getElementById('round-timeline');
  const theaterSelect = document.getElementById('battle-theater');
  const theater = findById(THEATERS, theaterSelect.value);
  const configA = collectFleetConfig('alpha');
  const configB = collectFleetConfig('beta');
  const totalAlpha = Object.values(configA.classes).reduce((sum, entry) => sum + (entry?.count || 0), 0);
  const totalBeta = Object.values(configB.classes).reduce((sum, entry) => sum + (entry?.count || 0), 0);

  if (!theater || totalAlpha === 0 || totalBeta === 0) {
    if (timeline) timeline.innerHTML = '';
    renderMicroSimPreview(null);
    return;
  }

  const seed = hashConfig(configA, configB, theater.id);
  const preview = runWithSeed(seed, () => simulateBattle(configA, configB, theater));
  const stages = ['Detection', 'Engagement', 'Resolution'];
  if (timeline) {
    timeline.innerHTML = '';
    stages.forEach((stage, index) => {
      const round = preview.rounds[index];
      const step = document.createElement('div');
      step.className = 'round-timeline__step';
      step.dataset.active = round ? 'true' : 'false';
      const parts = [];
      if (round) {
        const initiative = round.initiative.includes('Alpha')
          ? 'Alpha initiative edge'
          : round.initiative.includes('Beta')
          ? 'Beta initiative edge'
          : 'Initiative contested';
        const hullSwing = Math.round(round.alphaDamage.damageToHull - round.betaDamage.damageToHull);
        const shieldSwing = Math.round(round.alphaDamage.damageToShields - round.betaDamage.damageToShields);
        const moraleDiff = Math.round(round.alphaState.morale - round.betaState.morale);

        const hullText = hullSwing === 0
          ? 'Hull exchange even'
          : hullSwing > 0
          ? `Hull Δ +${hullSwing} Alpha`
          : `Hull Δ +${Math.abs(hullSwing)} Beta`;

        let shieldText = null;
        if (Math.abs(shieldSwing) <= 1) {
          shieldText = 'Shields trading evenly';
        } else if (shieldSwing > 0) {
          shieldText = `Shields Δ +${shieldSwing} Alpha`;
        } else {
          shieldText = `Shields Δ +${Math.abs(shieldSwing)} Beta`;
        }

        const moraleText = Math.abs(moraleDiff) <= 1
          ? 'Morale steady'
          : moraleDiff > 0
          ? `Morale +${Math.abs(moraleDiff)} Alpha`
          : `Morale +${Math.abs(moraleDiff)} Beta`;

        parts.push(initiative, hullText, shieldText, moraleText);
      } else {
        parts.push('Resolution pending');
      }
      step.innerHTML = `
        <span class="round-timeline__label">${stage}</span>
        <span class="round-timeline__delta">${parts.join(' · ')}</span>
      `;
      timeline.appendChild(step);
    });
  }
  renderMicroSimPreview(preview);
}

function encodeShareSeed(configA, configB, theater) {
  const payload = {
    theater: theater?.id || THEATERS[0].id,
    alpha: configA,
    beta: configB
  };
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
}

function normaliseSeedInput(seed) {
  return seed.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
}

function decodeShareSeed(seed) {
  if (typeof seed !== 'string') {
    return { data: null, error: 'No share seed found.' };
  }
  const trimmed = seed.trim();
  if (!trimmed) {
    return { data: null, error: 'Share seed was empty.' };
  }
  const normalised = normaliseSeedInput(trimmed);
  if (!/^[A-Za-z0-9+/=]+$/.test(normalised)) {
    return { data: null, error: 'Share seed format is invalid.' };
  }
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, '=');
  try {
    const json = decodeURIComponent(escape(atob(padded)));
    const payload = JSON.parse(json);
    if (!payload || typeof payload !== 'object') {
      return { data: null, error: 'Share seed payload missing.' };
    }
    return { data: payload, error: null };
  } catch (error) {
    console.warn('Failed to decode seed', error);
    return { data: null, error: 'Share seed could not be decoded.' };
  }
}

function applyShareSeed(seed, callbacks = {}) {
  const { onError, onSuccess } = callbacks;
  const source = typeof seed === 'string' ? decodeShareSeed(seed) : { data: seed || null, error: null };
  if (source.error || !source.data) {
    if (typeof onError === 'function') {
      onError(source.error || 'Unable to load share seed.');
    }
    return false;
  }
  const data = source.data;
  if (!data.alpha || typeof data.alpha !== 'object' || !data.beta || typeof data.beta !== 'object') {
    if (typeof onError === 'function') {
      onError('Share seed is missing fleet data.');
    }
    return false;
  }
  const theaterSelect = document.getElementById('battle-theater');
  if (data.theater && findById(THEATERS, data.theater)) {
    theaterSelect.value = data.theater;
    theaterSelect.dispatchEvent(new Event('change'));
  }
  const panelAlpha = document.querySelector('.fleet-panel[data-side="alpha"]');
  const panelBeta = document.querySelector('.fleet-panel[data-side="beta"]');
  applyFleetConfig(panelAlpha, data.alpha);
  applyFleetConfig(panelBeta, data.beta);
  renderTimelinePreview();
  if (typeof onSuccess === 'function') {
    onSuccess(data);
  }
  return true;
}

function populateFleetPanel(panel) {
  const commanderSelect = panel.querySelector('[data-field="commander"]');
  commanderSelect.innerHTML = '';
  COMMANDERS.forEach((cmdr) => {
    const option = document.createElement('option');
    option.value = cmdr.id;
    option.textContent = cmdr.name;
    option.dataset.summary = cmdr.summary;
    commanderSelect.appendChild(option);
  });
  commanderSelect.addEventListener('change', () => {
    updateCommanderChip(panel);
    updateFleetStatus(panel);
    renderTimelinePreview();
  });

  renderDoctrineCards(panel, 'formation', FORMATIONS);
  renderDoctrineCards(panel, 'tactic', TACTICS);

  buildCountSteppers(panel);
  setupChipToggles(panel);
  buildOrderMatrix(panel);
  updateSynergyOverlay(panel);

  panel.addEventListener('change', (event) => {
    if (event.target.matches('.ship-count-input')) {
      updateFleetStatus(panel);
    }
    if (event.target.matches('.class-order-select')) {
      updateSynergyOverlay(panel);
      updateFleetStatus(panel);
    }
    if (event.target.matches('.class-order-target')) {
      updateFleetStatus(panel);
      renderTimelinePreview();
    }
  });

  const planToggle = panel.querySelector('[data-toggle-orders]');
  const ordersContainer = panel.querySelector('.fleet-orders__container');
  if (planToggle && ordersContainer) {
    ordersContainer.dataset.collapsed = 'true';
    planToggle.setAttribute('aria-expanded', 'false');
    planToggle.addEventListener('click', () => {
      const isCollapsed = ordersContainer.dataset.collapsed === 'true';
      ordersContainer.dataset.collapsed = isCollapsed ? 'false' : 'true';
      planToggle.dataset.open = isCollapsed ? 'true' : 'false';
      planToggle.textContent = isCollapsed ? 'Plan Orders ▼' : 'Plan Orders ▸';
      planToggle.setAttribute('aria-expanded', String(isCollapsed));
      if (!isCollapsed) {
        updateSynergyOverlay(panel);
      }
    });
  }

  const nameInput = getFleetNameInput(panel);
  if (nameInput) {
    const defaultName = nameInput.dataset.defaultName || FLEET_NAME_DEFAULTS[panel.dataset.side] || '';
    nameInput.addEventListener('input', () => {
      renderTimelinePreview();
    });
    nameInput.addEventListener('blur', () => {
      if (!nameInput.value.trim()) {
        nameInput.value = defaultName;
      }
      renderTimelinePreview();
    });
  }

  updateCommanderChip(panel);
  updateFleetStatus(panel);
}

function handleOrderSelectChange(panel, selectEl) {
  const classId = selectEl.dataset.class;
  const round = Number(selectEl.dataset.round);
  const orderId = selectEl.value;
  const targetSelect = panel.querySelector(`.class-order-target[data-class="${classId}"][data-round="${round}"]`);
  const orders = CLASS_ORDERS[classId];
  const order = orders.find((opt) => opt.id === orderId);

  const picker = selectEl.closest('.order-card-picker');
  if (picker) {
    picker.querySelectorAll('.order-card').forEach((card) => {
      card.dataset.active = card.dataset.value === orderId ? 'true' : 'false';
    });
  }

  if (order && order.requiresTarget) {
    targetSelect.hidden = false;
    targetSelect.classList.remove('visually-hidden');
    populateTargetOptions(targetSelect, order);
  } else if (targetSelect) {
    targetSelect.hidden = true;
    targetSelect.innerHTML = '';
    targetSelect.classList.add('visually-hidden');
  }
  updateFleetStatus(panel);
  updateSynergyOverlay(panel);
  renderTimelinePreview();
}

function populateTargetOptions(targetSelect, order) {
  targetSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select target';
  targetSelect.appendChild(placeholder);
  SHIP_CLASSES.forEach((cls) => {
    const option = document.createElement('option');
    option.value = cls.id;
    option.textContent = cls.name;
    targetSelect.appendChild(option);
  });
}

function updateFleetStatus(panel) {
  const statusEl = panel.querySelector('[data-status]');
  const commanderSelect = panel.querySelector('[data-field="commander"]');
  const formationSelect = panel.querySelector('[data-field="formation"]');
  const tacticSelect = panel.querySelector('[data-field="tactic"]');
  const volleyCheckbox = panel.querySelector('[data-field="volley"]');

  const counts = Array.from(panel.querySelectorAll('.ship-count-input')).map((input) => ({
    classId: input.dataset.class,
    value: Number(input.value) || 0
  }));
  const totalShips = counts.reduce((acc, item) => acc + item.value, 0);
  const combinedArms = counts.every((item) => item.value > 0);

  if (!combinedArms) {
    volleyCheckbox.checked = false;
    volleyCheckbox.disabled = true;
  } else {
    volleyCheckbox.disabled = false;
  }

  const side = panel.dataset.side;
  const rosterSlug = document.querySelector(`[data-slug="${side}-roster"] [data-slug-value]`);
  if (rosterSlug) {
    if (totalShips === 0) rosterSlug.textContent = 'Empty';
    else rosterSlug.textContent = combinedArms ? 'Nominal' : 'Gaps Detected';
  }
  const ordersSlug = document.querySelector(`[data-slug="${side}-orders"] [data-slug-value]`);
  if (ordersSlug) {
    const hasOrders = Array.from(panel.querySelectorAll('.class-order-select')).some((select) => select.value !== 'none');
    ordersSlug.textContent = hasOrders ? 'Sequenced' : 'Standby';
  }

  const commander = findById(COMMANDERS, commanderSelect.value) || COMMANDERS[0];
  const formation = findById(FORMATIONS, formationSelect.value) || FORMATIONS[0];
  const tactic = findById(TACTICS, tacticSelect.value) || TACTICS[0];

  const moraleMeter = panel.querySelector('[data-morale]');
  if (moraleMeter) {
    const current = Number(moraleMeter.dataset.current || 50);
    const track = moraleMeter.querySelector('[data-morale-value]');
    const ratio = clamp(current / 100, 0, 1);
    track.style.transform = `scaleX(${ratio})`;
    moraleMeter.querySelector('output').textContent = Math.round(current);
  }

  const volleyChip = panel.querySelector('.chip-toggle[data-toggle="volley"]');
  if (volleyChip) {
    volleyChip.dataset.synergy = combinedArms && volleyCheckbox.checked ? 'true' : 'false';
  }
  ['withdraw-r1', 'withdraw-r2'].forEach((toggle) => {
    const chip = panel.querySelector(`.chip-toggle[data-toggle="${toggle}"]`);
    if (!chip) return;
    const input = chip.querySelector('input');
    const withdrawBoost = (commander.effects && commander.effects.withdrawBonus) || tactic.id === 'defensive';
    chip.dataset.synergy = input.checked && withdrawBoost ? 'true' : 'false';
  });

  const missingClasses = counts.filter((item) => item.value === 0).map((item) => CLASS_LOOKUP[item.classId].name);
  const fragments = [];
  fragments.push(`<div><strong>Commander:</strong> ${commander.summary}</div>`);
  fragments.push(`<div><strong>Formation:</strong> ${formation.summary}</div>`);
  fragments.push(`<div><strong>Tactic:</strong> ${tactic.summary}</div>`);
  fragments.push(`<div><strong>Hull Frames:</strong> ${totalShips}</div>`);
  fragments.push(
    `<div><strong>Combined-Arms:</strong> ${combinedArms ? 'Active' : `Missing ${missingClasses.join(', ')}`}</div>`
  );
  if (volleyCheckbox.checked) {
    fragments.push('<div><strong>Volley:</strong> Coordination primed for Round 1.</div>');
  }
  statusEl.innerHTML = fragments.join('');
}

function populateTheaterControls() {
  const theaterSelect = document.getElementById('battle-theater');
  const cardGrid = document.getElementById('theater-card-grid');
  cardGrid.innerHTML = '';

  THEATERS.forEach((theater, index) => {
    const option = document.createElement('option');
    option.value = theater.id;
    option.textContent = theater.name;
    option.dataset.summary = theater.summary;
    theaterSelect.appendChild(option);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theater-card';
    card.setAttribute('role', 'option');
    card.dataset.value = theater.id;
    card.innerHTML = `
      <strong class="theater-card__name">${theater.name}</strong>
      <p class="theater-card__summary">${theater.summary}</p>
    `;
    card.addEventListener('click', () => {
      theaterSelect.value = theater.id;
      cardGrid.querySelectorAll('.theater-card').forEach((el) => {
        el.dataset.active = el.dataset.value === theater.id ? 'true' : 'false';
        el.setAttribute('aria-selected', el.dataset.active);
      });
      updateTheaterSummary();
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        card.click();
      }
    });
    if (index === 0) {
      card.dataset.active = 'true';
      card.setAttribute('aria-selected', 'true');
    }
    cardGrid.appendChild(card);
  });

  if (!theaterSelect.value && THEATERS.length) {
    theaterSelect.value = THEATERS[0].id;
  }

  theaterSelect.addEventListener('change', () => {
    const selected = theaterSelect.value;
    cardGrid.querySelectorAll('.theater-card').forEach((card) => {
      card.dataset.active = card.dataset.value === selected ? 'true' : 'false';
      card.setAttribute('aria-selected', card.dataset.active);
    });
    updateTheaterSummary();
  });
  updateTheaterSummary();
}

function updateTheaterSummary() {
  const theaterSelect = document.getElementById('battle-theater');
  const summaryContainer = document.querySelector('.simulator-environment__summary');
  const helpEl = document.getElementById('theater-help');
  const chosen = findById(THEATERS, theaterSelect.value);
  if (!chosen) return;
  document.body.dataset.theater = chosen.skin || chosen.id;
  if (helpEl) helpEl.textContent = chosen.helper || chosen.summary;
  const slug = document.querySelector('[data-slug="theater"] [data-slug-value]');
  if (slug) slug.textContent = chosen.name;
  const description = summaryContainer.querySelector('.theater-description');
  if (description) description.textContent = chosen.describe;
  const visual = summaryContainer.querySelector('[data-theater-visual]');
  if (visual) {
    visual.src = THEATER_VISUAL_PATH;
    visual.alt = `${chosen.name} theater visual`;
  }
  renderTimelinePreview();
}

function collectFleetConfig(side) {
  const panel = document.querySelector(`.fleet-panel[data-side="${side}"]`);
  const commander = panel.querySelector('[data-field="commander"]').value;
  const formation = panel.querySelector('[data-field="formation"]').value;
  const tactic = panel.querySelector('[data-field="tactic"]').value;
  const volley = panel.querySelector('[data-field="volley"]').checked;
  const withdrawRound1 = panel.querySelector('[data-field="withdraw-r1"]').checked;
  const withdrawRound2 = panel.querySelector('[data-field="withdraw-r2"]').checked;
  const nameInput = getFleetNameInput(panel);
  const fallbackName = nameInput?.dataset.defaultName || FLEET_NAME_DEFAULTS[side] || 'Fleet';
  const nameValue = nameInput && typeof nameInput.value === 'string' ? nameInput.value.trim() : '';
  const fleetName = nameValue || fallbackName;

  const classes = {};
  panel.querySelectorAll('.ship-count-input').forEach((input) => {
    const classId = input.dataset.class;
    const count = Number(input.value) || 0;
    classes[classId] = { count, orders: [] };
  });

  panel.querySelectorAll('.class-order-select').forEach((select) => {
    const classId = select.dataset.class;
    const round = Number(select.dataset.round);
    const targetSelect = panel.querySelector(`.class-order-target[data-class="${classId}"][data-round="${round}"]`);
    const targetValue = targetSelect && !targetSelect.hidden ? targetSelect.value : null;
    if (!classes[classId]) classes[classId] = { count: 0, orders: [] };
    classes[classId].orders[round - 1] = {
      id: select.value,
      target: targetValue || null
    };
  });

  return {
    name: fleetName,
    commander,
    formation,
    tactic,
    volley,
    withdrawRound1,
    withdrawRound2,
    classes
  };
}

function computeCommanderEffects(commanderId) {
  const commander = findById(COMMANDERS, commanderId);
  return commander.effects || {};
}

function applyEffectBucket(base, addition) {
  Object.entries(addition).forEach(([key, value]) => {
    if (typeof value !== 'number') return;
    base[key] = (base[key] || 0) + value;
  });
}

function applyRoundOrders(fleet, enemy, roundReport, baseModifiers, round) {
  SHIP_CLASSES.forEach((cls) => {
    const order = fleet.classes[cls.id]?.orders?.[round - 1];
    if (!order) return;
    const options = CLASS_ORDERS[cls.id];
    const def = options.find((opt) => opt.id === order.id);
    if (!def || def.id === 'none') return;

    const modifiers = {
      damageMult: 0,
      globalDamageMult: 0,
      globalIncomingDamageMult: 0,
      incomingDamageMult: 0,
      shieldRegenMult: 0,
      shieldCapMult: 0,
      accuracyBonus: 0,
      initiativeBonus: 0,
      directHullFraction: 0,
      notes: []
    };

    def.apply({ fleet, enemy, round, order, modifiers, roundReport });

    applyEffectBucket(baseModifiers, modifiers);
    if (modifiers.notes.length) {
      modifiers.notes.forEach((note) => {
        roundReport.messages.push(`${cls.name}: ${note}`);
      });
    }
  });
}

function applyPendingEffects(fleet, round, roundReport) {
  const next = [];
  fleet.statuses.pending.forEach((effect) => {
    if (effect.round === round) {
      roundReport.messages.push(effect.description || 'Persistent effect resolves.');
      roundReport.pendingEffects.push(effect);
    } else {
      next.push(effect);
    }
  });
  fleet.statuses.pending = next;
}

function computeRoundModifiers(fleet, enemy, theater, roundReport, round) {
  const modifiers = {
    damageMult: 0,
    globalDamageMult: 0,
    incomingDamageMult: 0,
    globalIncomingDamageMult: 0,
    shieldRegenMult: 0,
    shieldCapMult: 0,
    accuracyBonus: 0,
    initiativeBonus: 0,
    withdrawBonus: 0,
    moralePerRound: 0,
    critBonus: 0,
    directHullFraction: 0
  };

  const commanderEffects = computeCommanderEffects(fleet.commanderId);
  applyEffectBucket(modifiers, commanderEffects);

  const formation = findById(FORMATIONS, fleet.formationId);
  applyEffectBucket(modifiers, formation.effects);

  const tactic = findById(TACTICS, fleet.tacticId);
  if (tactic.roundEffects) {
    applyEffectBucket(modifiers, tactic.roundEffects(round));
  }

  const theaterData = findById(THEATERS, theater.id);
  const theaterEffects = theaterData.effects();
  if (theaterEffects.ghostLock) {
    fleet.statuses.ghostLock = true;
    delete theaterEffects.ghostLock;
  }
  if (theaterEffects.initiativeChaos) {
    fleet.statuses.initiativeChaos = true;
    delete theaterEffects.initiativeChaos;
  }
  if (theaterEffects.collisionRisk) {
    fleet.statuses.collisionRisk = true;
    delete theaterEffects.collisionRisk;
  }
  applyEffectBucket(modifiers, theaterEffects);

  if (fleet.composition.combinedArms) {
    modifiers.globalIncomingDamageMult -= 0.05;
    roundReport.messages.push(`${fleet.label} combined-arms doctrine still trims some incoming fire.`);
    if (fleet.volley && round === 1) {
      modifiers.globalDamageMult += 0.15;
      roundReport.messages.push(`${fleet.label} declares Volley Coordination during detection.`);
    }
  }

  applyPendingEffects(fleet, round, roundReport);
  roundReport.pendingEffects.forEach((effect) => {
    applyEffectBucket(modifiers, effect);
  });

  applyRoundOrders(fleet, enemy, roundReport, modifiers, round);

  return modifiers;
}

function resolveSelfDamage(fleet, roundReport) {
  const affectedPools = new Set();
  let totalLoss = 0;
  roundReport.selfDamage.forEach((entry) => {
    const state = fleet.classStates[entry.classId];
    if (!state) return;
    const percent = entry.hullPercent || 0;
    const lossAmount = state.hullPerShip * state.initialCount * percent;
    const applied = Math.min(state.currentHull, lossAmount);
    if (applied <= 0) return;
    state.currentHull -= applied;
    totalLoss += applied;
    affectedPools.add(state.poolId);
    if (entry.note) {
      roundReport.messages.push(entry.note);
    }
  });
  if (totalLoss > 0) {
    affectedPools.forEach((poolId) => syncPoolState(fleet.pools[poolId]));
    recalcFleetVitals(fleet);
  }
}

function evaluateDamageOutput(fleet, enemy, modifiers, initiativeEdge) {
  if (fleet.currentHull <= 0 || fleet.totals.attack <= 0) return 0;
  const hullRatio = fleet.currentHull / fleet.totals.hull;
  const baseDamage = fleet.totals.attack * hullRatio;
  const accuracy = 1 + (modifiers.accuracyBonus || 0);
  const damageBoost = 1 + (modifiers.damageMult || 0) + (modifiers.globalDamageMult || 0);
  const commanderBonus = 1;
  const initiativeFactor = initiativeEdge > 0 ? 1.05 : initiativeEdge < 0 ? 0.95 : 1;
  const randomFactor = randomBetween(0.95, 1.15);
  let damage = baseDamage * damageBoost * accuracy * commanderBonus * initiativeFactor * randomFactor;

  if (modifiers.critBonus) damage *= 1 + modifiers.critBonus * randomBetween(0.5, 1.1);
  if (enemy.statuses && enemy.statuses.ghostLock && Math.random() < 0.15) {
    damage *= 0.7;
  }

  return damage;
}

function computePoolMitigation(pool) {
  const defenseRating = pool && pool.shipCount > 0 ? pool.defenseSum / pool.shipCount : 0;
  if (defenseRating <= 0) return 1;
  const capped = Math.min(0.35, defenseRating / (defenseRating + 140));
  return 1 - capped;
}

function normalizeDamageWeights(enemy) {
  const weights = {};
  if (!enemy || !enemy.pools) return weights;
  let total = 0;
  Object.entries(enemy.pools).forEach(([poolId, pool]) => {
    if (!pool || pool.currentHull + pool.currentShields <= 0) return;
    const baseWeight = DAMAGE_POOL_WEIGHTS[poolId] ?? 0.2;
    if (baseWeight <= 0) return;
    weights[poolId] = baseWeight;
    total += baseWeight;
  });
  if (total <= 0) return weights;
  Object.keys(weights).forEach((poolId) => {
    weights[poolId] /= total;
  });
  return weights;
}

function applyDamageToPool(pool, damage, pierceFraction) {
  if (!pool || damage <= 0) return { hull: 0, shields: 0 };
  const clampedPierce = clamp(pierceFraction, 0, 0.95);
  const shieldPortion = damage * (1 - clampedPierce);
  let hullPortion = damage * clampedPierce;
  let shieldsAbsorbed = 0;

  if (shieldPortion > 0) {
    let remainingShield = shieldPortion;
    pool.classes.forEach((state) => {
      if (remainingShield <= 0) return;
      if (state.currentShields <= 0) return;
      const taken = Math.min(state.currentShields, remainingShield);
      state.currentShields -= taken;
      remainingShield -= taken;
      shieldsAbsorbed += taken;
    });
    const overflow = shieldPortion - shieldsAbsorbed;
    if (overflow > 0) hullPortion += overflow;
  }

  let appliedHull = 0;
  if (hullPortion > 0) {
    let remainingHull = hullPortion;
    pool.classes.forEach((state) => {
      if (remainingHull <= 0) return;
      if (state.currentHull <= 0) return;
      const taken = Math.min(state.currentHull, remainingHull);
      state.currentHull -= taken;
      remainingHull -= taken;
      appliedHull += taken;
    });
  }

  syncPoolState(pool);
  return { hull: appliedHull, shields: shieldsAbsorbed };
}

function applyDamage(enemy, damage, attackerModifiers, defenderModifiers, roundReport) {
  if (damage <= 0) return { damageToHull: 0, damageToShields: 0 };
  const incomingFactor = 1 + (defenderModifiers.incomingDamageMult || 0) + (defenderModifiers.globalIncomingDamageMult || 0);
  const adjustedDamage = Math.max(0, damage * incomingFactor);
  const pierceFraction = clamp(BASELINE_SHIELD_PIERCE + (attackerModifiers.directHullFraction || 0), 0, 0.95);
  const weights = normalizeDamageWeights(enemy);
  let totalHull = 0;
  let totalShields = 0;

  const entries = Object.keys(weights);
  if (entries.length === 0) {
    return { damageToHull: 0, damageToShields: 0 };
  }

  entries.forEach((poolId) => {
    const pool = enemy.pools[poolId];
    if (!pool) return;
    const poolDamage = adjustedDamage * weights[poolId];
    const mitigation = computePoolMitigation(pool);
    const mitigated = poolDamage * mitigation;
    const applied = applyDamageToPool(pool, mitigated, pierceFraction);
    totalHull += applied.hull;
    totalShields += applied.shields;
  });

  recalcFleetVitals(enemy);
  return { damageToHull: totalHull, damageToShields: totalShields };
}

function regenerateShields(fleet, modifiers) {
  if (fleet.totals.shieldCapacity <= 0 || !fleet.classStates) return;
  const capModifier = 1 + clamp(modifiers.shieldCapMult || 0, -0.5, 0.5);
  const regenModifier = 1 + GLOBAL_SHIELD_REGEN_PENALTY + (modifiers.shieldRegenMult || 0);

  Object.values(fleet.classStates).forEach((state) => {
    if (!state) return;
    const survivors = computeSurvivorCount(state);
    if (survivors <= 0) {
      state.currentShields = 0;
      return;
    }
    const classCap = state.shieldPerShip * survivors * capModifier;
    state.currentShields = Math.min(state.currentShields, classCap);
    const regen = state.regenPerShip * survivors * regenModifier;
    if (regen > 0) {
      const missing = classCap - state.currentShields;
      if (missing > 0) {
        const gain = Math.min(missing, regen);
        state.currentShields += gain;
      }
    } else if (regen < 0) {
      const reduction = Math.min(state.currentShields, Math.abs(regen));
      state.currentShields -= reduction;
    }
  });

  Object.values(fleet.pools).forEach((pool) => syncPoolState(pool));
  recalcFleetVitals(fleet);
}

function updateMorale(fleet, roundReport, hullLoss, modifiers) {
  const moraleLoss = hullLoss > 0 ? hullLoss / fleet.totals.hull * 45 : 0;
  fleet.morale = clamp(fleet.morale - moraleLoss + (roundReport.moraleDelta || 0) + (modifiers.moralePerRound || 0), 0, 110);
}

function attemptWithdraw(fleet, enemy, round, modifiers, theater, log) {
  const withdrawEnabled = (round === 1 && fleet.withdrawR1) || (round === 2 && fleet.withdrawR2);
  if (!withdrawEnabled || fleet.currentHull <= 0) return null;
  if (enemy.statuses.withdrawLocked) {
    log.push(`${fleet.label} attempts to withdraw but the battlespace is snared.`);
    return { success: false, reason: 'locked' };
  }

  let baseChance = 0.35 + clamp((fleet.avgSpeed - enemy.avgSpeed) / 180, -0.18, 0.22);
  baseChance += modifiers.withdrawBonus || 0;
  if (theater.id === 'temporal_slip') baseChance -= 0.08;
  if (theater.id === 'asteroid_belt') baseChance -= 0.05;
  const roll = Math.random();
  if (roll <= baseChance) {
    log.push(`${fleet.label} disengages successfully (roll ${(roll).toFixed(2)} vs ${baseChance.toFixed(2)}).`);
    let pursuit = false;
    if (enemy.avgSpeed > fleet.avgSpeed && Math.random() < 0.45) {
      pursuit = true;
      const pursuitDamage = enemy.totals.attack * 0.12;
      const tempReport = { messages: [], selfDamage: [], moraleDelta: 0, pendingEffects: [] };
      const harm = applyDamage(fleet, pursuitDamage, { directHullFraction: 0.2 }, { incomingDamageMult: 0, globalIncomingDamageMult: 0 }, tempReport);
      fleet.morale = clamp(fleet.morale - (harm.damageToHull / fleet.totals.hull) * 35, 0, 110);
      log.push(`${enemy.label} catches the retreating tail, inflicting ${Math.round(harm.damageToHull)} hull damage.`);
    }
    return { success: true, pursuit };
  }
  log.push(`${fleet.label} fails to break contact (roll ${(roll).toFixed(2)} vs ${baseChance.toFixed(2)}).`);
  return { success: false };
}

function finalizeRoundForFleet(fleet, enemy, damage, modifiers, defenderModifiers, roundReport) {
  const applied = applyDamage(enemy, damage, modifiers, defenderModifiers, roundReport);
  resolveSelfDamage(fleet, roundReport);
  regenerateShields(fleet, modifiers);
  updateMorale(fleet, roundReport, applied.damageToHull, modifiers);
  return applied;
}

function resolveCollisionHazards(fleet, roundReport) {
  if (!fleet.statuses.collisionRisk) return 0;
  if (Math.random() < 0.12) {
    const loss = Math.min(fleet.currentHull, fleet.totals.hull * 0.03);
    fleet.currentHull = Math.max(0, fleet.currentHull - loss);
    roundReport.messages.push(`${fleet.label} hulls clip debris, losing ${Math.round(loss)} integrity.`);
    const moraleShock = loss / fleet.totals.hull * 30;
    fleet.morale = clamp(fleet.morale - moraleShock, 0, 110);
    return loss;
  }
  return 0;
}

function applyEndOfRoundAttrition(fleet, roundReport, theater) {
  if (!fleet.classStates) return 0;
  const states = Object.values(fleet.classStates).filter((state) => state && state.currentHull > 0);
  if (!states.length) return 0;
  const totalHull = states.reduce((sum, state) => sum + state.currentHull, 0);
  if (totalHull <= 0) return 0;

  let percent = ATTRITION_BASE_PERCENT;
  if (theater.id === 'intense_firefight') percent += 0.008;
  if (fleet.morale < 35) percent += LOW_MORALE_ATTRITION_PENALTY;
  if (fleet.morale < 20) percent += CRITICAL_MORALE_ATTRITION_PENALTY;

  let remaining = Math.min(totalHull, fleet.totals.hull * percent);
  if (remaining <= 0) return 0;

  let applied = 0;
  const lastIndex = states.length - 1;
  states.forEach((state, idx) => {
    if (remaining <= 0) return;
    const share = state.currentHull / totalHull;
    let loss = Math.min(state.currentHull, remaining * share);
    if (idx === lastIndex) loss = Math.min(state.currentHull, remaining);
    if (loss <= 0) return;
    state.currentHull -= loss;
    applied += loss;
    remaining -= loss;
  });

  Object.values(fleet.pools).forEach((pool) => syncPoolState(pool));
  recalcFleetVitals(fleet);

  if (applied > 0) {
    roundReport.messages.push(`${fleet.label} suffers ${Math.round(applied)} attritional hull losses amid the chaos.`);
    const moraleShock = applied / fleet.totals.hull * 18;
    fleet.morale = clamp(fleet.morale - moraleShock, 0, 110);
  }

  return applied;
}

function determineInitiative(fleet, enemy, modifiers, enemyModifiers, theater) {
  let score = fleet.avgSpeed + (modifiers.initiativeBonus || 0);
  let enemyScore = enemy.avgSpeed + (enemyModifiers.initiativeBonus || 0);
  if (theater.id === 'temporal_slip') {
    score += randomBetween(-8, 8);
    enemyScore += randomBetween(-8, 8);
  } else {
    score += randomBetween(-2, 5);
    enemyScore += randomBetween(-2, 5);
  }
  return score - enemyScore;
}

function simulateBattle(fleetConfigA, fleetConfigB, theater) {
  const fleetA = buildFleetState(fleetConfigA, 'Fleet Alpha');
  const fleetB = buildFleetState(fleetConfigB, 'Fleet Beta');
  const log = [];
  let withdrawal = null;
  const rounds = [];
  const eventQueue = Array.isArray(theater?.events) ? [...theater.events] : [];
  const triggeredEvents = [];

  for (let round = 1; round <= 3; round += 1) {
    if (fleetA.currentHull <= 0 || fleetB.currentHull <= 0 || (withdrawal && withdrawal.success)) break;

    decrementCooldowns(fleetA);
    decrementCooldowns(fleetB);

    const roundReportA = { round, messages: [], selfDamage: [], moraleDelta: 0, pendingEffects: [] };
    const roundReportB = { round, messages: [], selfDamage: [], moraleDelta: 0, pendingEffects: [] };

    const modifiersA = computeRoundModifiers(fleetA, fleetB, theater, roundReportA, round);
    const modifiersB = computeRoundModifiers(fleetB, fleetA, theater, roundReportB, round);

    const initiativeEdgeA = determineInitiative(fleetA, fleetB, modifiersA, modifiersB, theater);
    const initiativeEdgeB = -initiativeEdgeA;

    const rawA = evaluateDamageOutput(fleetA, fleetB, modifiersA, initiativeEdgeA);
    const rawB = evaluateDamageOutput(fleetB, fleetA, modifiersB, initiativeEdgeB);

    const appliedOnB = finalizeRoundForFleet(fleetA, fleetB, rawA, modifiersA, modifiersB, roundReportA);
    const appliedOnA = finalizeRoundForFleet(fleetB, fleetA, rawB, modifiersB, modifiersA, roundReportB);

    roundReportA.messages.push(
      `${fleetA.label} inflicts ${Math.round(appliedOnB.damageToHull)} hull and ${Math.round(appliedOnB.damageToShields)} shield damage.`
    );
    roundReportB.messages.push(
      `${fleetB.label} inflicts ${Math.round(appliedOnA.damageToHull)} hull and ${Math.round(appliedOnA.damageToShields)} shield damage.`
    );

    if (theater.id === 'asteroid_belt') {
      resolveCollisionHazards(fleetA, roundReportA);
      resolveCollisionHazards(fleetB, roundReportB);
    }

    applyEndOfRoundAttrition(fleetA, roundReportA, theater);
    applyEndOfRoundAttrition(fleetB, roundReportB, theater);

    const roundMessages = [...roundReportA.messages, ...roundReportB.messages];

    rounds.push({
      round,
      initiative: initiativeEdgeA > 0 ? 'Alpha seizes initiative' : initiativeEdgeA < 0 ? 'Beta seizes initiative' : 'Initiative contested',
      messages: roundMessages,
      alphaDamage: appliedOnB,
      betaDamage: appliedOnA,
      rawAlpha: rawA,
      rawBeta: rawB,
      alphaState: { hull: fleetA.currentHull, shields: fleetA.currentShields, morale: fleetA.morale },
      betaState: { hull: fleetB.currentHull, shields: fleetB.currentShields, morale: fleetB.morale }
    });

    eventQueue.slice().forEach((eventId) => {
      const def = THEATER_EVENT_DECK[eventId];
      if (!def || def.round !== round) return;
      const message = def.message ? def.message() : `${def.name} influences the engagement.`;
      log.push(message);
      triggeredEvents.push({ id: eventId, round, message });
      const index = eventQueue.indexOf(eventId);
      if (index >= 0) eventQueue.splice(index, 1);
    });

    const attemptAlpha = attemptWithdraw(fleetA, fleetB, round, modifiersA, theater, log);
    if (attemptAlpha && attemptAlpha.success) {
      withdrawal = { ...attemptAlpha, side: 'alpha', round };
      break;
    }
    const attemptBeta = attemptWithdraw(fleetB, fleetA, round, modifiersB, theater, log);
    if (attemptBeta && attemptBeta.success) {
      withdrawal = { ...attemptBeta, side: 'beta', round };
      break;
    }
  }

  const final = determineOutcome(fleetA, fleetB, withdrawal, theater);

  return { rounds, log, final, fleets: { a: fleetA, b: fleetB }, theater, events: triggeredEvents };
}

function determineOutcome(fleetA, fleetB, withdrawal, theater) {
  const ratioA = fleetA.totals.hull > 0 ? fleetA.currentHull / fleetA.totals.hull : 0;
  const ratioB = fleetB.totals.hull > 0 ? fleetB.currentHull / fleetB.totals.hull : 0;
  const destroyedA = ratioA <= 0.02;
  const destroyedB = ratioB <= 0.02;

  if (withdrawal && withdrawal.success) {
    const holdingFleet = withdrawal.side === 'alpha' ? fleetB : fleetA;
    const withdrawingFleet = withdrawal.side === 'alpha' ? fleetA : fleetB;
    const pursuitNote = withdrawal.pursuit ? ' under pursuit fire' : '';
    const text = `${withdrawingFleet.label} execute a tactical withdrawal after round ${withdrawal.round}${pursuitNote}. ${holdingFleet.label} retains the field.`;
    return {
      type: 'Withdrawal',
      victor: holdingFleet.label,
      summary: text,
      rating: holdingFleet.currentHull / holdingFleet.totals.hull > 0.35 ? 'Tactical Hold' : 'Pyrrhic Hold'
    };
  }

  if (destroyedA && destroyedB) {
    return {
      type: 'Mutual Collapse',
      victor: 'None',
      summary: 'Both fleets collapse under catastrophic exchange; debris clouds fill the battlespace.',
      rating: 'Collapse'
    };
  }

  if (destroyedB) {
    return {
      type: 'Victory',
      victor: fleetA.label,
      summary: `${fleetA.label} shatter opposing hulls and hold the battlespace.`,
      rating: ratioA >= 0.35 ? 'Decisive Victory' : 'Pyrrhic Victory'
    };
  }

  if (destroyedA) {
    return {
      type: 'Defeat',
      victor: fleetB.label,
      summary: `${fleetB.label} overwhelm the enemy.`,
      rating: ratioB >= 0.35 ? 'Decisive Victory' : 'Pyrrhic Victory'
    };
  }

  const delta = Math.abs(ratioA - ratioB);
  if (delta < 0.08) {
    let type = 'Stalemate';
    let summary = 'Neither side gains decisive leverage; scattered wrecks drift between battered task forces.';
    if (theater.id === 'temporal_slip' && Math.random() < 0.18) {
      type = 'Anomaly';
      summary = 'Temporal eddies ripple across the corridor, freezing the battle in paradox. Command requests further study.';
    }
    return { type, victor: 'None', summary, rating: 'Stalemate' };
  }

  if (ratioA > ratioB) {
    return {
      type: ratioA >= 0.4 ? 'Victory' : 'Marginal Victory',
      victor: fleetA.label,
      summary: `${fleetA.label} grind forward as ${fleetB.label} buckles.`,
      rating: ratioA >= 0.4 ? 'Operational Victory' : 'Strained Victory'
    };
  }

  return {
    type: ratioB >= 0.4 ? 'Defeat' : 'Marginal Defeat',
    victor: fleetB.label,
    summary: `${fleetB.label} leverages the engagement tempo, forcing ${fleetA.label} to cede ground.`,
    rating: ratioB >= 0.4 ? 'Operational Victory' : 'Strained Victory'
  };
}

function renderResults(result) {
  const container = document.getElementById('simulator-results');
  container.innerHTML = '';
  const slug = document.querySelector('[data-slug="results"] [data-slug-value]');
  if (slug) slug.textContent = result.final.type;

  const card = document.createElement('article');
  card.className = 'after-action-card';
  if (cinematicMode) card.dataset.animate = 'true';
  card.innerHTML = `
    <div class="after-action-card__header">
      <span class="after-action-card__badge">${result.final.type}</span>
      <p class="after-action-card__summary">${result.final.summary}</p>
    </div>
  `;

  const grid = document.createElement('div');
  grid.className = 'after-action-card__grid';

  const fleetMeta = [
    { key: 'a', side: 'alpha', panelSelector: '.fleet-panel[data-side="alpha"]' },
    { key: 'b', side: 'beta', panelSelector: '.fleet-panel[data-side="beta"]' }
  ];

  fleetMeta.forEach((meta) => {
    const fleet = result.fleets[meta.key];
    const panel = document.querySelector(meta.panelSelector);
    const commander = findById(COMMANDERS, fleet.commanderId);
    if (panel) {
      const moraleMeter = panel.querySelector('[data-morale]');
      if (moraleMeter) {
        moraleMeter.dataset.current = Math.round(fleet.morale);
      }
    }
    const casualties = SHIP_CLASSES.map((cls) => {
      const start = fleet.classes[cls.id]?.count || 0;
      const state = fleet.classStates?.[cls.id];
      const survivors = state ? computeSurvivorCount(state) : 0;
      const lost = Math.max(0, start - survivors);
      return { cls, start, survivors, lost };
    });
    const mvp = casualties.reduce((best, entry) => {
      if (entry.start === 0) return best;
      const ratio = entry.start > 0 ? entry.survivors / entry.start : 0;
      if (!best || ratio > best.ratio) return { entry, ratio };
      return best;
    }, null);
    const weak = casualties.reduce((worst, entry) => {
      if (entry.start === 0) return worst;
      const ratio = entry.start > 0 ? entry.survivors / entry.start : 1;
      if (!worst || ratio < worst.ratio) return { entry, ratio };
      return worst;
    }, null);

    const repairCosts = computeRepairCosts(fleet);
      const casualtyList = casualties
        .map((item) => {
          const ratio = item.start > 0 ? `${item.survivors}/${item.start}` : '—';
          return `<div><span>${item.cls.name}</span><span>${ratio}</span></div>`;
        })
        .join('');

    const panelEl = document.createElement('section');
    panelEl.className = 'after-action-panel';
    const fleetHeading = fleet?.label || resolveFleetName(meta.side);
    panelEl.innerHTML = `
      <h5>${fleetHeading}</h5>
      <div class="casualty-grid">${casualtyList}</div>
      <p class="mvp-tag">MVP: ${mvp?.entry?.cls?.name || 'N/A'}${weak?.entry && weak.entry.cls ? ` · Weak Link: ${weak.entry.cls.name}` : ''}</p>
      <p>Morale ${Math.round(fleet.morale)} · Hull ${Math.round((fleet.currentHull / (fleet.totals.hull || 1)) * 100)}%</p>
      <p>${getCommanderQuip(commander.id, result.final.type)}</p>
      <div class="after-action-panel__repairs">Estimated repairs: ${
        repairCosts.totalMax > 0
          ? `${formatCredits(repairCosts.totalMin)} - ${formatCredits(repairCosts.totalMax)}`
          : 'Minimal patch work'
      }</div>
    `;
    grid.appendChild(panelEl);
  });

  card.appendChild(grid);

  const changeChips = document.createElement('div');
  changeChips.className = 'change-chips';
  changeChips.innerHTML = `
    <button type="button" data-focus="alpha-formation">Adjust Alpha Formation</button>
    <button type="button" data-focus="alpha-orders">Retune Alpha Orders</button>
    <button type="button" data-focus="beta-tactic">Shift Beta Tactic</button>
  `;
  card.appendChild(changeChips);
  container.appendChild(card);

  const focusActions = {
    'alpha-formation': () => {
      const el = document.querySelector('.fleet-panel[data-side="alpha"] .doctrine-card-grid[data-doctrine="formation"] .doctrine-card');
      if (el) el.focus();
    },
    'alpha-orders': () => {
      const toggle = document.querySelector('.fleet-panel[data-side="alpha"] [data-toggle-orders]');
      if (toggle && toggle.getAttribute('aria-expanded') === 'false') toggle.click();
      const el = document.querySelector('.fleet-panel[data-side="alpha"] .class-order-block .order-card');
      if (el) el.focus();
    },
    'beta-tactic': () => {
      const el = document.querySelector('.fleet-panel[data-side="beta"] .doctrine-card-grid[data-doctrine="tactic"] .doctrine-card');
      if (el) el.focus();
    }
  };
  changeChips.addEventListener('click', (event) => {
    if (event.target.matches('button[data-focus]')) {
      const action = focusActions[event.target.dataset.focus];
      if (action) action();
    }
  });

  result.rounds.forEach((round) => {
    const section = document.createElement('section');
    section.className = 'round-report';
    if (cinematicMode) section.dataset.animate = 'true';
    const messages = round.messages.map((msg) => `<li>${msg}</li>`).join('');
    section.innerHTML = `
      <header>
        <h5>Round ${round.round}</h5>
        <span>${round.initiative}</span>
      </header>
      <div class="round-report__stats">
        <div>
          <strong>Alpha</strong>
          <p>Damage: ${Math.round(round.alphaDamage.damageToHull)} hull / ${Math.round(round.alphaDamage.damageToShields)} shields</p>
          <p>Hull ${Math.round(round.alphaState.hull)} · Shields ${Math.round(round.alphaState.shields)} · Morale ${Math.round(round.alphaState.morale)}</p>
        </div>
        <div>
          <strong>Beta</strong>
          <p>Damage: ${Math.round(round.betaDamage.damageToHull)} hull / ${Math.round(round.betaDamage.damageToShields)} shields</p>
          <p>Hull ${Math.round(round.betaState.hull)} · Shields ${Math.round(round.betaState.shields)} · Morale ${Math.round(round.betaState.morale)}</p>
        </div>
      </div>
      <ul class="round-report__log">${messages}</ul>
    `;
    container.appendChild(section);
  });

  if (result.log.length) {
    const misc = document.createElement('section');
    misc.className = 'additional-events';
    if (cinematicMode) misc.dataset.animate = 'true';
    misc.innerHTML = `<h5>Additional Events</h5><ul>${result.log.map((entry) => `<li>${entry}</li>`).join('')}</ul>`;
    container.appendChild(misc);
  }

  if (result.events?.length) {
    result.events.forEach((event) => {
      const cardRef = eventCardRefs.get(event.id);
      if (cardRef) {
        cardRef.dataset.status = 'revealed';
        const header = cardRef.querySelector('header span:last-child');
        if (header) header.textContent = 'Revealed';
        const note = document.createElement('p');
        note.textContent = event.message;
        cardRef.appendChild(note);
      }
      if (event.id === 'choir_surge') {
        playStormCrackle();
      }
    });
  }

  document.querySelectorAll('.fleet-panel').forEach((panel) => updateFleetStatus(panel));
}

function resetFleets() {
  document.querySelectorAll('.fleet-panel').forEach((panel) => {
    const nameInput = getFleetNameInput(panel);
    if (nameInput) {
      const defaultName = nameInput.dataset.defaultName || FLEET_NAME_DEFAULTS[panel.dataset.side] || nameInput.value;
      nameInput.value = defaultName;
    }
    panel.querySelectorAll('.ship-count-input').forEach((input) => {
      if (input.dataset.class === 'corvette' || input.dataset.class === 'destroyer') input.value = 4;
      else if (input.dataset.class === 'cruiser') input.value = 2;
      else input.value = 0;
      input.dispatchEvent(new Event('change'));
    });
    panel.querySelector('[data-field="commander"]').value = 'none';
    setDoctrineSelection(panel, 'formation', 'phalanx');
    setDoctrineSelection(panel, 'tactic', 'balanced');
    ['withdraw-r1', 'withdraw-r2', 'volley'].forEach((toggle) => {
      const input = panel.querySelector(`[data-field="${toggle}"]`);
      if (input) {
        input.checked = false;
        input.dispatchEvent(new Event('change'));
      }
    });
    panel.querySelectorAll('.class-order-select').forEach((select) => {
      select.value = 'none';
      handleOrderSelectChange(panel, select);
    });
    const moraleMeter = panel.querySelector('[data-morale]');
    if (moraleMeter) {
      moraleMeter.dataset.current = 50;
    }
    updateCommanderChip(panel);
    updateSynergyOverlay(panel);
    updateFleetStatus(panel);
  });
  renderTimelinePreview();
  document.getElementById('simulator-results').innerHTML = '';
}

function init() {
  document.body.dataset.cinematic = 'on';
  populateTheaterControls();
  document.querySelectorAll('.fleet-panel').forEach((panel) => populateFleetPanel(panel));

  document.getElementById('simulate-button').addEventListener('click', () => {
    const configA = collectFleetConfig('alpha');
    const configB = collectFleetConfig('beta');
    const theater = findById(THEATERS, document.getElementById('battle-theater').value);
    const result = simulateBattle(configA, configB, theater);
    renderResults(result);
  });

  document.getElementById('reset-button').addEventListener('click', () => {
    resetFleets();
  });

  const shareButton = document.getElementById('share-seed');
  const shareOutput = document.getElementById('share-seed-output');
  const shareFeedback = (message, status = 'info') => {
    if (!shareOutput) return;
    shareOutput.textContent = message;
    shareOutput.dataset.status = status;
  };
  if (shareButton) {
    shareButton.addEventListener('click', async () => {
      const configA = collectFleetConfig('alpha');
      const configB = collectFleetConfig('beta');
      const theater = findById(THEATERS, document.getElementById('battle-theater').value);
      const seed = encodeShareSeed(configA, configB, theater);
      shareFeedback(`Seed: ${seed}`, 'info');

      let copyState = 'unsupported';
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(seed);
          copyState = 'success';
        } catch (error) {
          console.warn('Failed to copy share seed', error);
          copyState = 'error';
        }
      }

      if (copyState === 'success') {
        shareFeedback(`Seed: ${seed} · Copied`, 'success');
      } else if (copyState === 'error') {
        shareFeedback(`Seed: ${seed} · Copy failed—use manual copy.`, 'error');
      } else {
        shareFeedback(`Seed: ${seed} · Copy manually.`, 'warn');
      }

      const url = new URL(window.location.href);
      url.searchParams.set('seed', seed);
      window.history.replaceState({}, '', url.toString());
    });
  }

  resetFleets();

  const params = new URLSearchParams(window.location.search);
  const seedFromQuery = params.get('seed') || (window.location.hash.startsWith('#seed=') ? window.location.hash.slice(6) : null);
  if (seedFromQuery) {
    applyShareSeed(seedFromQuery, {
      onSuccess: () => shareFeedback('Loaded configuration seed.', 'success'),
      onError: (message) => shareFeedback(message, 'error')
    });
  }
}

window.addEventListener('DOMContentLoaded', init);
