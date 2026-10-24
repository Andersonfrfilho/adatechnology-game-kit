import type { HostToolAttachment } from '@adatechnology/game-contracts'

/** A cheap identity of what is on the weapon (count, ids, mounts and which are on), compared every frame in place of serializing the whole list. */
export const attachmentsKey = (parts: readonly HostToolAttachment[] | undefined): string => {
  if (!parts) return ''
  let key = String(parts.length)
  for (const part of parts) key += `|${part.id}@${part.mount}${part.on ? '+' : ''}`
  return key
}
