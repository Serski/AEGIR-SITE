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
    effects: {}
  },
  {
    id: 'vahl',
    name: 'Cmdr. Serin Vahl',
    summary: '+5% accuracy and +3 initiative (sensor prodigy).',
    effects: { accuracyBonus: 0.05, initiativeBonus: 3 }
  },
  {
    id: 'cole',
    name: 'Cmdr. Idris Cole',
    summary: '+10% shield regeneration and +5 morale each round.',
    effects: { shieldRegenMult: 0.1, moralePerRound: 5 }
  },
  {
    id: 'eztan',
    name: 'Cmdr. Mara Eztan',
    summary: '+6 initiative, +5% withdraw success (hit-and-fade specialist).',
    effects: { initiativeBonus: 6, withdrawBonus: 0.05 }
  },
  {
    id: 'sar',
    name: 'Commodore Nyla Sar',
    summary: '+6% damage output, -4% incoming damage (decisive tactician).',
    effects: { damageMult: 0.06, incomingDamageMult: -0.04 }
  }
];

const FORMATIONS = [
  {
    id: 'spearhead',
    name: 'Spearhead',
    summary: '+15% attack, but +10% incoming damage from exposed flanks.',
    effects: { damageMult: 0.15, incomingDamageMult: 0.1, initiativeBonus: 2 }
  },
  {
    id: 'phalanx',
    name: 'Phalanx',
    summary: '+10% defense, +25% shield regen, -4 initiative.',
    effects: { incomingDamageMult: -0.1, shieldRegenMult: 0.25, initiativeBonus: -4 }
  },
  {
    id: 'dispersed',
    name: 'Dispersed Line',
    summary: '+10% evasion (damage reduction) but -8% accuracy.',
    effects: { incomingDamageMult: -0.1, accuracyBonus: -0.08, initiativeBonus: 1 }
  }
];

const TACTICS = [
  {
    id: 'aggressive',
    name: 'Aggressive',
    summary: 'Damage spikes (+25% R1, +15% later), +5% crit, but +10% incoming damage and -5% shield regen.',
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
    summary: 'Lightning choir interference: beam accuracy down, shields surge.',
    describe: 'Sensor static and storm-choirs scramble targeting but energize shield capacitors.',
    effects: () => ({ accuracyBonus: -0.05, shieldRegenMult: 0.18, initiativeBonus: -2 })
  },
  {
    id: 'asteroid_belt',
    name: 'Asteroid Belt',
    summary: 'Small craft weave easier, capital ships slow & risk collisions.',
    describe: 'Dense rock fields favor evasive craft; capital signatures struggle to maneuver cleanly.',
    effects: () => ({ incomingDamageMult: -0.05, initiativeBonus: -3, collisionRisk: true })
  },
  {
    id: 'station_yard',
    name: 'Station Yard / High Orbit',
    summary: 'Local turret assists and improved salvage; watch civilian lanes.',
    describe: 'Orbital defenses bolster accuracy while defensive grids catch stray fire.',
    effects: () => ({ damageMult: 0.05, incomingDamageMult: -0.03, moralePerRound: 2 })
  },
  {
    id: 'graveglass',
    name: 'Graveglass Veil / Nebula',
    summary: 'Ghost-locks and ECM hamper detection; beams attenuated.',
    describe: 'Nebular interference muddles initiative and causes misfire checks.',
    effects: () => ({ accuracyBonus: -0.03, initiativeBonus: -4, ghostLock: true })
  },
  {
    id: 'temporal_slip',
    name: 'Temporal-Slip Corridor',
    summary: 'Initiative scrambles, crits reroll – chaotic outcomes likely.',
    describe: 'Reality twitches; time-skews can produce anomalous results and risky retreats.',
    effects: () => ({ initiativeChaos: true, critBonus: 0.05 })
  },
  {
    id: 'intense_firefight',
    name: 'Intense Firefight',
    summary: 'Cascading strikes punch through shields; regen suppressed amid maelstrom.',
    describe: 'Battered task forces exchange brutal salvos at knifefight ranges, overwhelming defensive grids.',
    effects: () => ({ directHullFraction: 0.08, shieldRegenMult: -0.25, moralePerRound: -4 })
  }
];

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
    label,
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

function populateFleetPanel(panel) {
  const side = panel.dataset.side;
  const commanderSelect = panel.querySelector('[data-field="commander"]');
  COMMANDERS.forEach((cmdr) => {
    const option = document.createElement('option');
    option.value = cmdr.id;
    option.textContent = cmdr.name;
    option.dataset.summary = cmdr.summary;
    commanderSelect.appendChild(option);
  });

  const formationSelect = panel.querySelector('[data-field="formation"]');
  FORMATIONS.forEach((formation) => {
    const option = document.createElement('option');
    option.value = formation.id;
    option.textContent = formation.name;
    option.dataset.summary = formation.summary;
    formationSelect.appendChild(option);
  });

  const tacticSelect = panel.querySelector('[data-field="tactic"]');
  TACTICS.forEach((tactic) => {
    const option = document.createElement('option');
    option.value = tactic.id;
    option.textContent = tactic.name;
    option.dataset.summary = tactic.summary;
    tacticSelect.appendChild(option);
  });

  const countsContainer = panel.querySelector('[data-counts]');
  SHIP_CLASSES.forEach((cls) => {
    const field = document.createElement('label');
    field.className = 'simulator-field simulator-field--inline';
    field.innerHTML = `
      <span>${cls.name}</span>
      <input type="number" inputmode="numeric" min="0" step="1" value="${cls.id === 'corvette' || cls.id === 'destroyer' ? 4 : cls.id === 'cruiser' ? 2 : 0}" data-class="${cls.id}" class="ship-count-input" aria-label="${side} ${cls.name} count" />
    `;
    countsContainer.appendChild(field);
  });

  const ordersContainer = panel.querySelector('[data-orders]');
  SHIP_CLASSES.forEach((cls) => {
    const section = document.createElement('section');
    section.className = 'class-order-block';
    section.dataset.classId = cls.id;
    section.innerHTML = `
      <h5>${cls.name}</h5>
      <div class="class-order-grid"></div>
    `;
    const grid = section.querySelector('.class-order-grid');
    [1, 2, 3].forEach((round) => {
      const row = document.createElement('div');
      row.className = 'class-order-row';
      row.innerHTML = `
        <label>R${round}</label>
        <select class="class-order-select" data-side="${side}" data-class="${cls.id}" data-round="${round}"></select>
        <select class="class-order-target" data-side="${side}" data-class="${cls.id}" data-round="${round}" hidden></select>
      `;
      grid.appendChild(row);
    });
    ordersContainer.appendChild(section);
  });

  panel.addEventListener('change', (event) => {
    if (event.target.matches('.ship-count-input')) {
      updateFleetStatus(panel);
    }
    if (event.target.matches('.class-order-select')) {
      handleOrderSelectChange(panel, event.target);
    }
    if (event.target.matches('[data-field="formation"], [data-field="tactic"], [data-field="commander"], [data-field="volley"]')) {
      updateFleetStatus(panel);
    }
  });

  updateFleetStatus(panel);
}

function handleOrderSelectChange(panel, selectEl) {
  const classId = selectEl.dataset.class;
  const round = Number(selectEl.dataset.round);
  const orderId = selectEl.value;
  const targetSelect = panel.querySelector(`.class-order-target[data-class="${classId}"][data-round="${round}"]`);
  const orders = CLASS_ORDERS[classId];
  const order = orders.find((opt) => opt.id === orderId);

  if (order && order.requiresTarget) {
    targetSelect.hidden = false;
    populateTargetOptions(targetSelect, order);
  } else if (targetSelect) {
    targetSelect.hidden = true;
    targetSelect.innerHTML = '';
  }
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

  const fragments = [];
  fragments.push(`<div><strong>Commander:</strong> ${commanderSelect.selectedOptions[0]?.dataset.summary || ''}</div>`);
  fragments.push(`<div><strong>Formation:</strong> ${formationSelect.selectedOptions[0]?.dataset.summary || ''}</div>`);
  fragments.push(`<div><strong>Tactic:</strong> ${tacticSelect.selectedOptions[0]?.dataset.summary || ''}</div>`);
  fragments.push(`<div><strong>Total Hull Frames:</strong> ${totalShips}</div>`);
  fragments.push(`<div><strong>Combined-Arms Bonus:</strong> ${combinedArms ? 'Active' : 'Incomplete roster'}</div>`);
  if (volleyCheckbox.checked) {
    fragments.push('<div><strong>Volley Coordination:</strong> Primed for Round 1.</div>');
  }

  statusEl.innerHTML = fragments.join('');
}

function populateTheaterControls() {
  const theaterSelect = document.getElementById('battle-theater');
  THEATERS.forEach((theater) => {
    const option = document.createElement('option');
    option.value = theater.id;
    option.textContent = theater.name;
    option.dataset.summary = theater.summary;
    theaterSelect.appendChild(option);
  });

  theaterSelect.addEventListener('change', updateTheaterSummary);
  updateTheaterSummary();
}

function updateTheaterSummary() {
  const theaterSelect = document.getElementById('battle-theater');
  const summaryEl = document.querySelector('.simulator-environment__summary');
  const helpEl = document.getElementById('theater-help');
  const chosen = findById(THEATERS, theaterSelect.value);
  helpEl.textContent = chosen.summary;
  summaryEl.textContent = chosen.describe;
}

function collectFleetConfig(side) {
  const panel = document.querySelector(`.fleet-panel[data-side="${side}"]`);
  const commander = panel.querySelector('[data-field="commander"]').value;
  const formation = panel.querySelector('[data-field="formation"]').value;
  const tactic = panel.querySelector('[data-field="tactic"]').value;
  const volley = panel.querySelector('[data-field="volley"]').checked;
  const withdrawRound1 = panel.querySelector('[data-field="withdraw-r1"]').checked;
  const withdrawRound2 = panel.querySelector('[data-field="withdraw-r2"]').checked;

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

  return { rounds, log, final, fleets: { a: fleetA, b: fleetB }, theater };
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

  const outcomeCard = document.createElement('article');
  outcomeCard.className = 'simulator-outcome';
  outcomeCard.innerHTML = `
    <header>
      <h4>Outcome: ${result.final.type}</h4>
      <p class="simulator-outcome__summary">${result.final.summary}</p>
      <p class="simulator-outcome__rating">Assessment: ${result.final.rating}</p>
    </header>
  `;
  container.appendChild(outcomeCard);

  const fleetGrid = document.createElement('div');
  fleetGrid.className = 'simulator-fleet-summary-grid';

  ['a', 'b'].forEach((key) => {
    const fleet = result.fleets[key];
    const card = document.createElement('section');
    const ratio = fleet.totals.hull > 0 ? fleet.currentHull / fleet.totals.hull : 0;
    const shieldRatio = fleet.totals.shieldCapacity > 0 ? fleet.currentShields / fleet.totals.shieldCapacity : 0;
    card.className = 'simulator-fleet-card';
    const listItems = SHIP_CLASSES.map((cls) => {
      const start = fleet.classes[cls.id]?.count || 0;
      const state = fleet.classStates?.[cls.id];
      const survivors = state ? computeSurvivorCount(state) : 0;
      return `<li><span>${cls.name}</span><span>${survivors} / ${start}</span></li>`;
    }).join('');
    const repairCosts = computeRepairCosts(fleet);
    const breakdownItems = repairCosts.breakdown
      .map((entry) => `<li><span>${entry.name}</span><span>${formatCredits(entry.min)} - ${formatCredits(entry.max)}</span></li>`)
      .join('');
    const repairBlock = `
      <div class="simulator-fleet-card__repairs">
        <h6>Estimated Repair Costs</h6>
        <p class="simulator-fleet-card__repair-total">
          ${repairCosts.totalMax > 0
            ? `${formatCredits(repairCosts.totalMin)} - ${formatCredits(repairCosts.totalMax)}`
            : 'No significant repairs required.'}
        </p>
        ${repairCosts.breakdown.length ? `<ul>${breakdownItems}</ul>` : ''}
      </div>
    `;
    card.innerHTML = `
      <header>
        <h5>${fleet.label}</h5>
        <p>Commander: ${findById(COMMANDERS, fleet.commanderId).name}</p>
      </header>
      <dl>
        <div><dt>Hull Remaining</dt><dd>${Math.round(ratio * 100)}%</dd></div>
        <div><dt>Shields Online</dt><dd>${Math.round(shieldRatio * 100)}%</dd></div>
        <div><dt>Morale</dt><dd>${Math.round(fleet.morale)}</dd></div>
      </dl>
      <h6>Estimated Surviving Hulls</h6>
      <ul>${listItems}</ul>
      ${repairBlock}
    `;
    fleetGrid.appendChild(card);
  });
  container.appendChild(fleetGrid);

  result.rounds.forEach((round) => {
    const section = document.createElement('section');
    section.className = 'simulator-round';
    const messages = round.messages.map((msg) => `<li>${msg}</li>`).join('');
    section.innerHTML = `
      <header>
        <h5>Round ${round.round}</h5>
        <p>${round.initiative}</p>
      </header>
      <div class="simulator-round__stats">
        <div>
          <h6>Fleet Alpha</h6>
          <p>Damage inflicted: ${Math.round(round.alphaDamage.damageToHull)} hull / ${Math.round(round.alphaDamage.damageToShields)} shields</p>
          <p>Hull: ${Math.round(round.alphaState.hull)} | Shields: ${Math.round(round.alphaState.shields)} | Morale: ${Math.round(round.alphaState.morale)}</p>
        </div>
        <div>
          <h6>Fleet Beta</h6>
          <p>Damage inflicted: ${Math.round(round.betaDamage.damageToHull)} hull / ${Math.round(round.betaDamage.damageToShields)} shields</p>
          <p>Hull: ${Math.round(round.betaState.hull)} | Shields: ${Math.round(round.betaState.shields)} | Morale: ${Math.round(round.betaState.morale)}</p>
        </div>
      </div>
      <ul class="simulator-round__log">${messages}</ul>
    `;
    container.appendChild(section);
  });

  if (result.log.length) {
    const misc = document.createElement('section');
    misc.className = 'simulator-misc-log';
    misc.innerHTML = `<h5>Additional Events</h5><ul>${result.log.map((entry) => `<li>${entry}</li>`).join('')}</ul>`;
    container.appendChild(misc);
  }
}

function resetFleets() {
  document.querySelectorAll('.fleet-panel').forEach((panel) => {
    panel.querySelectorAll('.ship-count-input').forEach((input) => {
      if (input.dataset.class === 'corvette' || input.dataset.class === 'destroyer') input.value = 4;
      else if (input.dataset.class === 'cruiser') input.value = 2;
      else input.value = 0;
    });
    panel.querySelector('[data-field="commander"]').value = 'none';
    panel.querySelector('[data-field="formation"]').value = 'phalanx';
    panel.querySelector('[data-field="tactic"]').value = 'balanced';
    panel.querySelector('[data-field="withdraw-r1"]').checked = false;
    panel.querySelector('[data-field="withdraw-r2"]').checked = false;
    panel.querySelector('[data-field="volley"]').checked = false;
    panel.querySelectorAll('.class-order-select').forEach((select) => {
      select.value = 'none';
      const target = panel.querySelector(`.class-order-target[data-class="${select.dataset.class}"][data-round="${select.dataset.round}"]`);
      if (target) {
        target.hidden = true;
        target.innerHTML = '';
      }
    });
    updateFleetStatus(panel);
  });
  document.getElementById('simulator-results').innerHTML = '';
}

function initializeOrders() {
  document.querySelectorAll('.class-order-select').forEach((select) => {
    const classId = select.dataset.class;
    const options = CLASS_ORDERS[classId];
    prepareOrders(select, options);
  });
}

function init() {
  populateTheaterControls();
  document.querySelectorAll('.fleet-panel').forEach((panel) => populateFleetPanel(panel));
  initializeOrders();

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

  resetFleets();
}

window.addEventListener('DOMContentLoaded', init);
