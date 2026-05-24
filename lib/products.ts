export interface CurrencyPack {
  id: string
  name: string
  description: string
  priceInCents: number
  crystals: number
  bonus: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export const CURRENCY_PACKS: CurrencyPack[] = [
  {
    id: 'pack-starter',
    name: 'Starter Pack',
    description: '100 Neon Crystals',
    priceInCents: 99,
    crystals: 100,
    bonus: 0,
    rarity: 'common',
  },
  {
    id: 'pack-value',
    name: 'Value Pack',
    description: '500 + 50 Bonus Crystals',
    priceInCents: 399,
    crystals: 500,
    bonus: 50,
    rarity: 'rare',
  },
  {
    id: 'pack-mega',
    name: 'Mega Pack',
    description: '1200 + 200 Bonus Crystals',
    priceInCents: 799,
    crystals: 1200,
    bonus: 200,
    rarity: 'epic',
  },
  {
    id: 'pack-ultimate',
    name: 'Ultimate Pack',
    description: '3000 + 750 Bonus Crystals',
    priceInCents: 1499,
    crystals: 3000,
    bonus: 750,
    rarity: 'legendary',
  },
]
