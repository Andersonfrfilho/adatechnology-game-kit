/**
 * The textures of the marks that are not a round's entry hole: a blade's scratch (the primer shows), its cut (the bare metal), its gash (the sheet opened), the paint
 * crazed over a hard dent, and the exit of a round on the inside of a sheet (the torn petals bent out the way the round went). Drawn across the canvas; the instance's
 * stretch lays the long ones along the swing.
 */
export type ExtraMarkStyle = 'scratch' | 'cut' | 'gash' | 'crazed' | 'exit'

export const EXTRA_MARK_STYLES: ReadonlySet<string> = new Set<ExtraMarkStyle>(['scratch', 'cut', 'gash', 'crazed', 'exit'])

const PRIMER = '#8a8f92'
const BARE = '#c3c8cb'
const GROOVE = '#3b3e40'

/** A line along the middle of the canvas, soft at both sides: `share` of the half side thick. */
function band(x: CanvasRenderingContext2D, size: number, colour: string, share: number): void {
  const mid = size / 2
  const half = mid * share
  const fade = x.createLinearGradient(0, mid - half, 0, mid + half)
  fade.addColorStop(0, 'rgba(0, 0, 0, 0)')
  fade.addColorStop(0.35, colour)
  fade.addColorStop(0.65, colour)
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
  x.fillStyle = fade
  x.fillRect(0, mid - half, size, half * 2)
}

/** The paint crazed over a dent: cracks running out from the middle and rings round it, with a few flakes of primer where it lifted. */
function crazed(x: CanvasRenderingContext2D, size: number): void {
  const mid = size / 2
  x.strokeStyle = 'rgba(25, 26, 27, 0.75)'
  x.lineWidth = 1
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.3
    x.beginPath()
    x.moveTo(mid + Math.cos(a) * mid * 0.08, mid + Math.sin(a) * mid * 0.08)
    x.lineTo(mid + Math.cos(a + 0.15) * mid * 0.5, mid + Math.sin(a + 0.15) * mid * 0.5)
    x.lineTo(mid + Math.cos(a - 0.1) * mid * 0.85, mid + Math.sin(a - 0.1) * mid * 0.85)
    x.stroke()
  }
  for (const r of [0.3, 0.55]) {
    x.beginPath()
    x.arc(mid, mid, mid * r, 0.2, Math.PI * 1.7)
    x.stroke()
  }
  x.fillStyle = PRIMER
  for (let i = 0; i < 6; i++) {
    const a = i * 1.7
    x.fillRect(mid + Math.cos(a) * mid * 0.4, mid + Math.sin(a) * mid * 0.4, size * 0.04, size * 0.025)
  }
}

/** The exit of a round on the inside of the sheet: the black bore and the petals of torn sheet bent out round it, bright on their edges. */
function exit(x: CanvasRenderingContext2D, size: number): void {
  const mid = size / 2
  x.fillStyle = BARE
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2
    x.beginPath()
    x.moveTo(mid + Math.cos(a - 0.35) * mid * 0.3, mid + Math.sin(a - 0.35) * mid * 0.3)
    x.lineTo(mid + Math.cos(a) * mid * 0.9, mid + Math.sin(a) * mid * 0.9)
    x.lineTo(mid + Math.cos(a + 0.35) * mid * 0.3, mid + Math.sin(a + 0.35) * mid * 0.3)
    x.closePath()
    x.fill()
  }
  x.fillStyle = '#050505'
  x.beginPath()
  x.arc(mid, mid, mid * 0.32, 0, Math.PI * 2)
  x.fill()
}

/** One extra mark on a square canvas of `size`. */
export function drawExtraMark(x: CanvasRenderingContext2D, size: number, style: ExtraMarkStyle): void {
  switch (style) {
    case 'scratch':
      band(x, size, PRIMER, 0.55)
      return
    case 'cut':
      band(x, size, BARE, 0.7)
      band(x, size, GROOVE, 0.22)
      return
    case 'gash':
      band(x, size, BARE, 0.9)
      band(x, size, '#050505', 0.45)
      return
    case 'crazed':
      crazed(x, size)
      return
    case 'exit':
      exit(x, size)
  }
}
