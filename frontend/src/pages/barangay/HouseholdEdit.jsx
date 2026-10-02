import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../api/client'
import PageHeader from '../../components/PageHeader'
import HouseholdForm from '../../components/HouseholdForm'
import useSummary from './useSummary'

export default function HouseholdEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [summary] = useSummary()
  const [household, setHousehold] = useState(null)

  useEffect(() => { api.get(`/barangay/households/${id}`).then((r) => setHousehold(r.data)) }, [id])

  const save = async (payload) => {
    await api.put(`/barangay/households/${id}`, payload)
    navigate('/households')
  }

  return (
    <>
      <PageHeader title={household ? `Edit: ${household.household_head}` : 'Edit Household'}
                  subtitle="Updating members recalculates the household's priority score" />
      {household && (
        <HouseholdForm household={household} puroks={summary?.puroks} submitLabel="Save Changes"
                       onSubmit={save} onCancel={() => navigate('/households')} />
      )}
    </>
  )
}
