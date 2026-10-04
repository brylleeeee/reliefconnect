import { useCallback, useEffect, useState } from 'react'
import api from '../../api/client'
import useLiveTick from '../../components/useLiveTick'

export default function useSummary() {
  const [summary, setSummary] = useState(null)
  const reload = useCallback(() => api.get('/barangay/summary').then((r) => setSummary(r.data)), [])
  useEffect(() => { reload() }, [reload])
  const tick = useLiveTick()
  useEffect(() => { if (tick) reload() }, [tick, reload])
  return [summary, reload]
}
