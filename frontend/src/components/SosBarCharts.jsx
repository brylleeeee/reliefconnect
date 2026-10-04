// Bar graphs for the SOS Prioritization page. No chart library needed: bars are plain divs.
// Usage:  <SosBarCharts charts={data.charts} />   (data = the response of GET /api/admin/sos)

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 };
const muted = { color: '#6b7280', fontSize: 13, margin: 0 };

// series: [{ name, data, color }]. More than one series are stacked in the same bar.
function Bars({ labels = [], series }) {
  if (!labels.length) return <p style={muted}>No data yet.</p>;

  const totals = labels.map((_, i) => series.reduce((t, s) => t + Number(s.data?.[i] || 0), 0));
  const max = Math.max(...totals, 1);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {labels.map((label, i) => (
        <div key={`${label}-${i}`} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 52px', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <span title={label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          <div style={{ display: 'flex', height: 18, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
            {series.map((s) => (
              <div
                key={s.name}
                title={`${s.name}: ${s.data?.[i] ?? 0}`}
                style={{ width: `${(Number(s.data?.[i] || 0) / max) * 100}%`, background: s.color }}
              />
            ))}
          </div>
          <b style={{ textAlign: 'right' }}>{Math.round(totals[i] * 10) / 10}</b>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, note, labels, series }) {
  return (
    <div style={card}>
      <h3 style={{ fontSize: 15, margin: '0 0 2px' }}>{title}</h3>
      <p style={{ ...muted, marginBottom: 12 }}>{note}</p>
      <Bars labels={labels} series={series} />
      {series.length > 1 && (
        <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 12, color: '#6b7280' }}>
          {series.map((s) => (
            <span key={s.name}>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: s.color, borderRadius: 2, marginRight: 4 }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SosBarCharts({ charts }) {
  if (!charts) return null;

  const one = (c, name, color) => [{ name, data: c.data, color }];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginTop: 16 }}>
      <ChartCard
        title="Priority score"
        note="Higher bar = give relief goods first"
        labels={charts.priority_score.labels}
        series={one(charts.priority_score, 'Score', '#b91c1c')}
      />
      <ChartCard
        title="Score breakdown"
        note="Base score (people and waiting time) plus AI points from the SOS messages"
        labels={charts.score_breakdown.labels}
        series={[
          { name: 'Base score', data: charts.score_breakdown.base, color: '#3b82f6' },
          { name: 'AI points', data: charts.score_breakdown.ai_points, color: '#a855f7' },
        ]}
      />
      <ChartCard
        title="Pending SOS"
        note="Households asking for relief goods"
        labels={charts.sos_count.labels}
        series={one(charts.sos_count, 'SOS', '#3b82f6')}
      />
      <ChartCard
        title="People affected"
        note="Total people in the pending SOS"
        labels={charts.people_affected.labels}
        series={one(charts.people_affected, 'People', '#0ea5e9')}
      />
      <ChartCard
        title="Longest wait (hours)"
        note="Oldest unanswered SOS in each barangay"
        labels={charts.longest_wait_hours.labels}
        series={one(charts.longest_wait_hours, 'Hours', '#f59e0b')}
      />
      <ChartCard
        title="Emergency types"
        note="What residents reported, as read by the AI"
        labels={charts.emergency_types.labels}
        series={one(charts.emergency_types, 'SOS', '#a855f7')}
      />
    </div>
  );
}
