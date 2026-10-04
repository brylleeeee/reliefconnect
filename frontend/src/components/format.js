/** Shared date and unit formatting for the distribution pages. */
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-PH', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
}) : '—')

/** A plain "YYYY-MM-DD" is a calendar date, so read it as local (not UTC) midnight. */
const toDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
  ? new Date(...d.split('-').map((n, i) => (i === 1 ? n - 1 : +n)))
  : new Date(d))

export const fmtDate = (d) => (d ? toDate(d).toLocaleDateString('en-PH', {
  month: 'short', day: 'numeric', year: 'numeric',
}) : '—')

export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

/** Whole pesos, e.g. "₱1,000". */
export const peso = (n) => `₱${Number(n ?? 0).toLocaleString('en-PH')}`

// Units offered when logging stock (same list as config/relief.php): plural => singular
export const UNITS = {
  Packs: 'Pack', Kits: 'Kit', Pieces: 'Piece', Kilos: 'Kilo', Sacks: 'Sack', Bags: 'Bag',
  Boxes: 'Box', Sets: 'Set', Bottles: 'Bottle', Cans: 'Can', Liters: 'Liter', Carboys: 'Carboy',
}

/** "1 Pack", "2 Packs", or "₱1,000" for cash aid (unit PHP). */
export const qtyUnit = (qty, unit) => {
  const n = Number(qty)
  if (unit === 'PHP') return peso(n)
  const singular = UNITS[unit] ?? (unit?.endsWith('s') ? unit.slice(0, -1) : unit)
  return `${n.toLocaleString('en-PH')} ${n === 1 ? singular : unit}`
}

/** For <input type="datetime-local">: an ISO date as local "YYYY-MM-DDTHH:mm". */
export const toLocalInput = (d) => {
  if (!d) return ''
  const t = new Date(d)
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// Who an event is given to: singular => plural
const RECIPIENT_PLURALS = {
  household: 'households', 'senior citizen': 'senior citizens', 'person with disability': 'persons with disability',
  infant: 'infants', 'pregnant member': 'pregnant members',
}
/** "1 senior citizen", "3 senior citizens". */
export const recipients = (n, recipient) => `${Number(n).toLocaleString()} ${n === 1 ? recipient : (RECIPIENT_PLURALS[recipient] ?? `${recipient}s`)}`

// Household fields holding each rule's qualifying members
export const RECIPIENT_COLUMNS = { senior: 'seniors_count', pwd: 'pwd_count', infant: 'infants_count', pregnant: 'pregnant_count' }
