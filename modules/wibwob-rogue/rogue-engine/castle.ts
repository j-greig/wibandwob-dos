import type { Tile, Entity, Interactable, GameState } from "./types.js";
import { tileKey } from "./worldgen.js";
import { SCRAMBLE_SPRITE } from "./sprites.js";

function st(tiles: Map<string, Tile>, x: number, y: number, t: Partial<Tile>) {
  tiles.set(tileKey(x, y), { x, y, glyph: '#', walkable: false, transparent: false, region: 'keep', label: 'Stone Wall', ...t } as Tile);
}

export function buildCastleInterior(seed: number) {
  const WIDTH = 288;
  const HEIGHT = 72;
  const centerX = 144;
  const bounds = { minX: 108, maxX: 180, minY: 2, maxY: 70 };

  const tiles = new Map<string, Tile>();
  const structures: Entity[] = [];
  const monsters: Entity[] = [];
  const interactables: Interactable[] = [];

  function addItem(state: GameState, type: string) {
    const existing = state.inventory.find(i => i.type === type);
    if (existing) {
      existing.quantity++;
    } else {
      state.inventory.push({ type, quantity: 1 });
    }
  }

  function hasItem(state: GameState, type: string): boolean {
    return state.inventory.some(i => i.type === type && i.quantity > 0);
  }

  function removeItem(state: GameState, type: string) {
    const item = state.inventory.find(i => i.type === type);
    if (item) {
      item.quantity--;
      if (item.quantity <= 0) {
        state.inventory = state.inventory.filter(i => i !== item);
      }
    }
  }

  function collectSigil(state: GameState, symbol: string, name: string) {
    if (state.sigils.has(symbol)) {
      state.log.push('You already carry this sigil.');
      return;
    }
    state.sigils.add(symbol);
    state.log.push(`You obtain the ${name} ${symbol}.`);
  }

  function addLog(state: GameState, msg: string) {
    state.log.push(msg);
    if (state.log.length > 20) state.log.shift();
  }

  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      st(tiles, x, y, {});
    }
  }

  const rooms = {
    corridor: { minX: centerX - 12, maxX: centerX + 12, minY: bounds.minY, maxY: bounds.maxY, label: 'Grand Corridor' },
    library: { minX: centerX + 13, maxX: centerX + 44, minY: bounds.minY + 4, maxY: bounds.minY + 24 },
    hallOfMirrors: { minX: centerX - 44, maxX: centerX - 13, minY: bounds.minY + 4, maxY: bounds.minY + 22 },
    musicStudio: { minX: centerX - 10, maxX: centerX + 10, minY: bounds.minY, maxY: bounds.minY + 14 },
    guardRoom: { minX: centerX - 7, maxX: centerX + 7, minY: bounds.maxY - 10, maxY: bounds.maxY },
    kitchen: { minX: centerX - 44, maxX: centerX - 15, minY: bounds.maxY - 14, maxY: bounds.maxY },
    laboratory: { minX: centerX + 15, maxX: centerX + 44, minY: bounds.maxY - 14, maxY: bounds.maxY },
  };

  const carve = (room: { minX: number; maxX: number; minY: number; maxY: number }, label: string) => {
    for (let y = room.minY; y <= room.maxY; y++) {
      for (let x = room.minX; x <= room.maxX; x++) {
        st(tiles, x, y, { glyph: '.', walkable: true, transparent: true, region: 'keep', label });
      }
    }
  };

  carve(rooms.corridor, 'Grand Corridor');
  carve(rooms.library, 'Library');
  carve(rooms.hallOfMirrors, 'Hall of Mirrors');
  carve(rooms.musicStudio, 'Music Studio');
  carve(rooms.guardRoom, 'Guard Room');
  carve(rooms.kitchen, 'Kitchen');
  carve(rooms.laboratory, 'Laboratory');

  st(tiles, centerX - 1, bounds.minY + 1, {
    glyph: '☖', walkable: true, transparent: true, region: 'keep', label: 'Gate Portal', portal: 'castleGate',
  });
  st(tiles, centerX, bounds.minY + 1, {
    glyph: '☖', walkable: true, transparent: true, region: 'keep', label: 'Gate Portal', portal: 'castleGate',
  });

  const playerStart = { x: centerX, y: bounds.minY + 3 };
  const exit = { x: centerX - 1, y: bounds.minY + 1 };

  const corridorMosaic: Interactable = {
    id: 'corridor-mosaic',
    x: centerX,
    y: bounds.minY + 34,
    glyph: '⚹',
    radius: 1,
    prompt: '[e] Trace mosaic',
    onInteract: state => collectSigil(state, '⚹', 'Mosaic'),
  };
  interactables.push(corridorMosaic);

  const inkWell: Interactable = {
    id: 'ink-well',
    x: centerX - 6,
    y: bounds.minY + 20,
    glyph: '✒',
    radius: 1,
    prompt: '[e] Take ink',
    onInteract: state => {
      addItem(state, 'ink');
      addLog(state, "You draw the inkwell's dark fluid.");
      inkWell.exhausted = true;
    },
  };
  interactables.push(inkWell);

  const moonstoneCache: Interactable = {
    id: 'moonstone-cache',
    x: centerX + 6,
    y: bounds.minY + 20,
    glyph: '★',
    radius: 1,
    prompt: '[e] Take moonstone',
    onInteract: state => {
      addItem(state, 'moonstone');
      addLog(state, 'The moonstone pulses with cold light.');
      moonstoneCache.exhausted = true;
    },
  };
  interactables.push(moonstoneCache);

  const curator: Interactable = {
    id: 'curator',
    x: centerX,
    y: bounds.minY + 28,
    glyph: '⌐',
    radius: 2,
    prompt: '[e] Speak to Curator',
    onInteract: state => {
      if (state.sigils.size >= 3) {
        collectSigil(state, '※', 'Curator');
      } else {
        addLog(state, 'Bring three sigils and I shall grant you mine.');
      }
    },
  };
  interactables.push(curator);

  const lore = [
    'Fragments of old cartography.',
    'A treatise on resonant architectures.',
    'Recipes for spectral pigments.',
    'A catalogue of forgotten glyphs.',
    'Notes on corridor acoustics.',
    'Pressed moonflower petals.',
    'Marginalia: "the corridor breathes".',
  ];
  let shelfIdx = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const idx = shelfIdx;
      const bx = centerX + 16 + col * 8;
      const by = bounds.minY + 7 + row * 6;
      const shelf: Interactable = {
        id: `library-shelf-${idx + 1}`,
        x: bx,
        y: by,
        glyph: '▓',
        radius: 1,
        prompt: '[e] Read shelf',
        onInteract: state => {
          state.libraryBooksRead++;
          addLog(state, lore[idx % 7]);
          if (idx === 7) {
            collectSigil(state, '✦', 'Resonance');
          }
        },
      };
      interactables.push(shelf);
      shelfIdx++;
    }
  }

  const scramble: Interactable = {
    id: 'library-scramble',
    x: centerX + 16,
    y: bounds.minY + 20,
    glyph: 'ꞈ',
    fg: '#f5f5f5',
    radius: 2,
    prompt: '[e] Whisper to Scramble',
    petPrompt: '[p] Pet Scramble',
    onInteract: state => addLog(state, 'Scramble opens one eye and blinks slowly.'),
    onPet: state => addLog(state, 'Scramble purrs with a low resonance.'),
  };
  interactables.push(scramble);

  const mirrorLies = [
    'You look taller than you are.',
    'Your eyes multiply endlessly.',
    'A figure stands behind you.',
    'The reflection moves first.',
    'You see only darkness.',
  ];
  let mirrorIdx = 0;
  let mirrorCounter = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const mirror: Interactable = {
        id: `hall-mirror-${mirrorCounter + 1}`,
        x: centerX - 41 + col * 8,
        y: bounds.minY + 7 + row * 5,
        glyph: '◈',
        fg: '#9bb5ff',
        radius: 1,
        prompt: '[e] Gaze into mirror',
        onInteract: state => {
          addLog(state, mirrorLies[mirrorIdx % 5]);
          mirrorIdx++;
        },
      };
      interactables.push(mirror);
      mirrorCounter++;
    }
  }

  const reflectionSigil: Interactable = {
    id: 'hall-central-sigil',
    x: centerX - 28,
    y: bounds.minY + 13,
    glyph: '✧',
    fg: '#9bb5ff',
    radius: 1,
    prompt: '[e] Collect sigil',
    onInteract: state => collectSigil(state, '✧', 'Reflection'),
  };
  interactables.push(reflectionSigil);

  const makePlate = (id: string, x: number, y: number, dir: string): Interactable => ({
    id,
    x,
    y,
    glyph: '◌',
    radius: 1,
    prompt: '[e] Press plate',
    onInteract: state => {
      state.pressurePlateProgress.push(dir);
      const seq = ['north', 'east', 'south', 'west'];
      const prog = state.pressurePlateProgress;
      if (prog.length >= 4 && prog.slice(-4).every((v, i) => v === seq[i])) {
        state.mirrorVaultOpened = true;
        addLog(state, 'The vault door grinds open.');
      } else {
        addLog(state, 'The plate clicks.');
      }
    },
  });
  interactables.push(makePlate('hall-plate-north', centerX - 28, bounds.minY + 5, 'north'));
  interactables.push(makePlate('hall-plate-east', centerX - 15, bounds.minY + 13, 'east'));
  interactables.push(makePlate('hall-plate-south', centerX - 28, bounds.minY + 21, 'south'));
  interactables.push(makePlate('hall-plate-west', centerX - 41, bounds.minY + 13, 'west'));

  const instruments = [
    { x: centerX - 4, y: bounds.minY + 8, glyph: '♩', prompt: '[e] Play harp', id: 'harp' },
    { x: centerX + 4, y: bounds.minY + 8, glyph: '♪', prompt: '[e] Play chimes', id: 'chimes' },
    { x: centerX, y: bounds.minY + 6, glyph: '♬', prompt: '[e] Play organ', id: 'organ' },
    { x: centerX - 5, y: bounds.minY + 10, glyph: '♭', prompt: '[e] Play drum', id: 'drum' },
    { x: centerX + 5, y: bounds.minY + 10, glyph: '♯', prompt: '[e] Play violin', id: 'violin' },
    { x: centerX, y: bounds.minY + 12, glyph: '𝄞', prompt: '[e] Play flute', id: 'flute' },
  ];
  for (const instr of instruments) {
    const instrId = instr.id;
    interactables.push({
      id: `music-${instrId}`,
      x: instr.x,
      y: instr.y,
      glyph: instr.glyph,
      radius: 1,
      prompt: instr.prompt,
      onInteract: state => {
        state.instrumentsPlayed.add(instrId);
        addLog(state, 'A tone resonates through the keep.');
        if (state.instrumentsPlayed.size >= 6) {
          collectSigil(state, '✶', 'Harmony');
        }
      },
    });
  }

  interactables.push({
    id: 'guard-ceremonial-rack',
    x: centerX,
    y: bounds.maxY - 5,
    glyph: '⚔',
    radius: 1,
    prompt: '[e] Inspect rack',
    onInteract: state => collectSigil(state, '⚝', 'Blade'),
  });

  const mushroomCoords = [
    { x: centerX - 40, y: bounds.maxY - 11 },
    { x: centerX - 34, y: bounds.maxY - 11 },
    { x: centerX - 40, y: bounds.maxY - 7 },
  ];
  mushroomCoords.forEach((pt, i) => {
    const mushroom: Interactable = {
      id: `kitchen-mushroom-${i + 1}`,
      x: pt.x,
      y: pt.y,
      glyph: '♠',
      fg: '#88ff88',
      radius: 1,
      prompt: '[e] Harvest mushroom',
      onInteract: state => {
        addItem(state, 'mushroom');
        addLog(state, 'You take the glowing mushroom.');
        mushroom.exhausted = true;
      },
    };
    interactables.push(mushroom);
  });

  const soupSayings = [
    'The soup gurgles thoughtfully.',
    "Bubbles spell something you can't read.",
    'It smells of rain and circuits.',
  ];
  let soupIdx = 0;
  interactables.push({
    id: 'kitchen-sentient-soup',
    x: centerX - 29,
    y: bounds.maxY - 9,
    glyph: '~',
    fg: '#ffff88',
    radius: 1,
    prompt: '[e] Consult soup',
    petPrompt: '[p] Stir soup',
    onInteract: state => {
      addLog(state, soupSayings[soupIdx++ % 3]);
    },
    onPet: state => {
      addItem(state, 'herbs');
      addLog(state, 'The soup yields a sprig of ethereal herbs.');
    },
  });

  const resinCache: Interactable = {
    id: 'kitchen-resin-cache',
    x: centerX - 18,
    y: bounds.maxY - 11,
    glyph: '⊙',
    radius: 1,
    prompt: '[e] Take resin',
    onInteract: state => {
      addItem(state, 'resin');
      addLog(state, 'A lump of amber resin.');
      resinCache.exhausted = true;
    },
  };
  interactables.push(resinCache);

  const voidCrystal: Interactable = {
    id: 'lab-void-crystal',
    x: centerX + 40,
    y: bounds.maxY - 11,
    glyph: '◇',
    fg: '#aaaaff',
    radius: 1,
    prompt: '[e] Take void crystal',
    onInteract: state => {
      addItem(state, 'void_crystal');
      addLog(state, 'The crystal pulses with absence.');
      voidCrystal.exhausted = true;
    },
  };
  interactables.push(voidCrystal);

  const powderedMirror: Interactable = {
    id: 'lab-powdered-mirror',
    x: centerX + 18,
    y: bounds.maxY - 11,
    glyph: '⋄',
    fg: '#ccccff',
    radius: 1,
    prompt: '[e] Take powdered mirror',
    onInteract: state => {
      addItem(state, 'powdered_mirror');
      addLog(state, 'Fine reflective dust.');
      powderedMirror.exhausted = true;
    },
  };
  interactables.push(powderedMirror);

  interactables.push({
    id: 'lab-transmutation-circle',
    x: centerX + 29,
    y: bounds.maxY - 7,
    glyph: '◎',
    fg: '#ffaa00',
    radius: 1,
    prompt: '[e] Attempt alchemy',
    onInteract: state => {
      const recipes = [
        { a: 'mushroom', b: 'resin', result: 'sticky_paste', cost: 10, msg: 'Mushroom and resin fuse into sticky paste.' },
        { a: 'sentient_soup', b: 'herbs', result: 'comfort_broth', cost: 5, msg: 'A warming broth emerges.' },
        { a: 'powdered_mirror', b: 'ink', result: 'reflective_ink', cost: 20, msg: 'The ink shimmers with reflection.' },
        { a: 'sticky_paste', b: 'void_crystal', result: 'sigil_stamp', cost: 35, msg: 'A sigil stamp crystallises.' },
        { a: 'moonstone', b: 'void_crystal', result: 'portal_key', cost: 50, msg: 'A portal key coalesces.' },
      ];
      for (const recipe of recipes) {
        if (hasItem(state, recipe.a) && hasItem(state, recipe.b) && state.magick >= recipe.cost) {
          removeItem(state, recipe.a);
          removeItem(state, recipe.b);
          state.magick -= recipe.cost;
          addItem(state, recipe.result);
          addLog(state, recipe.msg);
          return;
        }
      }
      addLog(state, 'No matching ingredients or insufficient magick.');
    },
  });

  return {
    tiles,
    structures,
    monsters,
    interactables,
    playerStart,
    exit,
    bounds,
    rooms,
    seed,
    width: WIDTH,
    height: HEIGHT,
  };
}
