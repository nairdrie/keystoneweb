// Anonymous bidder alias generator. Each registration gets a Color + Animal
// pairing so bidders can recognise each other across lots without revealing
// real identities to other bidders.

export const ALIAS_COLORS = [
  'Crimson', 'Sapphire', 'Jade', 'Amber', 'Onyx', 'Ivory', 'Cobalt', 'Scarlet',
  'Emerald', 'Violet', 'Indigo', 'Coral', 'Bronze', 'Silver', 'Pearl', 'Slate',
  'Topaz', 'Ruby', 'Garnet', 'Citrine', 'Opal', 'Quartz', 'Obsidian', 'Marigold',
] as const;

export const ALIAS_ANIMALS = [
  'Wolf', 'Otter', 'Falcon', 'Lynx', 'Heron', 'Stag', 'Fox', 'Owl', 'Panther',
  'Hawk', 'Bison', 'Raven', 'Badger', 'Mantis', 'Stoat', 'Ibex', 'Marten',
  'Crane', 'Jackal', 'Caribou', 'Cobra', 'Tortoise', 'Salmon', 'Pelican',
] as const;

export type AliasColor = typeof ALIAS_COLORS[number];
export type AliasAnimal = typeof ALIAS_ANIMALS[number];

export interface Alias {
  color: AliasColor;
  animal: AliasAnimal;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a random alias that isn't already taken in the provided list.
 * If the namespace is exhausted (unlikely with 576 combinations), falls back
 * to a numeric suffix.
 */
export function pickUniqueAlias(taken: Array<{ alias_color: string; alias_animal: string }>): Alias {
  const used = new Set(taken.map(t => `${t.alias_color}|${t.alias_animal}`));
  for (let attempt = 0; attempt < 50; attempt++) {
    const color = pick(ALIAS_COLORS);
    const animal = pick(ALIAS_ANIMALS);
    if (!used.has(`${color}|${animal}`)) return { color, animal };
  }
  return { color: pick(ALIAS_COLORS), animal: pick(ALIAS_ANIMALS) };
}

export function formatAlias(color: string, animal: string): string {
  return `${color} ${animal}`;
}
