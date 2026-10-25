import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useMemo } from 'react';
import { addDays, dayKey, formatClockWithFormat } from '@/lib/date-utils';
import { formatInTimeZone } from 'date-fns-tz';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {  runOnJS } from 'react-native-reanimated';

type Props = {
  anchor: Date;
  events: any[];
  calendars: any[];
  timeZone: string;
  onPrev: () => void;
  onNext: () => void;
  onSelectEvent: (id: string) => void;
};

export function BookView({ anchor, events, calendars, timeZone, onPrev, onNext, onSelectEvent }: Props) {
  const { width, height } = useWindowDimensions();
  // Report §6: 2 pages on desktop + landscape when width sufficient, 1 page portrait
  const isLandscape = width > height;
  const usableWidth = width - 32; // padding
  const showTwoPages = isLandscape ? usableWidth >= 560 : width >= 761;
  // On phone portrait we show 1 page, otherwise 2
  const pages = showTwoPages ? 2 : 1;

  const left = anchor;
  const right = useMemo(() => addDays(anchor, 1, timeZone), [anchor, timeZone]);
  const leftKey = formatInTimeZone(left, timeZone, 'yyyy-MM-dd');
  const rightKey = formatInTimeZone(right, timeZone, 'yyyy-MM-dd');

  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    m.set(leftKey, []); m.set(rightKey, []);
    for (const e of events) {
      const sk = dayKey(e.startAt, timeZone), ek = dayKey(e.endAt, timeZone);
      for (const k of [leftKey, rightKey]) {if (k >= sk && k <= ek) {m.get(k)!.push(e);}}
    }
    return m;
  }, [events, leftKey, rightKey, timeZone]);

  const pan = Gesture.Pan()
    .onEnd((e) => {
      if (e.translationX > 60) {runOnJS(onPrev)();}
      else if (e.translationX < -60) {runOnJS(onNext)();}
    });

  const renderPage = (date: Date, key: string) => {
    const list = byDay.get(key) ?? [];
    const isToday = key === formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');
    return (
      <View key={key} style={[styles.page, isToday && styles.pageToday]}>
        <View style={styles.pageHead}>
          <Text style={styles.dayName}>{formatInTimeZone(date, timeZone, 'EEEE').toUpperCase()}</Text>
          <Text style={styles.dateName}>{formatInTimeZone(date, timeZone, 'MMMM d, yyyy')}</Text>
          {isToday && <View style={styles.badge}><Text style={styles.badgeText}>Today</Text></View>}
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ height: 1152 }}>
          {Array.from({ length: 12 }, (_, i) => i * 2).map((h) => (
            <View key={h} style={[styles.hour, { top: h * 48 }]}>
              <Text style={styles.hourText}>{h % 12 === 0 ? 12 : h % 12} {h < 12 ? 'AM' : 'PM'}</Text>
              <View style={styles.hourLine} />
            </View>
          ))}
          {list.filter((e: any) => !e.allDay).map((ev: any) => {
            let sMin = 0, eMin = 60;
            try {
              const fmt = (iso: string) => formatInTimeZone(new Date(iso), timeZone, 'HH:mm');
              const [sh, sm] = fmt(ev.startAt).split(':').map(Number);
              const [eh, em] = fmt(ev.endAt).split(':').map(Number);
              sMin = (sh ?? 0) * 60 + (sm ?? 0);
              eMin = (eh ?? 0) * 60 + (em ?? 0);
            } catch {}
            const color = calendars.find((c) => c.id === ev.calendarId)?.color ?? '#3D3DE0';
            return (
              <Pressable key={ev.id} onPress={() => onSelectEvent(ev.id)} style={[styles.ev, { top: (sMin * 48) / 60, height: Math.max(22, ((eMin - sMin) * 48) / 60 - 2), borderLeftColor: color }]}>
                <Text style={styles.evTime}>{formatClockWithFormat(ev.startAt, timeZone, '12h')}</Text>
                <Text style={styles.evTitle} numberOfLines={1}>{ev.title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.wrap}>
        <View style={styles.nav}>
          <Pressable onPress={onPrev} style={styles.navBtn}><Text>‹</Text></Pressable>
          <Pressable onPress={() => {}} style={styles.todayBtn}><Text style={{ fontWeight: '600' }}>Today</Text></Pressable>
          <Pressable onPress={onNext} style={styles.navBtn}><Text>›</Text></Pressable>
        </View>
        <View style={[styles.spread, pages === 1 && { flexDirection: 'column' }]}>
          {renderPage(left, leftKey)}
          {pages === 2 && <View style={styles.spine} />}
          {pages === 2 && renderPage(right, rightKey)}
        </View>
        <Text style={styles.hint}>← Swipe to turn page → · Use arrows</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0E1117' },
  nav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 10 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#171B23', borderWidth: 1, borderColor: '#2A303B', alignItems: 'center', justifyContent: 'center' },
  todayBtn: { paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: '#171B23', justifyContent: 'center' },
  spread: { flex: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  spine: { width: 6, backgroundColor: '#2A303B', borderRadius: 3 },
  page: { flex: 1, backgroundColor: '#171B23', borderRadius: 14, borderWidth: 1, borderColor: '#2A303B', overflow: 'hidden' },
  pageToday: { borderColor: '#8F8FFF' },
  pageHead: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#2A303B', gap: 2 },
  dayName: { fontSize: 11, color: '#B8C0CC', fontWeight: '700', letterSpacing: 0.6 },
  dateName: { fontSize: 16, color: '#FFFFFF', fontWeight: '700' },
  badge: { alignSelf: 'flex-start', backgroundColor: '#8F8FFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  badgeText: { color: '#0E1117', fontSize: 11, fontWeight: '700' },
  hour: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  hourText: { fontSize: 11, color: '#B8C0CC', width: 50, textAlign: 'right' },
  hourLine: { flex: 1, height: 1, backgroundColor: '#2A303B' },
  ev: { position: 'absolute', left: 62, right: 8, backgroundColor: '#212734', borderLeftWidth: 4, borderRadius: 8, padding: 6 },
  evTime: { fontSize: 10, color: '#B8C0CC', fontWeight: '600' },
  evTitle: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
  hint: { textAlign: 'center', color: '#B8C0CC', fontSize: 10, padding: 6 },
});
