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
      description: '+Attack, −Evasion',
      modifiers: { damage: 0.12, incoming: 0.08, initiative: 6 }
    },
    phalanx: {
      key: 'phalanx',
      label: 'Phalanx',
      description: '+Defense, −Initiative',
      modifiers: { incoming: -0.12, regen: 0.2, initiative: -5 }
    },
    dispersed: {
      key: 'dispersed',
      label: 'Dispersed Line',
      description: '+Evasion, −Accuracy',
      modifiers: { incoming: -0.18, accuracy: -0.05, initiative: 4 }
    }
  };

  const TACTICS = {
    aggressive: {
      key: 'aggressive',
      label: 'Aggressive',
      description: '+15% damage (extra +10% R1), +10% incoming damage, −5% shield regen',
      modifiers: { damage: 0.15, incoming: 0.1, regen: -0.05 },
      roundOneDamage: 0.1
    },
    balanced: {
      key: 'balanced',
      label: 'Balanced',
      description: '+5% accuracy, −5% incoming damage, +8 morale end of round',
      modifiers: { damage: 0.05, incoming: -0.05 },
      moraleEnd: 8
    },
    defensive: {
      key: 'defensive',
      label: 'Defensive',
      description: '−15% damage, +30% shield regen, +10% shield cap, −5% incoming damage, +10% withdraw chance',
      modifiers: { damage: -0.15, regen: 0.3, shieldCap: 0.1, incoming: -0.05 },
      withdrawBonus: 0.1
    }
  };

  const COMMANDERS = [
    {
      key: 'solari',
      name: 'Commodore Solari',
      focus: 'Precision Volley',
      modifiers: { accuracy: 0.08, initiative: 2 },
      withdraw: -0.05
    },
    {
      key: 'akran',
      name: 'Admiral Akran',
      focus: 'Shield Doctrine',
      modifiers: { regen: 0.15, incoming: -0.05 }
    },
    {
      key: 'bast',
      name: 'Marshal Bast',
      focus: 'Breakthrough Gambit',
      modifiers: { damage: 0.12 },
      withdraw: 0.05
    }
  ];

  const COMMANDER_MAP = COMMANDERS.reduce((acc, commander) => {
    acc[commander.key] = commander;
    return acc;
  }, {});

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
      description: 'Lightning jams sensors (−accuracy) but shields surge.',
      effects: { accuracy: -0.08, regen: 0.2, variance: 0.04 }
    },
    asteroidBelt: {
      key: 'asteroidBelt',
      label: 'Asteroid Belt',
      description: 'Escorts dance through debris (reduced incoming); big hulls lose initiative.',
      effects: { incoming: -0.08, initiative: -3 }
    },
    stationYard: {
      key: 'stationYard',
      label: 'Station Yard / High Orbit',
      description: 'Defensive turrets offer supporting fire.',
      effects: { damage: 0.05 }
    },
    graveglass: {
      key: 'graveglass',
      label: 'Graveglass Veil',
      description: 'Ghost-lock interference hurts initiative and accuracy.',
      effects: { accuracy: -0.05, initiative: -5, variance: 0.05 }
    },
    temporalSlip: {
      key: 'temporalSlip',
      label: 'Temporal-Slip Corridor',
      description: 'Initiative swings wildly; retreats are hazardous.',
      effects: { variance: 0.08, initiativeVariance: 12, withdrawPenalty: 0.1 }
    }
  };

  const ORDER_LIBRARY = {
    corvette: [
      {
        key: 'flank',
        label: 'Flank',
        description: '+25% accuracy & +15% crit vs capitals; +20% damage taken.',
        effects: { accuracy: 0.25, crit: 0.15, incoming: 0.2, capitalDamage: 0.15 }
      },
      {
        key: 'evade',
        label: 'Evade Pattern',
        description: '+30% evasion, −30% damage.',
        effects: { incoming: -0.3, damage: -0.3 }
      },
      {
        key: 'overdrive',
        label: 'Overdrive',
        description: '+20 initiative, +15% damage, −10% accuracy, self-hull tick.',
        effects: { damage: 0.15, accuracy: -0.1, initiative: 20, selfHull: 0.1 }
      }
    ],
    destroyer: [
      {
        key: 'screen',
        label: 'Shield Screen',
        description: 'Redirect 25% hits from escorts to destroyers; +20% shield cap.',
        effects: { escortGuard: 0.25, shieldCap: 0.2 }
      },
      {
        key: 'lock',
        label: 'Target Lock',
        description: '+20% accuracy, +10% crit vs escorts.',
        effects: { accuracy: 0.2, crit: 0.1, escortDamage: 0.1 }
      },
      {
        key: 'pd',
        label: 'PD Overclock',
        description: '+50% missile intercept, −10% main damage.',
        effects: { damage: -0.1, regen: -0.05, pd: 0.5 }
      }
    ],
    heavyFrigate: [
      {
        key: 'suppress',
        label: 'Suppressive Volley',
        description: 'Enemy −15% accuracy & −10% evasion next round; frigate −10% damage.',
        effects: { damage: -0.1, enemyNext: { accuracy: -0.15, evasion: -0.1 } }
      },
      {
        key: 'focus',
        label: 'Focus Fire',
        description: '+25% concentrated firepower this round.',
        effects: { damage: 0.25, accuracy: 0.05 }
      },
      {
        key: 'brace',
        label: 'Brace Line',
        description: '+15% incoming damage reduction.',
        effects: { incoming: -0.15 }
      }
    ],
    cruiser: [
      {
        key: 'broadside',
        label: 'Broadside',
        description: '+35% damage output this round.',
        effects: { damage: 0.35 }
      },
      {
        key: 'lance',
        label: 'Lance Overcharge',
        description: '50% shield-pierce, +20% vs capitals; −20% shield cap next round.',
        effects: { shieldPierce: 0.5, capitalDamage: 0.2, selfNext: { shieldCap: -0.2 } }
      },
      {
        key: 'relay',
        label: 'Command Relay',
        description: 'Fleet +10% command sync & +10 morale; cruiser −20% damage.',
        effects: { damage: -0.2, fleet: { accuracy: 0.1, morale: 10 } }
      }
    ],
    battleship: [
      {
        key: 'salvo',
        label: 'Spinal Salvo',
        description: '+120% capital damage; −30% evasion next round.',
        effects: { capitalDamage: 1.2, selfNext: { evasion: -0.3 } }
      },
      {
        key: 'fortress',
        label: 'Fortress Posture',
        description: '+25% armor & PD, +20% shield regen; −20% initiative, −15% damage.',
        effects: { incoming: -0.25, regen: 0.2, damage: -0.15, initiative: -20 }
      },
      {
        key: 'beacon',
        label: 'Command Beacon',
        description: 'Fleet +10% accuracy & crit, escorts +10% evasion; battleship −50% damage.',
        effects: { damage: -0.5, fleet: { accuracy: 0.1, crit: 0.1, escortEvasion: 0.1 } }
      },
      {
        key: 'shock',
        label: 'Shock Barrage',
        description: 'Enemy −20% accuracy & −15% shield regen next round.',
        effects: { enemyNext: { accuracy: -0.2, regen: -0.15 } }
      }
    ],
    megaStation: [
      {
        key: 'bastion',
        label: 'Bastion Shield',
        description: 'Fleet +15% shield regen & +10% cap; station guns offline this round.',
        effects: { damage: -0.1, regen: 0.15, shieldCap: 0.1, fleet: { regen: 0.15, shieldCap: 0.1 } }
      },
      {
        key: 'cataclysm',
        label: 'Cataclysm Lance',
        description: 'Ignores 60% shields; −20% shield regen next round (max 2 uses).',
        effects: { shieldPierce: 0.6, capitalDamage: 0.25, selfNext: { regen: -0.2 } }
      },
      {
        key: 'gravWell',
        label: 'Grav-Well Snare',
        description: 'Enemy withdraw chance set to 0%; −10% initiative to enemies.',
        effects: { enemyNow: { withdrawBlock: true, initiative: -10 } }
      },
      {
        key: 'dock',
        label: 'Dock & Repair',
        description: 'Restore 12% hull & +300 shields to one friendly capital; PD offline.',
        effects: { repair: true, damage: -0.2 }
      }
    ]
  };

  const DEFAULT_COUNTS = {
    alpha: { corvette: 8, destroyer: 4, heavyFrigate: 3, cruiser: 2, battleship: 1, megaStation: 0 },
    beta: { corvette: 10, destroyer: 3, heavyFrigate: 2, cruiser: 2, battleship: 1, megaStation: 0 }
  };

  const DEFAULT_SETUP = {
    alpha: { formation: 'spearhead', tactic: 'aggressive', commander: 'solari' },
    beta: { formation: 'phalanx', tactic: 'defensive', commander: 'akran' }
  };

  function rng(seed) {
    let value = seed % 2147483647;
    if (value <= 0) {
      value += 2147483646;
    }
    return function () {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        if (value == null) return;
        if (key === 'class') {
          node.className = value;
        } else if (key === 'dataset') {
          Object.assign(node.dataset, value);
        } else if (key === 'for') {
          node.htmlFor = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
          node.addEventListener(key.substring(2), value);
        } else if (key === 'text') {
          node.textContent = value;
        } else {
          node.setAttribute(key, value);
        }
      });
    }
    children.filter(Boolean).forEach((child) => {
      if (typeof child === 'string') {
        node.appendChild(document.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    });
    return node;
  }

  function formatPercent(value) {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${Math.round(value * 100)}%`;
  }

  function formatNumber(value) {
    return value.toLocaleString('en-US');
  }

  function buildSelect(options, placeholder) {
    const select = el('select', { class: 'sim-input' });
    if (placeholder) {
      select.appendChild(el('option', { value: '' }, placeholder));
    }
    options.forEach((option) => {
      select.appendChild(el('option', { value: option.value, text: option.label }));
    });
    return select;
  }

  function renderFleetConfig(container, fleetKey) {
    const defaults = DEFAULT_SETUP[fleetKey];
    const counts = DEFAULT_COUNTS[fleetKey];

    const nameField = el(
      'label',
      { class: 'sim-field' },
      el('span', { class: 'sim-field__label', text: 'Callsign' }),
      el('input', {
        class: 'sim-input',
        name: `${fleetKey}-name`,
        type: 'text',
        placeholder: fleetKey === 'alpha' ? 'Fleet Alpha' : 'Fleet Beta'
      })
    );

    const commanderSelect = buildSelect(
      COMMANDERS.map((commander) => ({ value: commander.key, label: `${commander.name} — ${commander.focus}` })),
      'Select commander'
    );
    commanderSelect.name = `${fleetKey}-commander`;
    commanderSelect.value = defaults.commander;

    const formationSelect = buildSelect(
      Object.values(FORMATIONS).map((formation) => ({ value: formation.key, label: formation.label })),
      'Select formation'
    );
    formationSelect.name = `${fleetKey}-formation`;
    formationSelect.value = defaults.formation;

    const tacticSelect = buildSelect(
      Object.values(TACTICS).map((tactic) => ({ value: tactic.key, label: tactic.label })),
      'Select tactic'
    );
    tacticSelect.name = `${fleetKey}-tactic`;
    tacticSelect.value = defaults.tactic;

    const volleyToggle = el(
      'label',
      { class: 'sim-toggle' },
      el('input', { type: 'checkbox', name: `${fleetKey}-volley` }),
      el('span', { text: 'Declare Volley Coordination during Detection (once per battle)' })
    );

    const withdrawToggle = el(
      'label',
      { class: 'sim-toggle' },
      el('input', { type: 'checkbox', name: `${fleetKey}-withdraw`, checked: true }),
      el('span', { text: 'Attempt withdrawal if morale collapses' })
    );

    const rosterTable = el('table', { class: 'sim-roster' });
    rosterTable.appendChild(
      el(
        'thead',
        null,
        el(
          'tr',
          null,
          el('th', null, 'Class'),
          el('th', null, 'Count'),
          el('th', null, 'Base Stats')
        )
      )
    );

    const rosterBody = el('tbody');
    SHIP_CLASSES.forEach((ship) => {
      const input = el('input', {
        type: 'number',
        min: 0,
        max: ship.key === 'megaStation' ? 1 : 99,
        step: 1,
        value: counts[ship.key],
        name: `${fleetKey}-count-${ship.key}`,
        class: 'sim-input'
      });

      const statSummary = `${ship.attack} ATK / ${ship.defense} DEF / ${ship.hull} HP / ${ship.speed} SPD / ${ship.shieldLevel}`;

      rosterBody.appendChild(
        el(
          'tr',
          null,
          el('td', null, ship.name),
          el('td', null, input),
          el('td', { class: 'sim-roster__stats' }, statSummary)
        )
      );
    });
    rosterTable.appendChild(rosterBody);

    const ordersWrapper = el('div', { class: 'sim-orders' });
    ordersWrapper.appendChild(el('h4', { text: 'Class orders per round' }));

    SHIP_CLASSES.forEach((ship) => {
      const classSection = el('section', { class: 'sim-orders__class' });
      classSection.appendChild(el('h5', { text: ship.name }));

      const options = ORDER_LIBRARY[ship.key] || [];
      if (!options.length) {
        classSection.appendChild(el('p', { class: 'sim-orders__note', text: 'No special orders available.' }));
      }

      for (let round = 1; round <= ROUND_COUNT; round += 1) {
        const select = buildSelect(
          options.map((order) => ({ value: order.key, label: order.label })),
          'Standard engagement'
        );
        select.name = `${fleetKey}-order-${ship.key}-r${round}`;
        classSection.appendChild(
          el(
            'label',
            { class: 'sim-field sim-field--inline' },
            el('span', { class: 'sim-field__label', text: `Round ${round}` }),
            select
          )
        );
      }

      if (options.length) {
        const optionList = el('ul', { class: 'sim-order-descriptions' });
        options.forEach((order) => {
          optionList.appendChild(
            el('li', null, el('strong', null, `${order.label}: `), order.description)
          );
        });
        classSection.appendChild(optionList);
      }

      ordersWrapper.appendChild(classSection);
    });

    container.appendChild(nameField);
    container.appendChild(
      el(
        'div',
        { class: 'sim-grid' },
        el(
          'label',
          { class: 'sim-field' },
          el('span', { class: 'sim-field__label', text: 'Commander' }),
          commanderSelect
        ),
        el(
          'label',
          { class: 'sim-field' },
          el('span', { class: 'sim-field__label', text: 'Formation' }),
          formationSelect
        ),
        el(
          'label',
          { class: 'sim-field' },
          el('span', { class: 'sim-field__label', text: 'Tactic' }),
          tacticSelect
        )
      )
    );
    container.appendChild(volleyToggle);
    container.appendChild(withdrawToggle);
    container.appendChild(rosterTable);
    container.appendChild(ordersWrapper);
  }

  function populateBattleTheater(select) {
    Object.values(THEATERS).forEach((theater) => {
      const option = el('option', { value: theater.key, text: theater.label });
      option.dataset.description = theater.description;
      select.appendChild(option);
    });
    select.value = 'deepSpace';
  }

  function gatherFleetConfig(form, fleetKey) {
    const formation = form.elements[`${fleetKey}-formation`].value;
    const tactic = form.elements[`${fleetKey}-tactic`].value;
    const commander = form.elements[`${fleetKey}-commander`].value;

    const counts = {};
    SHIP_CLASSES.forEach((ship) => {
      const value = parseInt(form.elements[`${fleetKey}-count-${ship.key}`].value, 10);
      counts[ship.key] = Number.isFinite(value) ? Math.max(0, value) : 0;
    });

    const orders = {};
    SHIP_CLASSES.forEach((ship) => {
      const shipOrders = [];
      for (let round = 1; round <= ROUND_COUNT; round += 1) {
        const field = form.elements[`${fleetKey}-order-${ship.key}-r${round}`];
        shipOrders.push(field ? field.value : '');
      }
      orders[ship.key] = shipOrders;
    });

    return {
      key: fleetKey,
      name: form.elements[`${fleetKey}-name`].value.trim() || (fleetKey === 'alpha' ? 'Fleet Alpha' : 'Fleet Beta'),
      commander,
      formation,
      tactic,
      volley: form.elements[`${fleetKey}-volley`].checked,
      withdraw: form.elements[`${fleetKey}-withdraw`].checked,
      counts,
      orders
    };
  }

  function validateConfig(alpha, beta) {
    const alphaTotal = Object.values(alpha.counts).reduce((sum, count) => sum + count, 0);
    const betaTotal = Object.values(beta.counts).reduce((sum, count) => sum + count, 0);

    const errors = [];
    if (!alphaTotal) {
      errors.push('Fleet Alpha must field at least one ship.');
    }
    if (!betaTotal) {
      errors.push('Fleet Beta must field at least one ship.');
    }
    if (!alpha.commander || !beta.commander) {
      errors.push('Both fleets require a commander.');
    }
    if (!alpha.formation || !beta.formation) {
      errors.push('Choose formations for both fleets.');
    }
    if (!alpha.tactic || !beta.tactic) {
      errors.push('Choose tactics for both fleets.');
    }
    return errors;
  }

  function buildFleetState(config) {
    const formation = FORMATIONS[config.formation];
    const tactic = TACTICS[config.tactic];
    const commander = COMMANDER_MAP[config.commander];

    const units = {};
    SHIP_CLASSES.forEach((ship) => {
      const count = config.counts[ship.key];
      units[ship.key] = {
        ship,
        count,
        initial: count,
        shields: ship.shieldCap * count,
        hull: ship.hull * count,
        lost: 0,
        lastRoundLosses: 0
      };
    });

    return {
      key: config.key,
      name: config.name,
      commander,
      formation,
      tactic,
      volleyAvailable: config.volley,
      withdrawEnabled: config.withdraw,
      counts: config.counts,
      orders: config.orders,
      morale: 100,
      commandSync: 100,
      initiativeDrift: 0,
      volleyUsed: false,
      combinedArms: hasCombinedArms(config.counts),
      units,
      reports: [],
      withdrawAttempted: false,
      withdrew: false
    };
  }

  function hasCombinedArms(counts) {
    return SHIP_CLASSES.every((ship) => counts[ship.key] > 0);
  }

  function aggregateFleetPower(fleet) {
    let totalAttack = 0;
    let totalDefense = 0;
    let totalHull = 0;
    let totalSpeed = 0;
    let shipCount = 0;
    SHIP_CLASSES.forEach((ship) => {
      const unit = fleet.units[ship.key];
      if (unit.hull <= 0) return;
      const effectiveCount = ship.hull ? unit.hull / ship.hull : unit.count;
      totalAttack += ship.attack * effectiveCount;
      totalDefense += ship.defense * effectiveCount;
      totalHull += unit.hull;
      totalSpeed += ship.speed * effectiveCount;
      shipCount += effectiveCount;
    });

    return {
      attack: totalAttack,
      defense: totalDefense,
      hull: totalHull,
      speed: shipCount ? totalSpeed / shipCount : 0
    };
  }

  function computeRoundModifiers(fleet, roundIndex, theaterEffects, random, pendingEffects) {
    const base = {
      damage: 0,
      incoming: 0,
      accuracy: 0,
      regen: 0,
      shieldCap: 0,
      initiative: 0,
      crit: 0,
      escortGuard: 0,
      withdraw: 0,
      shieldPierce: 0,
      volley: 0,
      log: []
    };

    if (fleet.formation) {
      Object.entries(fleet.formation.modifiers || {}).forEach(([key, value]) => {
        base[key] = (base[key] || 0) + value;
      });
      base.log.push(`${fleet.formation.label} formation modifiers applied.`);
    }

    if (fleet.tactic) {
      Object.entries(fleet.tactic.modifiers || {}).forEach(([key, value]) => {
        base[key] = (base[key] || 0) + value;
      });
      if (roundIndex === 0 && fleet.tactic.roundOneDamage) {
        base.damage += fleet.tactic.roundOneDamage;
      }
      if (fleet.tactic.withdrawBonus) {
        base.withdraw += fleet.tactic.withdrawBonus;
      }
      base.log.push(`${fleet.tactic.label} tactic modifiers applied.`);
    }

    if (fleet.commander) {
      Object.entries(fleet.commander.modifiers || {}).forEach(([key, value]) => {
        base[key] = (base[key] || 0) + value;
      });
      if (fleet.commander.withdraw) {
        base.withdraw += fleet.commander.withdraw;
      }
      base.log.push(`${fleet.commander.name} command focus active.`);
    }

    if (fleet.combinedArms) {
      base.commandSyncBonus = 0.1;
      base.incoming += -0.1;
      base.log.push('Combined-arms bonus: +10% command sync, −10% incoming damage.');
    }

    if (fleet.volleyAvailable && !fleet.volleyUsed) {
      base.volley = 0.15;
      base.log.push('Volley Coordination declared (+15% fleet damage this round).');
      fleet.volleyUsed = true;
    }

    if (theaterEffects.damage) base.damage += theaterEffects.damage;
    if (theaterEffects.accuracy) base.accuracy += theaterEffects.accuracy;
    if (theaterEffects.regen) base.regen += theaterEffects.regen;
    if (theaterEffects.initiative) base.initiative += theaterEffects.initiative;
    if (theaterEffects.initiativeVariance) {
      base.initiative += (random() - 0.5) * theaterEffects.initiativeVariance;
    }

    if (pendingEffects) {
      Object.entries(pendingEffects).forEach(([key, value]) => {
        base[key] = (base[key] || 0) + value;
        if (key === 'withdrawBlock' && value) {
          base.log.push('Withdraw chance suppressed this round.');
        }
      });
    }

    const accuracyNoise = theaterEffects.variance ? (random() - 0.5) * theaterEffects.variance : 0;
    base.accuracy += accuracyNoise;

    return base;
  }

  function applyOrders(fleet, opponent, roundIndex, baseModifiers, random, roundLog) {
    const nextRoundEffects = {};
    const selfNextEffects = {};
    const enemyNowEffects = {};

    SHIP_CLASSES.forEach((ship) => {
      const orderKey = fleet.orders[ship.key][roundIndex];
      if (!orderKey) return;
      const order = (ORDER_LIBRARY[ship.key] || []).find((item) => item.key === orderKey);
      if (!order) return;

      Object.entries(order.effects || {}).forEach(([key, value]) => {
        if (key === 'enemyNext') {
          Object.entries(value).forEach(([effectKey, effectValue]) => {
            nextRoundEffects[effectKey] = (nextRoundEffects[effectKey] || 0) + effectValue;
          });
        } else if (key === 'selfNext') {
          Object.entries(value).forEach(([effectKey, effectValue]) => {
            selfNextEffects[effectKey] = (selfNextEffects[effectKey] || 0) + effectValue;
          });
        } else if (key === 'enemyNow') {
          Object.entries(value).forEach(([effectKey, effectValue]) => {
            enemyNowEffects[effectKey] = (enemyNowEffects[effectKey] || 0) + effectValue;
          });
        } else if (key === 'fleet') {
          Object.entries(value).forEach(([effectKey, effectValue]) => {
            if (effectKey === 'morale') {
              fleet.morale = Math.min(100, fleet.morale + effectValue);
            } else {
              baseModifiers[effectKey] = (baseModifiers[effectKey] || 0) + effectValue;
            }
          });
        } else {
          baseModifiers[key] = (baseModifiers[key] || 0) + value;
        }
      });

      if (order.effects && order.effects.selfHull) {
        const unit = fleet.units[ship.key];
        if (unit.count > 0) {
          const selfDamage = unit.ship.hull * unit.count * order.effects.selfHull * (0.5 + random());
          unit.hull = Math.max(0, unit.hull - selfDamage);
          roundLog.push(`${fleet.name}'s ${ship.name} suffer ${Math.round(selfDamage)} self-inflicted hull damage from ${order.label}.`);
        }
      }

      if (order.effects && order.effects.repair) {
        const repairTarget = findRepairTarget(fleet.units);
        if (repairTarget) {
          const restoreHull = repairTarget.ship.hull * repairTarget.count * 0.12;
          const restoreShield = 300 * repairTarget.count;
          repairTarget.hull = Math.min(repairTarget.ship.hull * repairTarget.count, repairTarget.hull + restoreHull);
          repairTarget.shields += restoreShield;
          roundLog.push(`${fleet.name}'s ${ship.name} perform Dock & Repair, restoring ${repairTarget.ship.name}.`);
        }
      }

      roundLog.push(`${fleet.name} — ${ship.name}: ${order.label} executed.`);
    });

    return { nextRoundEffects, selfNextEffects, enemyNowEffects };
  }

  function findRepairTarget(units) {
    const candidates = SHIP_CLASSES.filter((cls) => cls.role === 'capital').map((cls) => units[cls.key]);
    return candidates.reduce((selected, unit) => {
      if (!unit || !unit.count) return selected;
      const maxHull = unit.ship.hull * unit.count;
      const missingHull = maxHull - unit.hull;
      if (!selected) return missingHull > 0 ? unit : selected;
      const selectedMissing = selected.ship.hull * selected.count - selected.hull;
      if (missingHull > selectedMissing) return unit;
      return selected;
    }, null);
  }

  function resolveDamagePhase(attacker, defender, modifiers, defenderModifiers, theaterEffects, random, roundLog) {
    const fleetTotals = aggregateFleetPower(attacker);
    let attackOutput = fleetTotals.attack;
    attackOutput *= 1 + (modifiers.damage || 0) + (modifiers.volley || 0);

    const accuracy = 1 + (modifiers.accuracy || 0);
    const critChance = Math.max(0, 0.05 + (modifiers.crit || 0));
    const critBonus = 0.5;
    const critMultiplier = 1 + (random() < critChance ? critBonus : 0);

    attackOutput *= accuracy * critMultiplier;

    const opponentTotals = aggregateFleetPower(defender);
    const defenseFactor = opponentTotals.defense > 0 ? opponentTotals.defense / (opponentTotals.defense + 4000) : 0;
    const baseDamage = attackOutput * (1 - defenseFactor);

    const damageLog = [];
    distributeDamage(defender, baseDamage, modifiers, defenderModifiers, theaterEffects, random, damageLog);

    roundLog.push(`${attacker.name} inflict approximately ${Math.round(baseDamage)} effective damage.`);
    damageLog.forEach((entry) => roundLog.push(entry));
  }

  function distributeDamage(defender, totalDamage, attackerModifiers, defenderModifiers, theaterEffects, random, log) {
    const shieldPierce = Math.max(0, attackerModifiers.shieldPierce || 0);
    const incomingMod = Math.max(0.2, 1 + (defenderModifiers.incoming || 0));
    const effectiveDamage = totalDamage * incomingMod;

    let remainingDamage = effectiveDamage;
    const orderedTargets = SHIP_CLASSES.slice().sort((a, b) => {
      const aHull = defender.units[a.key].ship.hull;
      const bHull = defender.units[b.key].ship.hull;
      return bHull - aHull;
    });

    orderedTargets.forEach((ship) => {
      if (remainingDamage <= 0) return;
      const unit = defender.units[ship.key];
      if (!unit.count) return;

      const share = ship.role === 'escort' ? 0.16 : ship.role === 'line' ? 0.22 : ship.role === 'capital' ? 0.3 : 0.12;
      let allocation = remainingDamage * share;
      allocation *= 1 + (ship.role === 'capital' ? (attackerModifiers.capitalDamage || 0) : 0);
      allocation *= 1 + (ship.role === 'escort' ? (attackerModifiers.escortDamage || 0) : 0);
      allocation *= 1 + (random() - 0.5) * 0.2;

      if (ship.role === 'escort' && defenderModifiers.escortGuard) {
        const redirect = allocation * defenderModifiers.escortGuard;
        const destroyerUnit = defender.units.destroyer;
        if (destroyerUnit && destroyerUnit.count) {
          applyDamageToUnit(destroyerUnit, redirect, shieldPierce, log, defender.name, 'Destroyer');
          allocation -= redirect;
        }
      }

      if (ship.role === 'escort' && defenderModifiers.escortEvasion) {
        allocation *= Math.max(0.1, 1 - defenderModifiers.escortEvasion);
      }

      applyDamageToUnit(unit, allocation, shieldPierce, log, defender.name, ship.name);

      remainingDamage -= allocation;
    });
  }

  function applyDamageToUnit(unit, allocation, shieldPierce, log, fleetName, shipName) {
    if (allocation <= 0) return;
    const shieldDamage = allocation * (1 - shieldPierce);
    const pierceDamage = allocation - shieldDamage;

    const shieldsAbsorbed = Math.min(unit.shields, shieldDamage);
    unit.shields -= shieldsAbsorbed;
    const spill = allocation - shieldsAbsorbed;
    unit.hull = Math.max(0, unit.hull - (spill + pierceDamage));

    const hullLost = spill + pierceDamage;
    const totalHullPerShip = unit.ship.hull;
    const survivors = unit.hull > 0 ? Math.ceil(unit.hull / totalHullPerShip) : 0;
    const destroyed = Math.max(0, unit.count - survivors);
    if (destroyed > 0) {
      unit.lost += destroyed;
      unit.lastRoundLosses = destroyed;
    }
    unit.count = survivors;
    unit.hull = Math.min(unit.hull, totalHullPerShip * unit.count);

    log.push(
      `${fleetName}'s ${shipName} absorb ${Math.round(shieldsAbsorbed)} shield / ${Math.round(hullLost)} hull damage.`
    );
  }

  function regenerateShields(fleet, modifiers) {
    SHIP_CLASSES.forEach((ship) => {
      const unit = fleet.units[ship.key];
      if (!unit.count || ship.shieldCap === 0) return;
      const maxShields = ship.shieldCap * unit.count * (1 + (modifiers.shieldCap || 0));
      const regenRate = ship.shieldRegen * unit.count * (1 + (modifiers.regen || 0));
      unit.shields = Math.min(maxShields, unit.shields + regenRate);
    });
  }

  function updateMorale(fleet) {
    let losses = 0;
    let total = 0;
    SHIP_CLASSES.forEach((ship) => {
      const unit = fleet.units[ship.key];
      total += unit.count + unit.lost;
      losses += unit.lost;
    });
    const lossRatio = total > 0 ? losses / total : 1;
    const moraleDrop = lossRatio * 60;
    fleet.morale = Math.max(0, Math.min(100, fleet.morale - moraleDrop));
    return { lossRatio, moraleDrop };
  }

  function attemptWithdraw(fleet, opponent, modifiers, theaterEffects, random, roundLog) {
    if (!fleet.withdrawEnabled || fleet.withdrawAttempted || theaterEffects.withdrawPenalty === 1) {
      return false;
    }

    const hullRemaining = SHIP_CLASSES.reduce((sum, ship) => sum + fleet.units[ship.key].hull, 0);
    const hullMax = SHIP_CLASSES.reduce(
      (sum, ship) => sum + ship.hull * (fleet.units[ship.key].count + fleet.units[ship.key].lost),
      0
    );
    const hullRatio = hullMax > 0 ? hullRemaining / hullMax : 0;

    if (fleet.morale > 35 && hullRatio > 0.35) {
      return false;
    }

    const baseChance = 0.35;
    let chance = baseChance + (modifiers.withdraw || 0);
    if (theaterEffects.withdrawPenalty) {
      chance -= theaterEffects.withdrawPenalty;
    }
    if (opponent.formation && opponent.formation.key === 'spearhead') {
      chance -= 0.05;
    }
    if (opponent.aggregate && opponent.aggregate.speed > (fleet.aggregate ? fleet.aggregate.speed : 0)) {
      chance -= 0.05;
    }

    if (fleet.units.megaStation && fleet.units.megaStation.count > 0) {
      chance = 0;
    }

    chance = Math.max(0, Math.min(0.95, chance));
    const roll = random();
    fleet.withdrawAttempted = true;
    const success = roll < chance && !modifiers.withdrawBlock;
    if (success) {
      fleet.withdrew = true;
      roundLog.push(`${fleet.name} disengage successfully (withdraw roll ${Math.round(chance * 100)}% vs ${Math.round(roll * 100)}%).`);
    } else {
      roundLog.push(`${fleet.name} attempt to withdraw but are intercepted.`);
    }
    return success;
  }

  function concludeBattle(alpha, beta) {
    const alphaHull = totalFleetHull(alpha);
    const betaHull = totalFleetHull(beta);

    if (alpha.withdrew && beta.withdrew) {
      return 'Stalemate: both fleets disengaged.';
    }
    if (alpha.withdrew) {
      return betaHull > 0 ? `${beta.name} secure the field as ${alpha.name} withdraw.` : 'Both fleets crippled.';
    }
    if (beta.withdrew) {
      return alphaHull > 0 ? `${alpha.name} hold the battlespace after ${beta.name} withdraw.` : 'Both fleets crippled.';
    }
    if (alphaHull <= 0 && betaHull <= 0) {
      return 'Collapse: mutual destruction leaves only debris fields.';
    }
    if (alphaHull <= 0) {
      return `${beta.name} achieve victory; ${alpha.name} collapse.`;
    }
    if (betaHull <= 0) {
      return `${alpha.name} achieve victory; ${beta.name} collapse.`;
    }

    const ratio = alphaHull / betaHull;
    if (ratio > 1.2) {
      return `${alpha.name} claim a victory after three rounds.`;
    }
    if (ratio < 0.8) {
      return `${beta.name} claim a victory after three rounds.`;
    }
    return 'Pyrrhic stalemate — neither fleet secures decisive advantage.';
  }

  function totalFleetHull(fleet) {
    return SHIP_CLASSES.reduce((sum, ship) => sum + fleet.units[ship.key].hull, 0);
  }

  function renderReport(container, result, rounds, alpha, beta, theater) {
    container.innerHTML = '';

    container.appendChild(
      el('article', { class: 'battle-report__summary' }, el('h3', null, result), el('p', null, theater.description))
    );

    rounds.forEach((round, index) => {
      const card = el('article', { class: 'battle-report__round' });
      card.appendChild(el('h4', null, `Round ${index + 1}`));
      const list = el('ul');
      round.events.forEach((entry) => {
        list.appendChild(el('li', null, entry));
      });
      card.appendChild(list);
      container.appendChild(card);
    });

    container.appendChild(renderFleetTotals(alpha));
    container.appendChild(renderFleetTotals(beta));
  }

  function renderFleetTotals(fleet) {
    const section = el('section', { class: 'battle-report__fleet' });
    section.appendChild(el('h4', null, fleet.name));
    const morale = el('p', null, `Morale: ${Math.round(fleet.morale)} / 100`);
    section.appendChild(morale);
    const list = el('ul', { class: 'battle-report__losses' });
    SHIP_CLASSES.forEach((ship) => {
      const unit = fleet.units[ship.key];
      const destroyed = Math.max(0, (unit.initial || 0) - unit.count);
      const remainingHull = Math.max(0, unit.hull);
      const totalHull = ship.hull * (unit.initial || 0);
      const hullPercent = totalHull ? Math.round((remainingHull / totalHull) * 100) : 0;
      list.appendChild(
        el('li', null, `${ship.name}: ${destroyed} lost (${hullPercent}% hull remaining)`)
      );
    });
    section.appendChild(list);
    return section;
  }

  function runSimulation(alphaConfig, betaConfig, theaterKey, seed) {
    const random = rng(seed || Math.floor(Math.random() * DEFAULT_SEED_MAX) + 1);
    const theater = THEATERS[theaterKey] || THEATERS.deepSpace;

    const alpha = buildFleetState(alphaConfig);
    const beta = buildFleetState(betaConfig);

    const rounds = [];
    let pendingAlpha = null;
    let pendingBeta = null;
    let selfNextAlpha = null;
    let selfNextBeta = null;

    for (let roundIndex = 0; roundIndex < ROUND_COUNT; roundIndex += 1) {
      if (alpha.withdrew || beta.withdrew) break;

      const roundLog = [];
      const alphaModifiers = computeRoundModifiers(alpha, roundIndex, theater.effects, random, pendingAlpha);
      const betaModifiers = computeRoundModifiers(beta, roundIndex, theater.effects, random, pendingBeta);

      if (selfNextAlpha) {
        Object.entries(selfNextAlpha).forEach(([key, value]) => {
          alphaModifiers[key] = (alphaModifiers[key] || 0) + value;
        });
        selfNextAlpha = null;
      }
      if (selfNextBeta) {
        Object.entries(selfNextBeta).forEach(([key, value]) => {
          betaModifiers[key] = (betaModifiers[key] || 0) + value;
        });
        selfNextBeta = null;
      }

      const alphaOrderEffects = applyOrders(alpha, beta, roundIndex, alphaModifiers, random, roundLog);
      const betaOrderEffects = applyOrders(beta, alpha, roundIndex, betaModifiers, random, roundLog);

      pendingAlpha = betaOrderEffects.nextRoundEffects;
      pendingBeta = alphaOrderEffects.nextRoundEffects;
      if (alphaOrderEffects.selfNextEffects) {
        selfNextAlpha = alphaOrderEffects.selfNextEffects;
      }
      if (betaOrderEffects.selfNextEffects) {
        selfNextBeta = betaOrderEffects.selfNextEffects;
      }

      if (alphaOrderEffects.enemyNowEffects) {
        Object.entries(alphaOrderEffects.enemyNowEffects).forEach(([key, value]) => {
          betaModifiers[key] = (betaModifiers[key] || 0) + value;
        });
      }
      if (betaOrderEffects.enemyNowEffects) {
        Object.entries(betaOrderEffects.enemyNowEffects).forEach(([key, value]) => {
          alphaModifiers[key] = (alphaModifiers[key] || 0) + value;
        });
      }

      regenerateShields(alpha, alphaModifiers);
      regenerateShields(beta, betaModifiers);

      const alphaPre = aggregateFleetPower(alpha);
      const betaPre = aggregateFleetPower(beta);
      const alphaInitiative = (alphaPre.speed || 0) + (alphaModifiers.initiative || 0) + (random() - 0.5);
      const betaInitiative = (betaPre.speed || 0) + (betaModifiers.initiative || 0) + (random() - 0.5);

      const firstStrike = alphaInitiative >= betaInitiative
        ? { attacker: alpha, defender: beta, atkModifiers: alphaModifiers, defModifiers: betaModifiers }
        : { attacker: beta, defender: alpha, atkModifiers: betaModifiers, defModifiers: alphaModifiers };
      const secondStrike = firstStrike.attacker === alpha
        ? { attacker: beta, defender: alpha, atkModifiers: betaModifiers, defModifiers: alphaModifiers }
        : { attacker: alpha, defender: beta, atkModifiers: alphaModifiers, defModifiers: betaModifiers };

      roundLog.push(
        `${firstStrike.attacker.name} seize the initiative over ${secondStrike.attacker.name}.`
      );

      resolveDamagePhase(
        firstStrike.attacker,
        firstStrike.defender,
        firstStrike.atkModifiers,
        firstStrike.defModifiers,
        theater.effects,
        random,
        roundLog
      );
      resolveDamagePhase(
        secondStrike.attacker,
        secondStrike.defender,
        secondStrike.atkModifiers,
        secondStrike.defModifiers,
        theater.effects,
        random,
        roundLog
      );

      const alphaMorale = updateMorale(alpha);
      const betaMorale = updateMorale(beta);
      roundLog.push(`${alpha.name} morale drops by ${Math.round(alphaMorale.moraleDrop)}.`);
      roundLog.push(`${beta.name} morale drops by ${Math.round(betaMorale.moraleDrop)}.`);

      if (alpha.tactic && alpha.tactic.moraleEnd) {
        alpha.morale = Math.min(100, alpha.morale + alpha.tactic.moraleEnd);
        roundLog.push(`${alpha.name} regain ${alpha.tactic.moraleEnd} morale from ${alpha.tactic.label}.`);
      }
      if (beta.tactic && beta.tactic.moraleEnd) {
        beta.morale = Math.min(100, beta.morale + beta.tactic.moraleEnd);
        roundLog.push(`${beta.name} regain ${beta.tactic.moraleEnd} morale from ${beta.tactic.label}.`);
      }

      alpha.aggregate = aggregateFleetPower(alpha);
      beta.aggregate = aggregateFleetPower(beta);

      const alphaWithdraw = attemptWithdraw(alpha, beta, alphaModifiers, theater.effects, random, roundLog);
      const betaWithdraw = attemptWithdraw(beta, alpha, betaModifiers, theater.effects, random, roundLog);

      rounds.push({
        events: roundLog
      });

      if (alphaWithdraw || betaWithdraw) {
        break;
      }
    }

    const result = concludeBattle(alpha, beta);
    return { result, rounds, theater, alpha, beta };
  }

  function displayErrors(container, errors) {
    container.innerHTML = '';
    const list = el('ul', { class: 'battle-report__errors' });
    errors.forEach((message) => {
      list.appendChild(el('li', null, message));
    });
    container.appendChild(list);
  }

  function initSimulator() {
    const fleetContainers = document.querySelectorAll('.js-fleet-config');
    fleetContainers.forEach((container) => {
      const fleetKey = container.dataset.fleet;
      renderFleetConfig(container, fleetKey);
    });

    const theaterSelect = document.getElementById('battle-theater');
    populateBattleTheater(theaterSelect);

    const theaterHint = el('p', { class: 'sim-field__hint', id: 'battle-theater-hint' });
    theaterSelect.addEventListener('change', () => {
      const option = theaterSelect.selectedOptions[0];
      theaterHint.textContent = option ? option.dataset.description : '';
    });
    theaterSelect.parentElement.appendChild(theaterHint);
    theaterSelect.setAttribute('aria-describedby', 'battle-theater-hint');
    theaterSelect.dispatchEvent(new Event('change'));

    const form = document.getElementById('simulator-form');
    const report = document.getElementById('simulator-report');
    const runButton = document.getElementById('run-simulation');
    const resetButton = document.getElementById('reset-simulation');

    runButton.addEventListener('click', () => {
      const alpha = gatherFleetConfig(form, 'alpha');
      const beta = gatherFleetConfig(form, 'beta');
      const errors = validateConfig(alpha, beta);
      if (errors.length) {
        displayErrors(report, errors);
        return;
      }
      const varianceSeed = form.elements['variance-seed'].value;
      const seed = varianceSeed ? parseInt(varianceSeed, 10) : Math.floor(Math.random() * DEFAULT_SEED_MAX);
      const { result, rounds, theater, alpha: alphaState, beta: betaState } = runSimulation(
        alpha,
        beta,
        theaterSelect.value,
        seed
      );
      renderReport(report, result, rounds, alphaState, betaState, theater);
    });

    resetButton.addEventListener('click', () => {
      report.innerHTML = '';
      report.appendChild(
        el('div', { class: 'battle-report__placeholder' }, 'Configure both fleets, then launch the simulator to review a full after-action breakdown.')
      );
    });
  }

  document.addEventListener('DOMContentLoaded', initSimulator);
})();
