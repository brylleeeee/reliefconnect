import { useEffect, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import api from '../api/client'
import PageHeader from '../components/PageHeader'
import { C } from '../chartColors'
import EventAnalytics from '../components/EventAnalytics'

function ChartCard({ title, note, height = 260, children }) {
  return (
    <section className="rc-card h-100">
      <h2 className="rc-card-title mb-1">{title}</h2>
      {note && <p className="small text-secondary">{note}</p>}
      <div style={{ height }}><ResponsiveContainer>{children}</ResponsiveContainer></div>
    </section>
  )
}

export default function Analytics() {
  const [d, setD] = useState(null)
  useEffect(() => { api.get('/admin/analytics').then((r) => setD(r.data)) }, [])

  if (!d) return <PageHeader title="Analytics Dashboard" subtitle="Loading…" />
  const k = d.kpis

  const priorityPie = [
    { name: 'High', value: d.priority_mix.high, color: C.high },
    { name: 'Medium', value: d.priority_mix.medium, color: C.medium },
    { name: 'Low', value: d.priority_mix.low, color: C.low },
  ]
  const methodPie = [
    { name: 'QR scan', value: d.verification.qr, color: C.green },
    { name: 'Reference no.', value: d.verification.reference_number, color: C.blue },
  ]
  const stock = d.stock.map((s) => ({ ...s, short: s.name.length > 22 ? s.name.slice(0, 20) + '…' : s.name }))

  return (
    <>
      <PageHeader title="Analytics Dashboard" subtitle="Municipal distribution performance over the last 30 days" />

      <div className="row g-3 mb-3">
        <div className="col-md-3"><div className="rc-stat green">
          <div className="rc-stat-label">Registered households</div>
          <div className="rc-stat-value green">{k.registered_households.toLocaleString()}</div>
        </div></div>
        <div className="col-md-3"><div className="rc-stat blue">
          <div className="rc-stat-label">Households reached</div>
          <div className="rc-stat-value blue">{k.coverage_pct}%</div>
          <div className="small text-secondary">{k.households_reached_30d} received aid in 30 days</div>
        </div></div>
        <div className="col-md-3"><div className="rc-stat">
          <div className="rc-stat-label">Units distributed</div>
          <div className="rc-stat-value">{k.units_distributed_30d.toLocaleString()}</div>
          <div className="small text-secondary">{k.offline_synced_30d} recorded offline, then synced</div>
        </div></div>
        <div className="col-md-3"><div className="rc-stat">
          <div className="rc-stat-label">Pending registrations</div>
          <div className="rc-stat-value">{k.pending_registrations}</div>
          <div className={`small ${k.low_stock_items ? 'text-danger' : 'text-secondary'}`}>
            {k.low_stock_items} item{k.low_stock_items === 1 ? '' : 's'} at or below reorder level
          </div>
        </div></div>
      </div>

      <section className="rc-card mb-3">
        <h2 className="rc-card-title mb-1">Distribution by barangay</h2>
        <p className="small text-secondary">
          Claimed, pending and unclaimed households for a distribution event. Choose a barangay to see it by purok.
        </p>
        <EventAnalytics />
      </section>

      <div className="mb-3">
        <ChartCard title="Units distributed per day">
          <AreaChart data={d.daily} margin={{ left: -10, right: 10 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Area type="monotone" dataKey="units" name="Units" stroke={C.green} fill={C.green} fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ChartCard>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-8">
          <ChartCard title="Registered vs reached, per barangay" note="Reached = received at least one distribution in the last 30 days.">
            <BarChart data={d.by_barangay} margin={{ left: -10, right: 10 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="registered" name="Registered" fill={C.blue} radius={[4, 4, 0, 0]} />
              <Bar dataKey="reached" name="Reached" fill={C.green} radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" name="Pending review" fill={C.low} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>
        <div className="col-lg-4">
          <ChartCard title="Priority mix" note="All approved households.">
            <PieChart>
              <Pie data={priorityPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {priorityPie.map((p) => <Cell key={p.name} fill={p.color} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ChartCard>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-8">
          <ChartCard title="Stock on hand vs reorder level" height={280}>
            <BarChart data={stock} margin={{ left: -10, right: 10 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="short" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(_, p) => p?.[0]?.payload.name} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="in_stock" name="In stock" radius={[4, 4, 0, 0]}>
                {stock.map((s) => <Cell key={s.name} fill={s.in_stock <= s.reorder_level ? C.high : C.green} />)}
              </Bar>
              <Bar dataKey="reorder_level" name="Reorder level" fill={C.low} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>
        <div className="col-lg-4">
          <ChartCard title="How claims were verified" note="QR scan vs static reference number (no-internet fallback).">
            <PieChart>
              <Pie data={methodPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {methodPie.map((p) => <Cell key={p.name} fill={p.color} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ChartCard>
        </div>
      </div>
    </>
  )
}
