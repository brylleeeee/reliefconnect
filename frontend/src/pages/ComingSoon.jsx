import PageHeader from '../components/PageHeader'

export default function ComingSoon({ title, sprint }) {
  return (
    <>
      <PageHeader title={title} subtitle="Barangay disaster response administration dashboard" />
      <div className="rc-card text-center py-5">
        <p className="fw-semibold mb-1">This module is scheduled for {sprint}.</p>
        <p className="small text-secondary mb-0">The route and sidebar link are ready; build the page here next.</p>
      </div>
    </>
  )
}
