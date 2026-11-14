// src/app/announcement/[id].tsx  —  resident: one announcement in full (opened from the Announcements tab)
// Distribution announcements show their facts as clear rows (When, Where, What you'll get…) with a live status.
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, Pressable, Animated, Easing, Linking, Share, StyleSheet,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Building2, Landmark, CalendarDays, CalendarClock, MapPin, Package, Banknote, Users, QrCode, Share2,
  Navigation, ChevronDown, ChevronRight, Megaphone, Info, Tag, Clock, CircleCheck, Hourglass, Radio,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import ScreenHeader from '../../components/ScreenHeader';
import {
  getAnnouncement, fullDate, dayName, clockTime, distributionStatus, Announcement, DistributionInfo, Tone,
} from '../../data/announcements';
import { markRead } from '../../lib/announcementReads';
import { errorText } from '../../lib/api';
import { colors, fonts } from '../../constants/theme';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

const TONES: Record<Tone, { fg: string; bg: string; border: string }> = {
  green: { fg: colors.primary, bg: colors.primaryTint, border: '#BFDAD3' },
  blue: { fg: colors.blue, bg: colors.blueTint, border: '#C5D9EA' },
  amber: { fg: '#9A6B00', bg: '#FDF6E3', border: '#F0DCA4' },
  gray: { fg: colors.textSecondary, bg: '#F1F4F5', border: colors.border },
};

const TOWN = 'Urbiztondo, Pangasinan';
const LONG_MESSAGE = 280; // longer messages start folded with "Read more"

function longDate(ymd: string) {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function openMaps(venue: string) {
  const q = encodeURIComponent(`${venue}, ${TOWN}`);
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
}

/** Small dot that softly pulses, for "Happening now". */
function LiveDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.liveWrap}>
      <Animated.View
        style={[styles.liveHalo, { backgroundColor: color, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }]}
      />
      <View style={[styles.liveDot, { backgroundColor: color }]} />
    </View>
  );
}

/** One labelled fact: icon | LABEL / value | optional action. Tappable rows press down like buttons. */
function InfoRow({
  Icon, label, value, sub, action, onPress, expanded, children, last,
}: {
  Icon: LucideIcon; label: string; value: string; sub?: string | null;
  action?: { text: string; Icon: LucideIcon; onPress: () => void };
  onPress?: () => void; expanded?: boolean; children?: ReactNode; last?: boolean;
}) {
  const body = (
    <>
      <View style={styles.rowIcon}>
        <Icon size={18} color={colors.primary} strokeWidth={2} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} selectable>{value}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        {expanded && children ? <View style={styles.rowExtra}>{children}</View> : null}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={6}
          style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={action.text}
        >
          <action.Icon size={14} color={colors.primary} strokeWidth={2.2} />
          <Text style={styles.rowActionText}>{action.text}</Text>
        </Pressable>
      ) : onPress ? (
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <ChevronDown size={18} color={colors.muted} strokeWidth={2} />
        </View>
      ) : null}
    </>
  );

  return onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      {body}
    </Pressable>
  ) : (
    <View style={[styles.row, !last && styles.rowLine]}>{body}</View>
  );
}

function SectionTitle({ Icon, text }: { Icon: LucideIcon; text: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Icon size={14} color={colors.textSecondary} strokeWidth={2.2} />
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
}

/** Distribution facts, in the order people ask: when, where, what, who, what to bring. */
function DistributionRows({ d }: { d: DistributionInfo }) {
  const [showContents, setShowContents] = useState(false);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowContents((v) => !v);
  };
  const canClaim = !d.claimedAt && d.status !== 'closed' && !!d.youGet;
  const ItemIcon = d.isCash ? Banknote : Package;

  const rows: Parameters<typeof InfoRow>[0][] = [
    {
      Icon: CalendarClock,
      label: 'WHEN',
      value: d.scheduledAt ? `${dayName(d.scheduledAt)} · ${clockTime(d.scheduledAt)}` : 'Date to be announced',
      sub: d.scheduledAt ? fullDate(d.scheduledAt).split(' · ')[0] : 'Your barangay will post the day here',
    },
    {
      Icon: MapPin,
      label: 'WHERE',
      value: d.venue || 'Venue to be announced',
      sub: d.venue ? `Barangay venue · ${TOWN}` : null,
      action: d.venue ? { text: 'Directions', Icon: Navigation, onPress: () => openMaps(d.venue!) } : undefined,
    },
    {
      Icon: ItemIcon,
      label: d.claimedAt ? 'YOU RECEIVED' : "WHAT YOU'LL GET",
      value: d.youGet ?? 'Not included this time',
      sub: d.isCash ? 'Cash assistance' : d.item,
      onPress: d.contents ? toggle : undefined,
      expanded: showContents,
      children: d.contents ? (
        <>
          <Text style={styles.contentsTitle}>Inside each {d.isCash ? 'release' : 'pack'}</Text>
          {d.contents.split(/[,\n;]+/).map((c) => c.trim()).filter(Boolean).map((c) => (
            <View key={c} style={styles.contentsItem}>
              <View style={styles.bullet} />
              <Text style={styles.contentsText}>{c}</Text>
            </View>
          ))}
        </>
      ) : undefined,
    },
    { Icon: Users, label: 'WHO CAN CLAIM', value: d.whoCanClaim },
  ];
  if (canClaim) {
    rows.push({
      Icon: QrCode,
      label: 'BRING',
      value: 'Your household QR code',
      sub: 'or your reference number, if your phone is off',
      action: { text: 'Show QR', Icon: QrCode, onPress: () => router.navigate('/home') },
    });
  }
  if (d.claimBy && !d.claimedAt && d.status !== 'closed') {
    rows.push({ Icon: Hourglass, label: 'CLAIM ON OR BEFORE', value: longDate(d.claimBy) });
  }
  rows.push({ Icon: Tag, label: 'RELIEF PROGRAM', value: d.event });

  return (
    <View style={styles.table}>
      {rows.map((r, i) => <InfoRow key={r.label} {...r} last={i === rows.length - 1} />)}
    </View>
  );
}

export default function AnnouncementDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Announcement | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getAnnouncement(String(id))
      .then((a) => {
        if (!a) return setError('This announcement is no longer available.');
        setItem(a);
        markRead([a.id]).catch(() => {});
        Animated.timing(appear, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      })
      .catch((e) => setError(errorText(e)));
  }, [id, appear]);

  // Keep the countdown fresh ("Starts in 3 hours" → "in 2 hours") while the page is open
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Announcement" />
        <View style={styles.center}>
          {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
        </View>
      </SafeAreaView>
    );
  }

  const fromLgu = item.author.startsWith('LGU');
  const AuthorIcon = fromLgu ? Landmark : Building2;
  const d = item.distribution;
  const status = d ? distributionStatus(d, now) : null;
  const tone = status ? TONES[status.tone] : null;
  const StatusIcon = !status ? Info : status.live ? Radio : status.label === 'Claimed' ? CircleCheck
    : status.tone === 'gray' ? Info : status.tone === 'amber' ? Clock : CalendarDays;
  const canClaim = !!d && !d.claimedAt && d.status !== 'closed' && !!d.youGet;
  const isLong = item.body.length > LONG_MESSAGE;

  const share = () => {
    const lines = [item.title, ''];
    if (d) {
      if (d.scheduledAt) lines.push(`When: ${fullDate(d.scheduledAt)}`);
      if (d.venue) lines.push(`Where: ${d.venue}, ${TOWN}`);
      if (d.youGet) lines.push(`What: ${d.youGet}`);
      lines.push(`Who: ${d.whoCanClaim}`, '');
    }
    lines.push(item.body, '', `— ${item.author}, via ReliefConnect`);
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  const toggleMessage = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Announcement" />

      <Animated.ScrollView
        contentContainerStyle={styles.content}
        style={{ opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}
      >
        {/* Who posted it, the title, and the kind of announcement */}
        <View style={[styles.hero, fromLgu && styles.heroLgu]}>
          <View style={styles.chips}>
            <View style={[styles.chip, fromLgu && styles.chipLgu]}>
              <Megaphone size={12} color={fromLgu ? colors.blue : colors.primary} strokeWidth={2.4} />
              <Text style={[styles.chipText, fromLgu && { color: colors.blue }]}>
                {(d ? 'Relief distribution' : item.category || 'Announcement').toUpperCase()}
              </Text>
            </View>
            {status ? (
              <View style={[styles.chip, { backgroundColor: tone!.bg, borderColor: tone!.border }]}>
                {status.live ? <LiveDot color={tone!.fg} /> : null}
                <Text style={[styles.chipText, { color: tone!.fg }]}>{status.label.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.title} selectable>{item.title}</Text>

          <View style={styles.from}>
            <View style={[styles.avatar, fromLgu && styles.avatarLgu]}>
              <AuthorIcon size={18} color={fromLgu ? colors.blue : colors.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.author} numberOfLines={1}>{item.author}</Text>
              <Text style={styles.postedBy} numberOfLines={1}>
                {item.postedBy}{item.publishedAt ? ` · ${timeAgo(item.publishedAt)}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Big status: what this means for the household right now */}
        {status && tone ? (
          <View style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <View style={[styles.bannerIcon, { backgroundColor: colors.white }]}>
              <StatusIcon size={22} color={tone.fg} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.bannerTitle, { color: tone.fg }]}>{status.label}</Text>
              <Text style={styles.bannerText}>{status.detail}</Text>
            </View>
          </View>
        ) : null}

        {/* The facts, one per row */}
        {d ? (
          <>
            <SectionTitle Icon={Info} text="DETAILS" />
            <DistributionRows d={d} />
          </>
        ) : (
          <>
            <SectionTitle Icon={Info} text="DETAILS" />
            <View style={styles.table}>
              <InfoRow Icon={fromLgu ? Landmark : Building2} label="FROM" value={item.author}
                sub={fromLgu ? item.postedBy : 'Your barangay office'} />
              <InfoRow Icon={CalendarDays} label="POSTED" value={item.publishedAt ? fullDate(item.publishedAt) : '—'}
                sub={item.publishedAt ? timeAgo(item.publishedAt) : null} />
              <InfoRow Icon={Tag} label="TYPE" value={item.category || 'General announcement'} last />
            </View>
          </>
        )}

        {/* The full message */}
        <SectionTitle Icon={Megaphone} text="MESSAGE" />
        <View style={styles.message}>
          <Text style={styles.body} selectable numberOfLines={isLong && !expanded ? 7 : undefined}>{item.body}</Text>
          {isLong ? (
            <Pressable onPress={toggleMessage} hitSlop={8} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
              <Text style={styles.moreText}>{expanded ? 'Show less' : 'Read more'}</Text>
              <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
                <ChevronDown size={16} color={colors.primary} strokeWidth={2.2} />
              </View>
            </Pressable>
          ) : null}
          {d?.notes ? (
            <View style={styles.note}>
              <Text style={styles.noteLabel}>Note from the LGU</Text>
              <Text style={styles.noteText} selectable>{d.notes}</Text>
            </View>
          ) : null}
          {d && item.publishedAt ? (
            <Text style={styles.posted}>Posted {fullDate(item.publishedAt)}</Text>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* What the resident can do next */}
      <View style={styles.actions}>
        {canClaim ? (
          <Pressable
            onPress={() => router.navigate('/home')}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <QrCode size={18} color={colors.white} strokeWidth={2.2} />
            <Text style={styles.primaryText}>Show my QR</Text>
            <ChevronRight size={16} color={colors.white} strokeWidth={2.2} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={share}
          style={({ pressed }) => [styles.shareBtn, !canClaim && styles.shareWide, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Share this announcement"
        >
          <Share2 size={18} color={colors.primary} strokeWidth={2.2} />
          {!canClaim ? <Text style={styles.shareText}>Share with family</Text> : null}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  pressed: { opacity: 0.7 },

  // Header card
  hero: {
    backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    borderTopWidth: 4, borderTopColor: colors.primary, padding: 16, gap: 12,
  },
  heroLgu: { borderTopColor: colors.blue },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999, backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: '#BFDAD3',
  },
  chipLgu: { backgroundColor: colors.blueTint, borderColor: '#C5D9EA' },
  chipText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.6, color: colors.primary },
  title: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 28, color: colors.text },
  from: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarLgu: { backgroundColor: colors.blueTint },
  author: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  postedBy: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },

  liveWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  liveHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },

  // Status banner
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  bannerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontFamily: fonts.extrabold, fontSize: 18 },
  bannerText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },

  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 4 },
  sectionText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary },

  // Info rows
  table: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowPressed: { backgroundColor: colors.background },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8, color: colors.muted },
  rowValue: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text },
  rowSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  rowExtra: { marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.background, gap: 5 },
  rowAction: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: '#BFDAD3', backgroundColor: colors.primaryTint,
  },
  rowActionText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
  contentsTitle: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
  contentsItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.paddy },
  contentsText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },

  // Message
  message: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.text },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  moreText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  note: { borderLeftWidth: 3, borderLeftColor: colors.gold, backgroundColor: '#FDF8EA', borderRadius: 8, padding: 10, gap: 2 },
  noteLabel: { fontFamily: fonts.bold, fontSize: 11, color: '#8A6A12' },
  noteText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.text },
  posted: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },

  // Bottom actions
  actions: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border,
  },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 12, backgroundColor: colors.primary,
  },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  shareBtn: {
    width: 50, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  shareWide: { flex: 1, width: undefined },
  shareText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
});
