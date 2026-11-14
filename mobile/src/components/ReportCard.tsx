// src/components/ReportCard.tsx  —  one report in "My Reports": category, status, and the barangay's response
import { View, Text, StyleSheet } from 'react-native';
import { SupportReport } from '../data/supportReports';
import { colors, fonts } from '../constants/theme';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function ReportCard({ report }: { report: SupportReport }) {
  const resolved = report.status === 'resolved';

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.category}>{report.category}</Text>
        <View style={[styles.badge, { backgroundColor: resolved ? colors.successTint : colors.blueTint }]}>
          <Text style={[styles.badgeText, { color: resolved ? colors.success : colors.blue }]}>
            {resolved ? 'Resolved' : 'Open'}
          </Text>
        </View>
      </View>

      <Text style={styles.message}>{report.message}</Text>
      {report.event ? <Text style={styles.meta}>About: {report.event}</Text> : null}
      <Text style={styles.meta}>Sent {when(report.submitted_at)}</Text>

      {resolved && (
        <View style={styles.response}>
          <Text style={styles.responseLabel}>BARANGAY'S RESPONSE</Text>
          <Text style={styles.responseText}>{report.resolution_note || 'Marked as resolved.'}</Text>
          {report.resolved_at ? <Text style={styles.meta}>{when(report.resolved_at)}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  category: { flex: 1, flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11 },
  message: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  response: { backgroundColor: colors.successTint, borderRadius: 8, padding: 10, gap: 4, marginTop: 4 },
  responseLabel: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.5, color: colors.success },
  responseText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },
});