(function () {
  'use strict';

  const ROUND_COUNT = 3;
  const DEFAULT_SEED_MAX = 9999;

  const SHIP_CLASSES = [
    {
      key: 'corvette',
      name: 'Corvette',
      attack: 45,
      defense: 25,
      hull: 300,
      speed: 90,
      shieldLevel: 'L0',
      shieldCap: 0,
      shieldRegen: 0,
      role: 'escort'
    },
    {
      key: 'destroyer',
      name: 'Destroyer',
      attack: 70,
      defense: 55,
      hull: 550,
      speed: 65,
      shieldLevel: 'L1',
      shieldCap: 200,
      shieldRegen: 10,
      role: 'escort'
    },
    {
      key: 'heavyFrigate',
      name: 'Heavy Frigate',
      attack: 90,
      defense: 75,
      hull: 800,
      speed: 45,
      shieldLevel: 'L2',
      shieldCap: 300,
      shieldRegen: 15,
      role: 'line'
    },
    {
      key: 'cruiser',
      name: 'Cruiser',
      attack: 130,
      defense: 90,
      hull: 1200,
      speed: 35,
      shieldLevel: 'L3',
      shieldCap: 500,
      shieldRegen: 20,
      role: 'capital'
    },
    {
      key: 'battleship',
      name: 'Battleship',
      attack: 190,
      defense: 130,
      hull: 2000,
      speed: 20,
      shieldLevel: 'L4',
      shieldCap: 800,
      shieldRegen: 25,
      role: 'capital'
    },
    {
      key: 'megaStation',
      name: 'Mega Battle Station',
      attack: 1300,
      defense: 900,
      hull: 12000,
      speed: 0,
      shieldLevel: 'L5',
      shieldCap: 5000,
      shieldRegen: 50,
      role: 'station'
    }
  ];

  const CLASS_MAP = SHIP_CLASSES.reduce((acc, cls) => {
    acc[cls.key] = cls;
    return acc;
  }, {});

  const FORMATIONS = {
    spearhead: {
      key: 'spearhead',
      label: 'Spearhead',
      description: '+12% damage, +8% incoming damage, +6 initiative',
      modifiers: { damage: 0.12, incoming: 0.08, initiative: 6 }
    },
    phalanx: {
      key: 'phalanx',
      label: 'Phalanx',
      description: '-5 initiative, -10% incoming damage, +18% shield regen',
      modifiers: { incoming: -0.1, regen: 0.18, initiative: -5 }
    },
    dispersed: {
      key: 'dispersed',
      label: 'Dispersed Line',
      description: '-5% damage, -15% incoming damage, +4 initiative',
      modifiers: { damage: -0.05, incoming: -0.15, initiative: 4 }
    }
  };

  const TACTICS = {
    aggressive: {
      key: 'aggressive',
      label: 'Aggressive',
      description: '+15% damage (+10% extra in round 1), +10% incoming damage, -5% shield regen',
      modifiers: { damage: 0.15, incoming: 0.1, regen: -0.05 },
      roundOneDamage: 0.1
    },
    balanced: {
      key: 'balanced',
      label: 'Balanced',
      description: '+5% accuracy, -5% incoming damage, +8 morale end of round',
      modifiers: { damage: 0.05, incoming: -0.05 },
      moraleEnd: 8
    },
    defensive: {
      key: 'defensive',
      label: 'Defensive',
      description: '-15% damage, +30% shield regen, +10% shield cap, -5% incoming damage, +10% withdraw chance',
      modifiers: { damage: -0.15, regen: 0.3, shieldCap: 0.1, incoming: -0.05 },
      withdrawBonus: 0.1
    }
  };

  const THEATERS = {
    deepSpace: {
      key: 'deepSpace',
      label: 'Open Deep Space',
      description: 'Neutral engagement with minimal environmental effects.',
      effects: {}
    },
    gasGiant: {
      key: 'gasGiant',
      label: 'Gas-Giant Storm Layer',
      description: 'Sensor static reduces accuracy; shield regeneration surges in the lightning haze.',
      effects: { damage: -0.05, regen: 0.2, initiative: -4, variance: 0.03 }
    },
    asteroidBelt: {
      key: 'asteroidBelt',
      label: 'Asteroid Belt',
      description: 'Small craft weave the rocks (+evasion); big hulls struggle to maneuver.',
      effects: {
        classIncoming: { corvette: -0.15, destroyer: -0.1 },
        initiative: -3,
        capitalIncoming: 0.05
      }
    },
    stationYard: {
      key: 'stationYard',
      label: 'Station Yard / High Orbit',
      description: 'Defensive turrets lend a hand; expect steady targeting solutions.',
      effects: { damage: 0.05 }
    },
    graveglass: {
      key: 'graveglass',
      label: 'Graveglass Veil',
      description: 'Sensors flicker and beams scatter — initiative and accuracy both suffer.',
      effects: { damage: -0.05, initiative: -5, variance: 0.05 }
    },
    temporalSlip: {
      key: 'temporalSlip',
      label: 'Temporal-Slip Corridor',
      description: 'Time-shear causes wild initiative swings and risky retreats.',
      effects: { variance: 0.08, initiativeVariance: 0.1, withdrawPenalty: 0.1 }
    }
  };

  const DEFAULT_COUNTS = {
    alpha: { corvette: 8, destroyer: 4, heavyFrigate: 3, cruiser: 2, battleship: 1, megaStation: 0 },
    beta: { corvette: 10, destroyer: 3, heavyFrigate: 2, cruiser: 2, battleship: 1, megaStation: 0 }
  };

  const DEFAULT_SETUP = {
    alpha: { formation: 'spearhead', tactic: 'aggressive' },
    beta: { formation: 'phalanx', tactic: 'defensive' }
  };

  const DEFAULT_NAMES = {
    alpha: 'Fleet Alpha',
    beta: 'Fleet Beta'
  };

  const STATUS_TEMPLATE = () => ({
    accuracy: 0,
    incoming: 0,
    regen: 0,
    initiative: 0,
    shieldCap: 0,
    withdrawBlock: false
  });

  const ORDER_DEFINITIONS = {
    corvette: [
      {
        key: 'standard',
        label: 'Standard Maneuvers',
        short: 'Standard',
        description: 'Hold formation and engage at default parameters.',
        effects: {}
      },
      {
        key: 'flank',
        label: 'Flank',
        short: 'Flank',
        description: '+20% damage vs capitals, but the squadron is exposed.',
        effects: { damage: 0.2, incoming: 0.2 }
      },
      {
        key: 'evade',
        label: 'Evade Pattern',
        short: 'Evade',
        description: 'Break contact and dodge hard; damage output plunges.',
        effects: { damage: -0.3, incoming: -0.25 }
      },
      {
        key: 'overdrive',
        label: 'Overdrive',
        short: 'Overdrive',
        description: 'Thruster surge for initiative; causes 10% self-hull stress.',
        effects: { damage: 0.08, incoming: 0.1, initiative: 12, selfHullTick: 0.1 }
      }
    ],
    destroyer: [
      {
        key: 'standard',
        label: 'Standard Fire Mission',
        short: 'Standard',
        description: 'Sustain battery fire and escort screening.',
        effects: {}
      },
      {
        key: 'shieldScreen',
        label: 'Shield Screen',
        short: 'Shield Screen',
        description: 'Project barriers forward: -8% incoming damage, +20% shield capacity.',
        effects: { incoming: -0.08, shieldCap: 0.2 }
      },
      {
        key: 'targetLock',
        label: 'Target Lock (Matrix)',
        short: 'Target Lock',
        description: 'Matrix uplink improves accuracy by 18%.',
        effects: { damage: 0.18 }
      },
      {
        key: 'pdOverclock',
        label: 'PD Overclock',
        short: 'PD Overclock',
        description: 'Boost point-defense at the cost of 10% main battery damage and 5% regen.',
        effects: { damage: -0.1, incoming: -0.05, regen: -0.05 }
      }
    ],
    heavyFrigate: [
      {
        key: 'standard',
        label: 'Standard Engagement',
        short: 'Standard',
        description: 'Hold the firing line with no special directives.',
        effects: {}
      },
      {
        key: 'suppressive',
        label: 'Suppressive Volley',
        short: 'Suppressive',
        description: 'Enemy accuracy -15% and evasion -10% next round (stacks). Damage -8% this round.',
        effects: { damage: -0.08, enemyAccuracyNext: -0.15, enemyIncomingNext: 0.1 }
      },
      {
        key: 'focusFire',
        label: 'Focus Fire',
        short: 'Focus Fire',
        description: 'Concentrate on a priority hull: +25% damage.',
        effects: { damage: 0.25 }
      }
    ],
    cruiser: [
      {
        key: 'standard',
        label: 'Standard Broadsides',
        short: 'Standard',
        description: 'Maintain standard cruiser fire patterns.',
        effects: {}
      },
      {
        key: 'broadside',
        label: 'Broadside',
        short: 'Broadside',
        description: 'Devastating alpha strike (+35% damage). Cooldown 1 round.',
        effects: { damage: 0.35 },
        cooldown: 1
      },
      {
        key: 'lanceOvercharge',
        label: 'Lance Overcharge',
        short: 'Lance',
        description: 'Overcharge spinal lances: +20% damage, 50% shield pierce, +5% incoming damage.',
        effects: { damage: 0.2, shieldPierce: 0.5, incoming: 0.05 }
      },
      {
        key: 'commandRelay',
        label: 'Command Relay',
        short: 'Relay',
        description: 'Relay uplink boosts fleet accuracy (+10% damage) and morale (+10); cruiser -20% damage.',
        effects: { damage: -0.2, fleetDamage: 0.1, moraleEndBonus: 10 }
      }
    ],
    battleship: [
      {
        key: 'standard',
        label: 'Standard Salvos',
        short: 'Standard',
        description: 'Maintain steady capital ship volleys.',
        effects: {}
      },
      {
        key: 'spinalSalvo',
        label: 'Spinal Salvo',
        short: 'Salvo',
        description: 'Channel everything into a single target: +120% damage. Cooldown 1 round.',
        effects: { damage: 1.2 },
        cooldown: 1
      },
      {
        key: 'fortress',
        label: 'Fortress Posture',
        short: 'Fortress',
        description: 'Armor and PD focus: -15% damage, -12% incoming, +20% regen, -5 initiative.',
        effects: { damage: -0.15, incoming: -0.12, regen: 0.2, initiative: -5 }
      },
      {
        key: 'commandBeacon',
        label: 'Command Beacon',
        short: 'Beacon',
        description: 'Fleet accuracy up (+10% damage) and morale +8; battleship -50% damage.',
        effects: { damage: -0.5, fleetDamage: 0.1, moraleEndBonus: 8, incoming: -0.05 }
      },
      {
        key: 'shockBarrage',
        label: 'Shock Barrage',
        short: 'Shock',
        description: 'Electromagnetic barrage: enemy accuracy -20% and regen -15% next round; +10% damage.',
        effects: { damage: 0.1, enemyAccuracyNext: -0.2, enemyRegenNext: -0.15 }
      }
    ],
    megaStation: [
      {
        key: 'standard',
        label: 'Station Batteries',
        short: 'Standard',
        description: 'Maintain standard fire plans.',
        effects: {}
      },
      {
        key: 'bastionShield',
        label: 'Bastion Shield',
        short: 'Bastion',
        description: 'Power to shields: damage -10%, incoming -12%, regen +15%, cap +10%.',
        effects: { damage: -0.1, incoming: -0.12, regen: 0.15, shieldCap: 0.1 }
      },
      {
        key: 'cataclysmLance',
        label: 'Cataclysm Lance',
        short: 'Cataclysm',
        description: 'Massive lance strike: +40% damage, 60% shield pierce, enemy incoming +5% next round. Max 2 uses.',
        effects: { damage: 0.4, shieldPierce: 0.6, enemyIncomingNext: 0.05, selfNextRegen: -0.2 },
        limitedUses: 2
      },
      {
        key: 'gravWell',
        label: 'Grav-Well Snare',
        short: 'Grav-Well',
        description: 'Lock down withdrawals: enemy withdraw blocked next round; enemy initiative -8 next round.',
        effects: { enemyInitiativeNext: -8, enemyWithdrawBlock: true }
      },
      {
        key: 'dockRepair',
        label: 'Dock & Repair',
        short: 'Dock & Repair',
        description: 'Restore 12% hull and +300 shields to the most damaged capital ally; station damage -20%.',
        effects: { damage: -0.2, repair: 0.12, shieldRestore: 300 }
      }
    ]
  };

  const ORDER_LOOKUP = Object.keys(ORDER_DEFINITIONS).reduce((acc, clsKey) => {
    acc[clsKey] = ORDER_DEFINITIONS[clsKey].reduce((map, order) => {
      map[order.key] = order;
      return map;
    }, {});
    return acc;
  }, {});

  document.addEventListener('DOMContentLoaded', () => {
    buildFleetForms();
    populateTheaterSelect();
    bindFormHandlers();
  });

  function buildFleetForms() {
    document.querySelectorAll('.js-fleet-config').forEach(container => {
      const fleetKey = container.dataset.fleet;
      if (!fleetKey) return;
      container.innerHTML = buildFleetMarkup(fleetKey);
      bindFleetEvents(container, fleetKey);
    });
  }

  function populateTheaterSelect() {
    const select = document.getElementById('battle-theater');
    if (!select) return;
    select.innerHTML = '';
    Object.values(THEATERS).forEach(theater => {
      const option = document.createElement('option');
      option.value = theater.key;
      option.textContent = theater.label;
      option.title = theater.description;
      if (theater.key === 'deepSpace') option.selected = true;
      select.appendChild(option);
    });
  }

  function bindFormHandlers() {
    const form = document.getElementById('simulator-form');
    if (!form) return;
    const runButton = document.getElementById('run-simulation');
    const resetButton = document.getElementById('reset-simulation');
    if (runButton) runButton.addEventListener('click', handleRunSimulation);
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        window.setTimeout(() => {
          document.querySelectorAll('.js-fleet-config').forEach(container => {
            const fleetKey = container.dataset.fleet;
            updateCombinedStatus(fleetKey);
          });
          renderBattleReport(null);
        }, 0);
      });
    }
  }

  function buildFleetMarkup(fleetKey) {
    const defaults = DEFAULT_COUNTS[fleetKey] || {};
    const defaultSetup = DEFAULT_SETUP[fleetKey] || {};
    const nameField = `${fleetKey}-name`;
    const commanderField = `${fleetKey}-commander`;
    const withdrawField = `${fleetKey}-withdraw`;
    const volleyField = `${fleetKey}-volley`;

    const shipInputs = SHIP_CLASSES.map(cls => {
      const defaultCount = typeof defaults[cls.key] === 'number' ? defaults[cls.key] : 0;
      const statsLabel = `${cls.attack}/${cls.defense}/${cls.hull} Hull / ${cls.speed} Spd${cls.shieldCap ? ` · ${cls.shieldLevel} (${cls.shieldCap}•${cls.shieldRegen})` : ''}`;
      return `
        <label class="sim-ship-field">
          <span class="sim-ship-field__title">
            <span class="sim-ship-field__name">${cls.name}</span>
            <span class="sim-ship-field__stats">${statsLabel}</span>
          </span>
          <input type="number" inputmode="numeric" min="0" step="1" class="sim-input" name="${fleetKey}-count-${cls.key}" value="${defaultCount}" aria-label="${cls.name} count" />
        </label>
      `;
    }).join('');

    const formationOptions = Object.values(FORMATIONS).map(formation => {
      const selected = formation.key === defaultSetup.formation ? ' selected' : '';
      return `<option value="${formation.key}"${selected} title="${formation.description}">${formation.label}</option>`;
    }).join('');

    const tacticOptions = Object.values(TACTICS).map(tactic => {
      const selected = tactic.key === defaultSetup.tactic ? ' selected' : '';
      return `<option value="${tactic.key}"${selected} title="${tactic.description}">${tactic.label}</option>`;
    }).join('');

    const ordersTableRows = SHIP_CLASSES.map(cls => {
      const orderOptions = (ORDER_DEFINITIONS[cls.key] || []).map((order, idx) => {
        const selected = idx === 0 ? ' selected' : '';
        return `<option value="${order.key}"${selected} title="${order.description}">${order.short || order.label}</option>`;
      }).join('');
      const roundCells = Array.from({ length: ROUND_COUNT }, (_, idx) => {
        const roundNumber = idx + 1;
        return `<td><select class="sim-input sim-input--order" name="${fleetKey}-order-${cls.key}-r${roundNumber}">${orderOptions}</select></td>`;
      }).join('');
      return `
        <tr>
          <th scope="row">${cls.name}</th>
          ${roundCells}
        </tr>
      `;
    }).join('');

    return `
      <div class="fleet-card__grid">
        <label class="sim-field">
          <span class="sim-field__label">Fleet callsign</span>
          <input type="text" name="${nameField}" class="sim-input" value="${DEFAULT_NAMES[fleetKey] || ''}" />
        </label>
        <label class="sim-field">
          <span class="sim-field__label">Commander</span>
          <input type="text" name="${commanderField}" class="sim-input" placeholder="Optional" />
        </label>
      </div>
      <div class="fleet-composition">
        <h4 class="fleet-section-title">Ship roster</h4>
        <div class="fleet-composition__grid">
          ${shipInputs}
        </div>
      </div>
      <div class="fleet-card__grid fleet-card__grid--minor">
        <label class="sim-field">
          <span class="sim-field__label">Formation</span>
          <select name="${fleetKey}-formation" class="sim-input">${formationOptions}</select>
        </label>
        <label class="sim-field">
          <span class="sim-field__label">Tactic</span>
          <select name="${fleetKey}-tactic" class="sim-input">${tacticOptions}</select>
        </label>
      </div>
      <label class="sim-checkbox">
        <input type="checkbox" name="${withdrawField}" />
        <span>Allow withdraw checks after rounds one and two</span>
      </label>
      <label class="sim-checkbox">
        <input type="checkbox" name="${volleyField}" disabled />
        <span>Volley Coordination in round one (Combined-Arms only)</span>
      </label>
      <p class="combined-status" data-role="combined-status">Add all six classes to unlock the Combined-Arms bonus.</p>
      <div class="fleet-orders">
        <h4 class="fleet-section-title">Class orders by round</h4>
        <table class="sim-order-table">
          <thead>
            <tr>
              <th scope="col">Class</th>
              ${Array.from({ length: ROUND_COUNT }, (_, idx) => `<th scope="col">R${idx + 1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${ordersTableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  function bindFleetEvents(container, fleetKey) {
    const inputs = container.querySelectorAll(`input[name^="${fleetKey}-count-"]`);
    inputs.forEach(input => {
      input.addEventListener('input', () => updateCombinedStatus(fleetKey));
      input.addEventListener('change', () => updateCombinedStatus(fleetKey));
    });
    updateCombinedStatus(fleetKey);
  }

  function updateCombinedStatus(fleetKey) {
    const container = document.querySelector(`.fleet-card[data-fleet="${fleetKey}"]`);
    if (!container) return;
    const statusEl = container.querySelector('[data-role="combined-status"]');
    const volleyInput = container.querySelector(`input[name="${fleetKey}-volley"]`);
    let hasCombined = true;
    SHIP_CLASSES.forEach(cls => {
      const field = container.querySelector(`input[name="${fleetKey}-count-${cls.key}"]`);
      const count = field ? Number(field.value) || 0 : 0;
      if (count <= 0) hasCombined = false;
    });
    if (volleyInput) {
      volleyInput.disabled = !hasCombined;
      if (!hasCombined) volleyInput.checked = false;
    }
    if (statusEl) {
      statusEl.textContent = hasCombined
        ? 'Combined-Arms bonus active: +10% command sync, -10% incoming damage, Volley Coordination unlocked.'
        : 'Add all six classes to unlock the Combined-Arms bonus.';
    }
  }

  function handleRunSimulation() {
    const configAlpha = readFleetConfig('alpha');
    const configBeta = readFleetConfig('beta');
    const theaterSelect = document.getElementById('battle-theater');
    const varianceInput = document.getElementById('variance-seed');
    const theaterKey = theaterSelect ? theaterSelect.value : 'deepSpace';
    const theater = THEATERS[theaterKey] || THEATERS.deepSpace;
    const seedValue = varianceInput && varianceInput.value !== '' ? Number(varianceInput.value) : null;
    const seed = Number.isFinite(seedValue) ? Math.max(0, Math.min(DEFAULT_SEED_MAX, Math.floor(seedValue))) : null;

    if (!hasActiveFleet(configAlpha) && !hasActiveFleet(configBeta)) {
      renderBattleReport({ error: 'Assign at least one ship to run the simulator.' });
      return;
    }

    const rng = seed != null ? seededRandom(seed) : Math.random;
    const battleResult = simulateBattle(configAlpha, configBeta, {
      theater,
      seed,
      rng
    });
    renderBattleReport(battleResult);
  }

  function hasActiveFleet(config) {
    return SHIP_CLASSES.some(cls => (config.counts[cls.key] || 0) > 0);
  }

  function readFleetConfig(fleetKey) {
    const card = document.querySelector(`.fleet-card[data-fleet="${fleetKey}"]`);
    const counts = {};
    const orders = {};
    let name = DEFAULT_NAMES[fleetKey] || '';
    let commander = '';
    if (card) {
      const nameField = card.querySelector(`input[name="${fleetKey}-name"]`);
      const commanderField = card.querySelector(`input[name="${fleetKey}-commander"]`);
      name = nameField && nameField.value ? nameField.value : name;
      commander = commanderField && commanderField.value ? commanderField.value : '';
      SHIP_CLASSES.forEach(cls => {
        const input = card.querySelector(`input[name="${fleetKey}-count-${cls.key}"]`);
        const value = input ? Math.max(0, Number(input.value) || 0) : 0;
        counts[cls.key] = value;
      });
      SHIP_CLASSES.forEach(cls => {
        orders[cls.key] = [];
        for (let round = 1; round <= ROUND_COUNT; round += 1) {
          const select = card.querySelector(`select[name="${fleetKey}-order-${cls.key}-r${round}"]`);
          orders[cls.key].push(select ? select.value : 'standard');
        }
      });
    }
    const formationField = card ? card.querySelector(`select[name="${fleetKey}-formation"]`) : null;
    const tacticField = card ? card.querySelector(`select[name="${fleetKey}-tactic"]`) : null;
    const withdrawField = card ? card.querySelector(`input[name="${fleetKey}-withdraw"]`) : null;
    const volleyField = card ? card.querySelector(`input[name="${fleetKey}-volley"]`) : null;
    return {
      key: fleetKey,
      name,
      commander,
      counts,
      formation: formationField ? formationField.value : 'spearhead',
      tactic: tacticField ? tacticField.value : 'aggressive',
      withdraw: Boolean(withdrawField && withdrawField.checked),
      volley: Boolean(volleyField && volleyField.checked),
      orders
    };
  }

  function seededRandom(seed) {
    let state = (seed % 2147483647 + 2147483647) % 2147483647;
    if (state <= 0) state += 2147483646;
    return function () {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  }

  function simulateBattle(configAlpha, configBeta, context) {
    const rounds = [];
    const rng = context.rng || Math.random;
    const theater = context.theater || THEATERS.deepSpace;

    const alphaState = initializeFleetState(configAlpha);
    const betaState = initializeFleetState(configBeta);

    const baseSummary = {
      rounds,
      theater,
      seed: context.seed,
      fleets: {
        alpha: alphaState,
        beta: betaState
      }
    };

    if (!hasActiveFleet(configAlpha) || alphaState.totals.initialHull <= 0) {
      alphaState.destroyed = true;
    }
    if (!hasActiveFleet(configBeta) || betaState.totals.initialHull <= 0) {
      betaState.destroyed = true;
    }

    for (let roundNumber = 1; roundNumber <= ROUND_COUNT; roundNumber += 1) {
      if (alphaState.destroyed || betaState.destroyed) break;
      if (alphaState.withdrew || betaState.withdrew) break;

      const roundLog = {
        number: roundNumber,
        events: [],
        orderHighlights: { alpha: [], beta: [] }
      };

      const alphaMods = computeRoundModifiers(alphaState, configAlpha, roundNumber, theater, rng, roundLog.orderHighlights.alpha);
      const betaMods = computeRoundModifiers(betaState, configBeta, roundNumber, theater, rng, roundLog.orderHighlights.beta);

      applyShieldCapAdjustments(alphaState, alphaMods);
      applyShieldCapAdjustments(betaState, betaMods);

      const regenAlpha = regenerateShields(alphaState, alphaMods);
      const regenBeta = regenerateShields(betaState, betaMods);
      if (regenAlpha.total > 0) {
        roundLog.events.push(`${alphaState.name} restores ${formatNumber(regenAlpha.total)} shields.`);
      }
      if (regenBeta.total > 0) {
        roundLog.events.push(`${betaState.name} restores ${formatNumber(regenBeta.total)} shields.`);
      }

      applySpecialActions(alphaState, alphaMods, roundLog.events);
      applySpecialActions(betaState, betaMods, roundLog.events);

      const initiativeAlpha = computeInitiative(alphaState, alphaMods, rng, theater);
      const initiativeBeta = computeInitiative(betaState, betaMods, rng, theater);
      const order = determineInitiativeOrder(initiativeAlpha.score, initiativeBeta.score, rng);
      roundLog.initiative = {
        order,
        scores: { alpha: initiativeAlpha.score, beta: initiativeBeta.score },
        notes: [...initiativeAlpha.notes, ...initiativeBeta.notes]
      };

      const preHullAlpha = alphaState.totals.hullRemaining;
      const preHullBeta = betaState.totals.hullRemaining;

      const attacks = order === 'alphaFirst'
        ? [
            { attacker: alphaState, defender: betaState, modsAttacker: alphaMods, modsDefender: betaMods, label: 'Alpha' },
            { attacker: betaState, defender: alphaState, modsAttacker: betaMods, modsDefender: alphaMods, label: 'Beta' }
          ]
        : [
            { attacker: betaState, defender: alphaState, modsAttacker: betaMods, modsDefender: alphaMods, label: 'Beta' },
            { attacker: alphaState, defender: betaState, modsAttacker: alphaMods, modsDefender: betaMods, label: 'Alpha' }
          ];

      attacks.forEach(({ attacker, defender, modsAttacker, modsDefender }) => {
        if (attacker.destroyed || attacker.withdrew) return;
        if (defender.destroyed || defender.withdrew) return;
        const result = resolveAttack(attacker, defender, modsAttacker, modsDefender, rng, roundNumber);
        if (result && result.totalDamage > 0) {
          roundLog.events.push(`${attacker.name} deals ${formatNumber(result.totalDamage)} damage (${formatNumber(result.hullDamage)} hull) to ${defender.name}.`);
        } else {
          roundLog.events.push(`${attacker.name} fails to land meaningful damage.`);
        }
        if (result && result.selfInflicted.length) {
          result.selfInflicted.forEach(entry => {
            roundLog.events.push(`${attacker.name} ${entry}`);
          });
        }
      });

      const postHullAlpha = alphaState.totals.hullRemaining;
      const postHullBeta = betaState.totals.hullRemaining;

      const hullLossAlpha = Math.max(0, preHullAlpha - postHullAlpha);
      const hullLossBeta = Math.max(0, preHullBeta - postHullBeta);

      const moraleBeforeAlpha = alphaState.morale;
      const moraleBeforeBeta = betaState.morale;

      adjustMorale(alphaState, hullLossAlpha, alphaMods);
      adjustMorale(betaState, hullLossBeta, betaMods);

      roundLog.morale = {
        alpha: { before: moraleBeforeAlpha, after: alphaState.morale },
        beta: { before: moraleBeforeBeta, after: betaState.morale }
      };

      handleWithdraw(alphaState, betaState, alphaMods, betaMods, roundNumber, rng, theater, roundLog.events);
      handleWithdraw(betaState, alphaState, betaMods, alphaMods, roundNumber, rng, theater, roundLog.events);

      updateStatusForNextRound(alphaState, alphaMods, betaMods);
      updateStatusForNextRound(betaState, betaMods, alphaMods);

      rounds.push(roundLog);

      if (alphaState.destroyed || betaState.destroyed) break;
      if (alphaState.withdrew || betaState.withdrew) break;
    }

    const outcome = determineOutcome(alphaState, betaState);
    return {
      ...baseSummary,
      outcome
    };
  }

  function initializeFleetState(config) {
    const classes = {};
    let initialHull = 0;
    let initialShield = 0;
    SHIP_CLASSES.forEach(cls => {
      const count = Math.max(0, Number(config.counts[cls.key]) || 0);
      const hullTotal = cls.hull * count;
      const shieldCap = cls.shieldCap * count;
      classes[cls.key] = {
        key: cls.key,
        name: cls.name,
        base: cls,
        startCount: count,
        currentCount: count,
        hullTotal,
        hullRemaining: hullTotal,
        shieldCapBase: shieldCap,
        shieldCapCurrent: shieldCap,
        shieldRemaining: shieldCap,
        regenBase: cls.shieldRegen * count
      };
      initialHull += hullTotal;
      initialShield += shieldCap;
    });
    return {
      key: config.key,
      name: config.name || DEFAULT_NAMES[config.key] || 'Fleet',
      commander: config.commander || '',
      formation: config.formation,
      tactic: config.tactic,
      withdrawIntent: config.withdraw,
      volleyPlanned: config.volley,
      combinedArms: checkCombinedArms(config.counts),
      volleyUsed: false,
      morale: 60,
      statusCurrent: STATUS_TEMPLATE(),
      classes,
      orderHistory: {},
      orderUsage: {},
      totals: {
        initialHull,
        initialShield,
        hullRemaining: initialHull,
        shieldRemaining: initialShield
      },
      destroyed: initialHull <= 0,
      withdrew: false,
      withdrewRound: null,
      withdrawLocked: false
    };
  }

  function checkCombinedArms(counts) {
    return SHIP_CLASSES.every(cls => (counts[cls.key] || 0) > 0);
  }

  function computeRoundModifiers(state, config, roundNumber, theater, rng, highlightCollector) {
    const mods = {
      damageBonus: 0,
      incomingBonus: 0,
      regenBonus: 0,
      shieldCapBonus: 0,
      initiativeBonus: 0,
      moraleEndBonus: 0,
      variance: 0.07,
      classEffects: {},
      enemyNextStatus: STATUS_TEMPLATE(),
      selfNextStatus: STATUS_TEMPLATE(),
      messages: []
    };

    const status = state.statusCurrent || STATUS_TEMPLATE();
    mods.damageBonus += status.accuracy;
    mods.incomingBonus += status.incoming;
    mods.regenBonus += status.regen;
    mods.initiativeBonus += status.initiative;
    mods.shieldCapBonus += status.shieldCap;
    state.withdrawLocked = Boolean(status.withdrawBlock);

    const formation = FORMATIONS[config.formation];
    if (formation) {
      Object.entries(formation.modifiers).forEach(([key, value]) => {
        if (key === 'damage') mods.damageBonus += value;
        else if (key === 'incoming') mods.incomingBonus += value;
        else if (key === 'regen') mods.regenBonus += value;
        else if (key === 'shieldCap') mods.shieldCapBonus += value;
        else if (key === 'initiative') mods.initiativeBonus += value;
      });
      mods.messages.push(`${state.name} formation: ${formation.label}`);
    }

    const tactic = TACTICS[config.tactic];
    if (tactic) {
      Object.entries(tactic.modifiers || {}).forEach(([key, value]) => {
        if (key === 'damage') mods.damageBonus += value;
        else if (key === 'incoming') mods.incomingBonus += value;
        else if (key === 'regen') mods.regenBonus += value;
        else if (key === 'shieldCap') mods.shieldCapBonus += value;
      });
      if (typeof tactic.roundOneDamage === 'number' && roundNumber === 1) {
        mods.damageBonus += tactic.roundOneDamage;
      }
      if (typeof tactic.moraleEnd === 'number') {
        mods.moraleEndBonus += tactic.moraleEnd;
      }
    }

    if (state.combinedArms) {
      mods.damageBonus += 0.1;
      mods.incomingBonus -= 0.1;
      if (state.volleyPlanned && !state.volleyUsed && roundNumber === 1) {
        mods.damageBonus += 0.15;
        mods.messages.push(`${state.name} triggers Volley Coordination (+15% damage).`);
        state.volleyUsed = true;
      }
    }

    if (theater && theater.effects) {
      if (typeof theater.effects.damage === 'number') mods.damageBonus += theater.effects.damage;
      if (typeof theater.effects.incoming === 'number') mods.incomingBonus += theater.effects.incoming;
      if (typeof theater.effects.regen === 'number') mods.regenBonus += theater.effects.regen;
      if (typeof theater.effects.shieldCap === 'number') mods.shieldCapBonus += theater.effects.shieldCap;
      if (typeof theater.effects.initiative === 'number') mods.initiativeBonus += theater.effects.initiative;
      if (typeof theater.effects.variance === 'number') mods.variance += theater.effects.variance;
    }

    SHIP_CLASSES.forEach(cls => {
      mods.classEffects[cls.key] = {
        damageBonus: 0,
        incomingBonus: 0,
        regenBonus: 0,
        shieldCapBonus: 0,
        shieldPierce: 0,
        initiativeBonus: 0,
        selfHullTick: 0,
        moraleEndBonus: 0,
        specialActions: [],
        label: 'Standard',
        orderKey: 'standard',
        disabledReason: null
      };
    });

    SHIP_CLASSES.forEach(cls => {
      const classState = state.classes[cls.key];
      const orderKey = (config.orders[cls.key] || [])[roundNumber - 1] || 'standard';
      const orderDef = ORDER_LOOKUP[cls.key] ? ORDER_LOOKUP[cls.key][orderKey] : null;
      const classEffect = mods.classEffects[cls.key];
      classEffect.label = orderDef ? orderDef.label : 'Standard';
      classEffect.orderKey = orderKey;
      if (!classState || classState.currentCount <= 0 || classState.hullRemaining <= 0) {
        classEffect.disabledReason = 'No active ships';
        return;
      }
      let disabledReason = null;
      if (orderDef && orderDef.cooldown) {
        const history = state.orderHistory[cls.key] || [];
        const lastOrder = history[history.length - 1];
        if (lastOrder === orderKey) {
          disabledReason = 'Cooldown (must rest 1 round)';
        }
      }
      if (!disabledReason && orderDef && orderDef.limitedUses) {
        const usageMap = state.orderUsage[cls.key] || {};
        const used = usageMap[orderKey] || 0;
        if (used >= orderDef.limitedUses) {
          disabledReason = 'No charges remaining';
        }
      }
      if (orderDef && !disabledReason) {
        applyOrderEffects(orderDef.effects || {}, classEffect, mods, state);
        if (!state.orderUsage[cls.key]) state.orderUsage[cls.key] = {};
        state.orderUsage[cls.key][orderKey] = (state.orderUsage[cls.key][orderKey] || 0) + 1;
        if (highlightCollector) {
          highlightCollector.push(`${cls.name}: ${orderDef.label}`);
        }
      } else if (disabledReason) {
        classEffect.disabledReason = disabledReason;
        classEffect.label += ' (inactive)';
        if (highlightCollector) {
          highlightCollector.push(`${cls.name}: ${orderDef ? orderDef.label : 'Standard'} (inactive)`);
        }
      }
      if (!state.orderHistory[cls.key]) state.orderHistory[cls.key] = [];
      state.orderHistory[cls.key].push(orderKey);
    });

    if (theater && theater.effects) {
      if (theater.effects.classIncoming) {
        Object.entries(theater.effects.classIncoming).forEach(([clsKey, value]) => {
          if (mods.classEffects[clsKey]) mods.classEffects[clsKey].incomingBonus += value;
        });
      }
      if (typeof theater.effects.capitalIncoming === 'number') {
        ['cruiser', 'battleship', 'megaStation'].forEach(clsKey => {
          if (mods.classEffects[clsKey]) mods.classEffects[clsKey].incomingBonus += theater.effects.capitalIncoming;
        });
      }
    }

    if (highlightCollector && mods.messages.length) {
      mods.messages.forEach(msg => highlightCollector.push(msg));
    }

    return mods;
  }

  function applyOrderEffects(effects, classEffect, mods, state) {
    if (!effects) return;
    if (typeof effects.damage === 'number') classEffect.damageBonus += effects.damage;
    if (typeof effects.incoming === 'number') classEffect.incomingBonus += effects.incoming;
    if (typeof effects.regen === 'number') classEffect.regenBonus += effects.regen;
    if (typeof effects.shieldCap === 'number') classEffect.shieldCapBonus += effects.shieldCap;
    if (typeof effects.shieldPierce === 'number') classEffect.shieldPierce += effects.shieldPierce;
    if (typeof effects.initiative === 'number') classEffect.initiativeBonus += effects.initiative;
    if (typeof effects.selfHullTick === 'number') classEffect.selfHullTick += effects.selfHullTick;
    if (typeof effects.moraleEndBonus === 'number') classEffect.moraleEndBonus += effects.moraleEndBonus;
    if (typeof effects.fleetDamage === 'number') mods.damageBonus += effects.fleetDamage;
    if (typeof effects.enemyAccuracyNext === 'number') mods.enemyNextStatus.accuracy += effects.enemyAccuracyNext;
    if (typeof effects.enemyIncomingNext === 'number') mods.enemyNextStatus.incoming += effects.enemyIncomingNext;
    if (typeof effects.enemyRegenNext === 'number') mods.enemyNextStatus.regen += effects.enemyRegenNext;
    if (typeof effects.enemyInitiativeNext === 'number') mods.enemyNextStatus.initiative += effects.enemyInitiativeNext;
    if (effects.enemyWithdrawBlock) mods.enemyNextStatus.withdrawBlock = true;
    if (typeof effects.selfNextRegen === 'number') mods.selfNextStatus.regen += effects.selfNextRegen;
    if (typeof effects.selfNextShieldCap === 'number') mods.selfNextStatus.shieldCap += effects.selfNextShieldCap;
    if (typeof effects.repair === 'number') {
      classEffect.specialActions.push({
        type: 'repair',
        amount: effects.repair,
        shieldRestore: effects.shieldRestore || 0
      });
    }
  }

  function applyShieldCapAdjustments(state, mods) {
    SHIP_CLASSES.forEach(cls => {
      const classState = state.classes[cls.key];
      if (!classState) return;
      const baseCap = classState.shieldCapBase;
      const capMultiplier = 1 + mods.shieldCapBonus + (mods.classEffects[cls.key]?.shieldCapBonus || 0);
      const adjustedCap = Math.max(0, baseCap * capMultiplier);
      classState.shieldCapCurrent = adjustedCap;
      if (classState.shieldRemaining > adjustedCap) {
        classState.shieldRemaining = adjustedCap;
      }
    });
    updateFleetTotals(state);
  }

  function regenerateShields(state, mods) {
    let totalRestored = 0;
    SHIP_CLASSES.forEach(cls => {
      const classState = state.classes[cls.key];
      if (!classState || classState.shieldCapCurrent <= 0) return;
      const regenMultiplier = 1 + mods.regenBonus + (mods.classEffects[cls.key]?.regenBonus || 0);
      const regenAmount = Math.max(0, classState.regenBase * regenMultiplier);
      if (regenAmount <= 0) return;
      const newValue = Math.min(classState.shieldCapCurrent, classState.shieldRemaining + regenAmount);
      const delta = newValue - classState.shieldRemaining;
      if (delta > 0) {
        totalRestored += delta;
        classState.shieldRemaining = newValue;
      }
    });
    updateFleetTotals(state);
    return { total: totalRestored };
  }

  function applySpecialActions(state, mods, events) {
    SHIP_CLASSES.forEach(cls => {
      const classEffect = mods.classEffects[cls.key];
      if (!classEffect || !classEffect.specialActions.length) return;
      classEffect.specialActions.forEach(action => {
        if (action.type === 'repair') {
          const target = pickRepairTarget(state);
          if (!target) return;
          const hullRestore = target.hullTotal * action.amount;
          const shieldRestore = action.shieldRestore || 0;
          target.hullRemaining = Math.min(target.hullTotal, target.hullRemaining + hullRestore);
          target.shieldRemaining = Math.min(target.shieldCapCurrent, target.shieldRemaining + shieldRestore);
          events.push(`${state.name} restores ${formatNumber(hullRestore)} hull${shieldRestore ? ` and ${formatNumber(shieldRestore)} shields` : ''} to ${target.name}.`);
          updateFleetTotals(state);
        }
      });
    });
  }

  function pickRepairTarget(state) {
    const priority = ['battleship', 'cruiser', 'heavyFrigate'];
    let best = null;
    let maxMissing = 0;
    priority.forEach(key => {
      const classState = state.classes[key];
      if (!classState || classState.hullTotal <= 0) return;
      const missing = classState.hullTotal - classState.hullRemaining;
      if (missing > maxMissing) {
        maxMissing = missing;
        best = classState;
      }
    });
    return best;
  }

  function computeInitiative(state, mods, rng, theater) {
    let totalSpeed = 0;
    let totalShips = 0;
    SHIP_CLASSES.forEach(cls => {
      const classState = state.classes[cls.key];
      if (!classState || classState.hullRemaining <= 0) return;
      totalSpeed += cls.speed * classState.currentCount;
      totalShips += classState.currentCount;
    });
    const averageSpeed = totalShips > 0 ? totalSpeed / totalShips : 0;
    const initiative = averageSpeed + mods.initiativeBonus;
    const variance = theater && typeof theater.effects?.initiativeVariance === 'number' ? theater.effects.initiativeVariance : 0.04;
    const randomSwing = (rng() - 0.5) * (variance * 100);
    const finalScore = initiative + randomSwing;
    return {
      score: finalScore,
      notes: [`${state.name} initiative check: base ${averageSpeed.toFixed(1)}, modifiers ${mods.initiativeBonus >= 0 ? '+' : ''}${mods.initiativeBonus.toFixed(1)}, swing ${randomSwing.toFixed(1)}`]
    };
  }

  function determineInitiativeOrder(alphaScore, betaScore, rng) {
    if (alphaScore === betaScore) {
      return rng() >= 0.5 ? 'alphaFirst' : 'betaFirst';
    }
    return alphaScore > betaScore ? 'alphaFirst' : 'betaFirst';
  }

  function resolveAttack(attacker, defender, modsAttacker, modsDefender, rng, roundNumber) {
    updateFleetTotals(attacker);
    updateFleetTotals(defender);
    if (attacker.totals.hullRemaining <= 0) {
      attacker.destroyed = true;
      return null;
    }

    let totalBaseDamage = 0;
    let totalModifiedDamage = 0;
    let shieldPierceWeight = 0;
    const selfInflicted = [];

    SHIP_CLASSES.forEach(cls => {
      const classState = attacker.classes[cls.key];
      if (!classState || classState.hullRemaining <= 0) return;
      const classEffect = modsAttacker.classEffects[cls.key];
      const activeMultiplier = 1 + modsAttacker.damageBonus + (classEffect?.damageBonus || 0);
      const baseDamage = cls.attack * classState.currentCount;
      const contribution = baseDamage * Math.max(0, activeMultiplier);
      totalBaseDamage += baseDamage;
      totalModifiedDamage += contribution;
      if (classEffect && classEffect.shieldPierce) {
        shieldPierceWeight += contribution * classEffect.shieldPierce;
      }
      if (classEffect && classEffect.selfHullTick) {
        const damage = classState.hullRemaining * classEffect.selfHullTick;
        classState.hullRemaining = Math.max(0, classState.hullRemaining - damage);
        selfInflicted.push(`${cls.name} suffers ${formatNumber(damage)} self-hull stress.`);
      }
      if (classEffect && classEffect.moraleEndBonus) {
        modsAttacker.moraleEndBonus = (modsAttacker.moraleEndBonus || 0) + classEffect.moraleEndBonus;
      }
    });

    const baseVariance = modsAttacker.variance || 0.07;
    const varianceSwing = (rng() - 0.5) * baseVariance * 2;
    const damageAfterVariance = Math.max(0, totalModifiedDamage * (1 + varianceSwing));
    const shieldPierceRatio = totalModifiedDamage > 0 ? clamp(shieldPierceWeight / totalModifiedDamage, 0, 0.9) : 0;

    const incomingMultiplier = computeIncomingMultiplier(defender, modsDefender);
    const shieldableDamage = damageAfterVariance * (1 - shieldPierceRatio) * incomingMultiplier;
    const bypassDamage = damageAfterVariance * shieldPierceRatio * incomingMultiplier;

    const damageResult = applyDamage(defender, shieldableDamage, bypassDamage);

    updateFleetTotals(attacker);
    updateFleetTotals(defender);

    return {
      totalDamage: damageResult.total,
      hullDamage: damageResult.hullDamage,
      shieldDamage: damageResult.shieldDamage,
      selfInflicted,
      variance: varianceSwing,
      roundNumber
    };
  }

  function computeIncomingMultiplier(defender, modsDefender) {
    let totalWeight = 0;
    let weighted = 0;
    SHIP_CLASSES.forEach(cls => {
      const classState = defender.classes[cls.key];
      if (!classState || classState.hullRemaining <= 0) return;
      const classIncoming = 1 + (modsDefender.classEffects[cls.key]?.incomingBonus || 0);
      const weight = classState.hullRemaining || (classState.base.hull * classState.currentCount);
      totalWeight += weight;
      weighted += weight * classIncoming;
    });
    const classMultiplier = totalWeight > 0 ? weighted / totalWeight : 1;
    const global = 1 + modsDefender.incomingBonus;
    return Math.max(0.2, global * classMultiplier);
  }

  function applyDamage(defender, shieldableDamage, bypassDamage) {
    let remainingShieldable = Math.max(0, shieldableDamage);
    let remainingBypass = Math.max(0, bypassDamage);
    let shieldDamage = 0;
    let hullDamage = 0;

    if (remainingShieldable > 0) {
      const totalShields = defender.totals.shieldRemaining;
      if (totalShields > 0) {
        SHIP_CLASSES.forEach(cls => {
          const classState = defender.classes[cls.key];
          if (!classState || classState.shieldRemaining <= 0 || remainingShieldable <= 0) return;
          const share = totalShields > 0 ? classState.shieldRemaining / totalShields : 0;
          const absorbed = Math.min(classState.shieldRemaining, remainingShieldable * share);
          classState.shieldRemaining -= absorbed;
          shieldDamage += absorbed;
        });
        remainingShieldable = Math.max(0, remainingShieldable - shieldDamage);
      }
    }

    const totalHull = defender.totals.hullRemaining;
    const combinedDamage = remainingShieldable + remainingBypass;
    if (combinedDamage > 0 && totalHull > 0) {
      SHIP_CLASSES.forEach(cls => {
        const classState = defender.classes[cls.key];
        if (!classState || classState.hullRemaining <= 0) return;
        const share = classState.hullRemaining / totalHull;
        const damage = combinedDamage * share;
        classState.hullRemaining = Math.max(0, classState.hullRemaining - damage);
        hullDamage += damage;
      });
    }

    updateFleetTotals(defender);

    return {
      total: shieldDamage + hullDamage,
      shieldDamage,
      hullDamage
    };
  }

  function adjustMorale(state, hullLoss, mods) {
    const initialHull = state.totals.initialHull || 1;
    const moraleLoss = (hullLoss / initialHull) * 100;
    state.morale = clamp(state.morale - moraleLoss + (mods.moraleEndBonus || 0), 0, 100);
    if (state.morale <= 0 && !state.destroyed) {
      state.destroyed = true;
    }
  }

  function handleWithdraw(state, opponent, mods, opponentMods, roundNumber, rng, theater, events) {
    if (roundNumber >= ROUND_COUNT) return;
    if (!state.withdrawIntent || state.withdrawLocked) return;
    if (state.destroyed || state.withdrew) return;
    const morale = state.morale;
    if (morale > 65) return;
    let chance = morale < 25 ? 0.65 : 0.45;
    if (TACTICS[state.tactic] && TACTICS[state.tactic].withdrawBonus) {
      chance += TACTICS[state.tactic].withdrawBonus;
    }
    if (theater && theater.effects && theater.effects.withdrawPenalty) {
      chance = Math.max(0, chance - theater.effects.withdrawPenalty);
    }
    if (opponentMods && opponentMods.enemyNextStatus && opponentMods.enemyNextStatus.withdrawBlock) {
      chance = 0;
    }
    chance = clamp(chance, 0, 0.95);
    const roll = rng();
    if (chance > 0 && roll <= chance) {
      state.withdrew = true;
      state.withdrewRound = roundNumber;
      events.push(`${state.name} successfully withdraws after round ${roundNumber}.`);
    } else if (chance > 0) {
      events.push(`${state.name} attempts to withdraw (chance ${formatPercent(chance)}), but fails.`);
    }
  }

  function updateStatusForNextRound(state, mods, opponentMods) {
    const nextStatus = STATUS_TEMPLATE();
    mergeStatus(nextStatus, mods.selfNextStatus || {});
    mergeStatus(nextStatus, opponentMods.enemyNextStatus || {});
    state.statusCurrent = nextStatus;
  }

  function mergeStatus(target, delta) {
    if (!delta) return target;
    target.accuracy += delta.accuracy || 0;
    target.incoming += delta.incoming || 0;
    target.regen += delta.regen || 0;
    target.initiative += delta.initiative || 0;
    target.shieldCap += delta.shieldCap || 0;
    target.withdrawBlock = target.withdrawBlock || Boolean(delta.withdrawBlock);
    return target;
  }

  function updateFleetTotals(state) {
    let hull = 0;
    let shield = 0;
    SHIP_CLASSES.forEach(cls => {
      const classState = state.classes[cls.key];
      if (!classState) return;
      hull += classState.hullRemaining;
      shield += classState.shieldRemaining;
      const computedCount = classState.base.hull > 0 ? classState.hullRemaining / classState.base.hull : 0;
      classState.currentCount = Math.min(classState.startCount, Math.max(0, computedCount));
    });
    state.totals.hullRemaining = hull;
    state.totals.shieldRemaining = shield;
    if (hull <= 1) {
      state.destroyed = true;
    }
  }

  function determineOutcome(alphaState, betaState) {
    if (alphaState.destroyed && betaState.destroyed) {
      return {
        label: 'Anomaly',
        detail: 'Both fleets are wrecked amid the chaos. Sensors report drifting hulks only.'
      };
    }
    if (alphaState.destroyed && !betaState.destroyed) {
      return {
        label: 'Collapse',
        detail: `${alphaState.name} collapses. ${betaState.name} holds the field.`
      };
    }
    if (!alphaState.destroyed && betaState.destroyed) {
      const hullRatio = alphaState.totals.hullRemaining / (alphaState.totals.initialHull || 1);
      return {
        label: hullRatio > 0.4 ? 'Victory' : 'Pyrrhic Victory',
        detail: `${alphaState.name} secures the battlespace${hullRatio > 0.4 ? '' : ', but the price was steep'}.`
      };
    }
    if (alphaState.withdrew && betaState.withdrew) {
      return {
        label: 'Stalemate',
        detail: 'Both fleets disengage; debris fields mark the contested zone.'
      };
    }
    if (alphaState.withdrew && !betaState.withdrew) {
      return {
        label: 'Collapse',
        detail: `${alphaState.name} breaks contact, ceding the objective to ${betaState.name}.`
      };
    }
    if (!alphaState.withdrew && betaState.withdrew) {
      return {
        label: 'Victory',
        detail: `${betaState.name} withdraws, leaving ${alphaState.name} in control.`
      };
    }
    const alphaRatio = alphaState.totals.hullRemaining / (alphaState.totals.initialHull || 1);
    const betaRatio = betaState.totals.hullRemaining / (betaState.totals.initialHull || 1);
    if (Math.abs(alphaRatio - betaRatio) < 0.08) {
      return {
        label: 'Stalemate',
        detail: 'Neither fleet could break the other; command calls the engagement inconclusive.'
      };
    }
    if (alphaRatio > betaRatio) {
      return {
        label: alphaRatio > 0.35 ? 'Victory' : 'Pyrrhic Victory',
        detail: `${alphaState.name} edges ahead after three rounds.`
      };
    }
    return {
      label: betaRatio > 0.35 ? 'Collapse' : 'Pyrrhic Collapse',
      detail: `${betaState.name} holds firmer footing when the smoke clears.`
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return '0';
    if (Math.abs(value) >= 1000) {
      return value.toFixed(0);
    }
    return value.toFixed(1);
  }

  function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
  }

  function buildClassBreakdown(state) {
    return SHIP_CLASSES.map(cls => {
      const classState = state.classes[cls.key];
      if (!classState) {
        return {
          name: cls.name,
          start: 0,
          remaining: 0,
          shields: 0
        };
      }
      const remaining = classState.currentCount;
      const start = classState.startCount;
      return {
        name: cls.name,
        start,
        remaining,
        shields: classState.shieldRemaining
      };
    });
  }

  function renderBattleReport(result) {
    const container = document.getElementById('simulator-report');
    if (!container) return;
    container.innerHTML = '';
    if (!result || result.error) {
      const message = document.createElement('div');
      message.className = 'battle-report__placeholder';
      message.textContent = result && result.error ? result.error : 'Configure both fleets, then launch the simulator to review a full after-action breakdown.';
      container.appendChild(message);
      return;
    }

    const header = document.createElement('header');
    header.className = 'battle-report__header';
    const outcomeHeading = document.createElement('h2');
    outcomeHeading.textContent = `Outcome: ${result.outcome.label}`;
    const outcomeDetail = document.createElement('p');
    outcomeDetail.textContent = result.outcome.detail;
    const theaterInfo = document.createElement('p');
    theaterInfo.className = 'battle-report__context';
    const theaterLabel = result.theater ? result.theater.label : 'Open Deep Space';
    theaterInfo.textContent = `Theater: ${theaterLabel}`;
    if (typeof result.seed === 'number') {
      theaterInfo.textContent += ` · Seed ${result.seed}`;
    }
    header.appendChild(outcomeHeading);
    header.appendChild(outcomeDetail);
    header.appendChild(theaterInfo);
    container.appendChild(header);

    const fleetsRow = document.createElement('div');
    fleetsRow.className = 'battle-report__fleets';

    ['alpha', 'beta'].forEach(key => {
      const state = result.fleets[key];
      const card = document.createElement('section');
      card.className = 'battle-report__fleet-card';
      const title = document.createElement('h3');
      title.textContent = state.name || (key === 'alpha' ? 'Fleet Alpha' : 'Fleet Beta');
      card.appendChild(title);
      if (state.commander) {
        const commander = document.createElement('p');
        commander.className = 'battle-report__commander';
        commander.textContent = `Commander: ${state.commander}`;
        card.appendChild(commander);
      }
      const statsList = document.createElement('ul');
      statsList.className = 'battle-report__stats';
      statsList.innerHTML = `
        <li><span>Morale</span><span>${Math.round(state.morale)}</span></li>
        <li><span>Hull remaining</span><span>${formatPercent(state.totals.hullRemaining / (state.totals.initialHull || 1))}</span></li>
        <li><span>Shields remaining</span><span>${formatNumber(state.totals.shieldRemaining)}</span></li>
        <li><span>Combined Arms</span><span>${state.combinedArms ? 'Active' : 'No'}</span></li>
        <li><span>Withdraw</span><span>${state.withdrew ? `Yes (R${state.withdrewRound})` : (state.withdrawIntent ? 'Attempted' : 'No')}</span></li>
      `;
      card.appendChild(statsList);

      const table = document.createElement('table');
      table.className = 'battle-report__table';
      table.innerHTML = `
        <thead>
          <tr><th>Class</th><th>Start</th><th>Remaining</th><th>Shields</th></tr>
        </thead>
      `;
      const tbody = document.createElement('tbody');
      buildClassBreakdown(state).forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${row.name}</td>
          <td>${row.start.toFixed(1)}</td>
          <td>${row.remaining.toFixed(2)}</td>
          <td>${formatNumber(row.shields)}</td>
        `;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      card.appendChild(table);
      fleetsRow.appendChild(card);
    });

    container.appendChild(fleetsRow);

    const timeline = document.createElement('section');
    timeline.className = 'battle-report__timeline';
    const timelineHeading = document.createElement('h3');
    timelineHeading.textContent = 'Round timeline';
    timeline.appendChild(timelineHeading);

    result.rounds.forEach(round => {
      const details = document.createElement('details');
      details.className = 'battle-report__round';
      const summary = document.createElement('summary');
      summary.textContent = `Round ${round.number}`;
      details.appendChild(summary);

      const orderHighlights = document.createElement('div');
      orderHighlights.className = 'battle-report__orders';
      if (round.orderHighlights.alpha.length) {
        const alphaOrders = document.createElement('p');
        alphaOrders.innerHTML = `<strong>${result.fleets.alpha.name}:</strong> ${round.orderHighlights.alpha.join('; ')}`;
        orderHighlights.appendChild(alphaOrders);
      }
      if (round.orderHighlights.beta.length) {
        const betaOrders = document.createElement('p');
        betaOrders.innerHTML = `<strong>${result.fleets.beta.name}:</strong> ${round.orderHighlights.beta.join('; ')}`;
        orderHighlights.appendChild(betaOrders);
      }
      if (orderHighlights.children.length) {
        details.appendChild(orderHighlights);
      }

      if (round.initiative) {
        const initiative = document.createElement('p');
        const orderLabel = round.initiative.order === 'alphaFirst'
          ? `${result.fleets.alpha.name} fires first`
          : `${result.fleets.beta.name} fires first`;
        initiative.textContent = `${orderLabel}.`; 
        details.appendChild(initiative);
      }

      const eventsList = document.createElement('ul');
      eventsList.className = 'battle-report__events';
      round.events.forEach(evt => {
        const li = document.createElement('li');
        li.textContent = evt;
        eventsList.appendChild(li);
      });
      details.appendChild(eventsList);

      timeline.appendChild(details);
    });

    container.appendChild(timeline);
  }

})();
