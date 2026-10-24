import type { CategoryDef } from './types'

/** The 14 categories of the team's catalog; always registered. */
export const ITEM_CATEGORIES: readonly CategoryDef[] = [
  { id: 'food', name: 'Food' },
  { id: 'drink', name: 'Drink' },
  { id: 'medical', name: 'Medical' },
  { id: 'tools', name: 'Tools' },
  { id: 'melee', name: 'Melee' },
  { id: 'materials', name: 'Materials' },
  { id: 'clothing', name: 'Clothing' },
  { id: 'bags', name: 'Bags' },
  { id: 'electronics', name: 'Electronics' },
  { id: 'fuel', name: 'Fuel' },
  { id: 'outdoors', name: 'Outdoors' },
  { id: 'books', name: 'Books' },
  { id: 'collectibles', name: 'Collectibles' },
  { id: 'keys', name: 'Keys' },
]
