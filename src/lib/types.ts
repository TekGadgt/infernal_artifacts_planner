export type Slot = 'head' | 'cape' | 'neck' | 'weapon' | 'body' | 'shield' | 'legs' | 'hands' | 'feet' | 'ring';
export type Category = 'offence' | 'defence' | 'utility' | 'skilling';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type Variant = 'normal' | 'ancient' | 'primal';
export type Style = 'any' | 'melee' | 'ranged' | 'magic';

export interface AffixTier {
  tier: number;
  ilvl: number;
  text: string;
  min: number | null;
  max: number | null;
  unit: string;
  template: string;
  ancientMax: number | null;
  primalMax: number | null;
  requirement: string | null;
}

export interface Affix {
  id: string;
  name: string;
  category: Category;
  slots: Slot[];
  restriction: string | null;
  food: boolean;
  cap: { value: number | null; text: string; note: string | null };
  tiers: AffixTier[];
}

export interface Power {
  id: string;
  name: string;
  effect: string;
  min: number | null;
  max: number | null;
  unit: string;
  template: string;
  ancientMax: number | null;
  primalMax: number | null;
  limits: string | null;
  slots: Slot[];
  styles: Style[];
  cooldown: string | null;
  sources: string | null;
}

export interface PlannedAffix {
  affixId: string;
  tier: number;
  /** Base value before variant and two-handed multipliers. */
  value: number | null;
}

export interface PlannedItem {
  name: string;
  rarity: Rarity;
  variant: Variant;
  ilvl: number;
  style: Style;
  twoHanded: boolean;
  affixes: PlannedAffix[];
  powerId: string | null;
}

export type LoadoutKind = 'combat' | 'skilling';
export type Loadout = Partial<Record<Slot, PlannedItem>>;
export type SoulBrandSlot = 'weapon' | 'armour' | 'jewellery';

export interface ForgeOp {
  id: string;
  kind: 'transplant' | 'awaken-legendary' | 'awaken-ancient' | 'stamp' | 'outfit';
  tier?: number;
  ontoLegendary?: boolean;
  step?: 'trim' | 'gild';
  keep?: boolean;
  count: number;
}

export interface NamedLoadout {
  id: string;
  name: string;
  kind: LoadoutKind;
  items: Loadout;
  /** Combat loadouts only. */
  soulBrands: Record<SoulBrandSlot, string | null>;
}

export interface Plan {
  version: 2;
  name: string;
  relics: Record<string, string>;
  loadouts: NamedLoadout[];
  activeLoadout: string;
  forge: ForgeOp[];
}

/** The shape saved before plans could hold several loadouts. */
export interface PlanV1 {
  version: 1;
  name: string;
  relics: Record<string, string>;
  loadouts: Record<LoadoutKind, Loadout>;
  soulBrands: Record<SoulBrandSlot, string | null>;
  forge: ForgeOp[];
}
