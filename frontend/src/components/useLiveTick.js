import { useSyncExternalStore } from 'react'

/**
 * Live updates, shared by the whole app: one clock that ticks every 10 seconds while the
 * browser tab is visible, and right away when the user comes back to the tab. Pages
 * re-fetch their data when it ticks, updating only the data. Nothing is reloaded or
 * remounted, so the active tab, filters, pagination and scroll position stay as they are.
 *
 *   const tick = useLiveTick()
 *   useEffect(() => { if (tick) refresh() }, [tick])
 */
const INTERVAL_MS = 10000

let tick = 0
let updatedAt = new Date()
let timer = null
const listeners = new Set()

function bump() {
  if (document.visibilityState !== 'visible') return
  tick += 1
  updatedAt = new Date()
  listeners.forEach((l) => l())
}

function subscribe(listener) {
  listeners.add(listener)
  if (!timer) {
    timer = setInterval(bump, INTERVAL_MS)
    document.addEventListener('visibilitychange', bump)
    window.addEventListener('focus', bump)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(timer)
      timer = null
      document.removeEventListener('visibilitychange', bump)
      window.removeEventListener('focus', bump)
    }
  }
}

export default function useLiveTick() {
  return useSyncExternalStore(subscribe, () => tick)
}

/** When the data was last refreshed, for the "Live · updated" label. */
export function useLiveUpdatedAt() {
  return useSyncExternalStore(subscribe, () => updatedAt)
}
