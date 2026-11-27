import { weaponMenu } from '@adatechnology/game-weapons'
import type { TestRoomItem } from './types'
import type { ToolMenuGroup } from './tool-menu'

/** Every weapon of the arsenal by group and section, with the silhouette of the catalogue item that equips it when a module brought one. */
export function weaponMenuGroups(arsenal: Parameters<typeof weaponMenu>[0], catalog: readonly TestRoomItem[], locale: string): ToolMenuGroup[] {
  const thumbnails = new Map<string, TestRoomItem>()
  for (const item of catalog) if (item.weapon && item.thumbnail && !thumbnails.has(item.weapon)) thumbnails.set(item.weapon, item)
  return weaponMenu(arsenal, { locale }).map((group) => ({
    id: group.id,
    name: group.name,
    sections: group.sections.map((section) => ({
      id: section.id,
      name: section.name,
      tools: section.weapons.map((weapon) => {
        const item = thumbnails.get(weapon.id)
        return { id: weapon.id, name: weapon.name, ...(weapon.maker || weapon.tags ? { keywords: [weapon.maker, ...(weapon.tags ?? [])].filter(Boolean).join(' ') } : {}), ...(item?.thumbnail ? { thumbnail: item.thumbnail } : {}), ...(item?.thumbnailCredit ? { thumbnailCredit: item.thumbnailCredit } : {}) }
      }),
    })),
  }))
}
