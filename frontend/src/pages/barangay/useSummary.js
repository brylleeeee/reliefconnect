import { useCallback, useEffect, useState } from 'react'
import api from '../../api/client'

export default function useSummary() {
  const [summary, setSummary] = useState(null)
  const reload = useCallback(() => api.get('/barangay/summary').then((r) => setSummary(r.data)), [])
  useEffect(() => { reload() }, [reload])
  return [summary, reload]
}
