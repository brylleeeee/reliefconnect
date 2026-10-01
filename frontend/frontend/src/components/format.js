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

/** "1 Pack", "2 Packs": units are stored in plural form. */
export const qtyUnit = (qty, unit) => {
  const n = Number(qty)
  return `${n} ${n === 1 && unit?.endsWith('s') ? unit.slice(0, -1) : unit}`
}

/** For <input type="datetime-local">: an ISO date as local "YYYY-MM-DDTHH:mm". */
export const toLocalInput = (d) => {
  if (!d) return ''
  const t = new Date(d)
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
