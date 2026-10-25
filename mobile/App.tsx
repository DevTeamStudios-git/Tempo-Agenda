import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text as NativeText,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
  focusManager,
} from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { supabase } from './src/lib/supabase';
import { api, fetchEvents } from './src/lib/api';
import type {
  SessionBootstrap,
  CalendarSummary,
  EventRecord,
  AssistantPermissions,
  AssistantPlanView,
} from './src/features/calendar/types';
const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
function Text({style,...props}:React.ComponentProps<typeof NativeText>){return <NativeText {...props} style={[{color:'#1f1f1f'},style]}/>;}
function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: '#0b57d0' }]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  secure = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  secure?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginVertical: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, multiline && { minHeight: 80 }]}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        multiline={multiline}
        autoCapitalize="none"
      />
    </View>
  );
}
function SignIn() {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function submit(signup = false) {
    setBusy(true);
    setMessage('');
    try {
      const result = signup
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
      if (result.error) {throw result.error;}
      if (signup && !result.data.session)
        {setMessage('Check your email to confirm your account, then sign in.');}
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <Text style={styles.brand}>Tempo</Text>
      <Text style={styles.heading}>Your time, together.</Text>
      <Text style={styles.muted}>
        Sign in with the same account as Tempo on the web.
      </Text>
      <Field label="Email" value={email} onChange={setEmail} />
      <Field label="Password" value={password} onChange={setPassword} secure />
      <Button
        title={busy ? 'Connecting…' : 'Sign in'}
        disabled={busy || !email || !password}
        onPress={() => void submit()}
      />
      <Button
        title="Create account"
        secondary
        disabled={busy || !email || password.length < 6}
        onPress={() => void submit(true)}
      />
      {!!message && (
        <Text accessibilityRole="alert" style={styles.error}>
          {message}
        </Text>
      )}
    </ScrollView>
  );
}
function EventEditor({
  event,
  session,
  onClose,
  onSaved,
}: {
  event: Partial<EventRecord>;
  session: SessionBootstrap;
  onClose: () => void;
  onSaved: () => void;
}) {
  const zone = session.timeZone;
  const date = (s: string | undefined, f: string) =>
    formatInTimeZone(s ?? new Date(), zone, f);
  const [title, setTitle] = useState(event.title ?? ''),
    [day, setDay] = useState(date(event.startAt, 'yyyy-MM-dd')),
    [endDay, setEndDay] = useState(
      date(event.endAt ?? event.startAt, 'yyyy-MM-dd'),
    ),
    [start, setStart] = useState(
      event.startAt ? date(event.startAt, 'HH:mm') : '09:00',
    ),
    [end, setEnd] = useState(
      event.endAt ? date(event.endAt, 'HH:mm') : '10:00',
    ),
    [calendar, setCalendar] = useState(
      event.calendarId ??
        session.calendars.find((c) => !c.isArchived)?.id ??
        '',
    ),
    [notes, setNotes] = useState(event.description ?? ''),
    [location, setLocation] = useState(event.location ?? ''),
    [allDay, setAllDay] = useState(event.allDay ?? false),
    [repeat, setRepeat] = useState(event.recurrence?.rrule ?? ''),
    [scope, setScope] = useState<'this' | 'following' | 'series'>('this'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDay) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)
      )
        {throw new Error('Use YYYY-MM-DD dates and HH:mm times.');}
      const startAt = fromZonedTime(
          day + 'T' + (allDay ? '00:00' : start),
          zone,
        ).toISOString(),
        endAt = fromZonedTime(
          endDay + 'T' + (allDay ? '00:00' : end),
          zone,
        ).toISOString();
      if (new Date(endAt) < new Date(startAt) || (!allDay && endAt === startAt))
        {throw new Error('End must be after start.');}
      await api(
        event.id
          ? '/api/events/' + encodeURIComponent(event.id) + '?scope=' + scope
          : '/api/events',
        event.id ? 'PATCH' : 'POST',
        {
          calendarId: calendar,
          title,
          description: notes,
          location,
          startAt,
          endAt,
          timezone: zone,
          allDay,
          recurrence: repeat ? { rrule: repeat } : null,
        },
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api(
        '/api/events/' + encodeURIComponent(event.id!) + '?scope=' + scope,
        'DELETE',
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={styles.heading}>
            {event.id ? 'Edit event' : 'New event'}
          </Text>
          <Field label="Title" value={title} onChange={setTitle} />
          <Text style={styles.label}>Calendar</Text>
          <View style={styles.wrap}>
            {session.calendars
              .filter((c) => !c.isArchived)
              .map((c) => (
                <Button
                  key={c.id}
                  title={(calendar === c.id ? '✓ ' : '') + c.name}
                  secondary
                  onPress={() => setCalendar(c.id)}
                />
              ))}
          </View>
          <Field
            label="Start date (YYYY-MM-DD)"
            value={day}
            onChange={setDay}
          />
          <Field
            label="End date (YYYY-MM-DD)"
            value={endDay}
            onChange={setEndDay}
          />
          <View style={styles.row}>
            <Text>All day</Text>
            <Switch
              accessibilityLabel="All day"
              value={allDay}
              onValueChange={setAllDay}
            />
          </View>
          {!allDay && (
            <>
              <Field label="Start (HH:mm)" value={start} onChange={setStart} />
              <Field label="End (HH:mm)" value={end} onChange={setEnd} />
            </>
          )}
          <Text style={styles.muted}>Timezone: {zone}</Text>
          <Field label="Location" value={location} onChange={setLocation} />
          <Field label="Notes" value={notes} onChange={setNotes} multiline />
          {!event.id && (
            <>
              <Text style={styles.label}>Repeat</Text>
              <View style={styles.wrap}>
                {[
                  ['Never', ''],
                  ['Daily', 'FREQ=DAILY'],
                  ['Weekly', 'FREQ=WEEKLY'],
                  ['Monthly', 'FREQ=MONTHLY'],
                ].map(([name, rule]) => (
                  <Button
                    key={name}
                    title={(repeat === rule ? '✓ ' : '') + name}
                    secondary
                    onPress={() => setRepeat(rule)}
                  />
                ))}
              </View>
            </>
          )}
          {event.id?.includes('~') && (
            <>
              <Text>Apply to recurring events</Text>
              <View style={styles.wrap}>
                {(['this', 'following', 'series'] as const).map((v) => (
                  <Button
                    key={v}
                    title={(scope === v ? '✓ ' : '') + v}
                    secondary
                    onPress={() => setScope(v)}
                  />
                ))}
              </View>
            </>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <Button
            title={busy ? 'Saving…' : 'Save event'}
            disabled={busy || !title.trim() || !calendar}
            onPress={() => void save()}
          />
          {event.id && (
            <Button
              title="Delete event"
              secondary
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  'Delete event?',
                  'You can restore deleted events in Tempo web trash.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => void remove(),
                    },
                  ],
                )
              }
            />
          )}
          <Button title="Cancel" secondary disabled={busy} onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const permissionLabels: Record<keyof AssistantPermissions, string> = {
  canRead: 'Read calendars and events',
  canCreateEvents: 'Create events',
  canEditEvents: 'Edit events',
  canDeleteEvents: 'Delete events',
  canCreateCalendars: 'Create calendars',
  canManageCalendars: 'Edit and delete calendars',
};
function Assistant({ session }: { session: SessionBootstrap }) {
  const client = useQueryClient();
  const [input, setInput] = useState(''),
    [messages, setMessages] = useState<
      Array<{
        role: 'user' | 'assistant';
        content: string;
        plan?: AssistantPlanView;
      }>
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const policy = useQuery({
    queryKey: ['assistant-permissions'],
    queryFn: () =>
      api<{ permissions: AssistantPermissions }>('/api/ai/permissions'),
  });
  async function permissions(key: keyof AssistantPermissions, value: boolean) {
    if (!policy.data) {return;}
    setBusy(true);
    try {
      await api('/api/ai/permissions', 'PATCH', {
        ...policy.data.permissions,
        [key]: value,
      });
      await policy.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!input.trim()) {return;}
    const content = input.trim();
    setInput('');
    setBusy(true);
    setError('');
    setMessages((old) => [...old, { role: 'user', content }]);
    try {
      const answer = await api<{ reply: string; plan?: AssistantPlanView }>(
        '/api/ai/chat',
        'POST',
        {
          provider: 'groq',
          message: content,
          history: messages
            .slice(-12)
            .map((m) => ({ role: m.role, content: m.content })),
          workspaceId: session.workspaceId,
          timeZone: session.timeZone,
        },
      );
      setMessages((old) => [
        ...old,
        { role: 'assistant', content: answer.reply, plan: answer.plan },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function apply(id: string, approved: boolean) {
    setBusy(true);
    try {
      const result = await api<{
        state: string;
        results: Array<{ ok: boolean; message: string }>;
      }>('/api/ai/actions/' + id, 'POST', { approved });
      setMessages((old) =>
        old.map((m) =>
          m.plan?.id === id ? { ...m, plan: { ...m.plan, ...result } } : m,
        ),
      );
      await client.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>AI Assistant</Text>
      <Text style={styles.muted}>
        Enable only the permissions you want. Reading shares your schedule with
        the AI provider. Changes need your approval.
      </Text>
      {policy.data &&
        Object.entries(permissionLabels).map(([key, label]) => (
          <View key={key} style={styles.row}>
            <Text style={{ flex: 1 }}>{label}</Text>
            <Switch
              disabled={busy}
              accessibilityLabel={label}
              value={policy.data.permissions[key as keyof AssistantPermissions]}
              onValueChange={(v) =>
                void permissions(key as keyof AssistantPermissions, v)
              }
            />
          </View>
        ))}
      {policy.error && <Text style={styles.error}>{policy.error.message}</Text>}
      {messages.map((m, i) => (
        <View
          key={i}
          style={[
            styles.card,
            m.role === 'user' && { backgroundColor: '#d3e3fd' },
          ]}
        >
          <Text style={styles.label}>
            {m.role === 'user' ? 'You' : 'Tempo'}
          </Text>
          <Text selectable>{m.content}</Text>
          {m.plan && (
            <>
              {m.plan.actions.map((a, n) => (
                <Text key={n} style={{ marginTop: 8 }}>
                  {a.summary}
                </Text>
              ))}
              {m.plan.state === 'pending' ? (
                <>
                  <Button
                    title="Apply changes"
                    disabled={busy}
                    onPress={() => void apply(m.plan!.id, true)}
                  />
                  <Button
                    title="Discard"
                    secondary
                    disabled={busy}
                    onPress={() => void apply(m.plan!.id, false)}
                  />
                </>
              ) : (
                <Text>{m.plan.state}</Text>
              )}
              {m.plan.results?.map((r, n) => (
                <Text key={n}>
                  {r.ok ? '✓ ' : 'Failed: '}
                  {r.message}
                </Text>
              ))}
            </>
          )}
        </View>
      ))}
      <Field label="Message" value={input} onChange={setInput} multiline />
      <Button
        title={busy ? 'Working…' : 'Send'}
        disabled={busy || !input.trim()}
        onPress={() => void send()}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </ScrollView>
  );
}
function Calendars({ session }: { session: SessionBootstrap }) {
  const client = useQueryClient();
  const [name, setName] = useState(''),
    [color, setColor] = useState('#0b57d0'),
    [edit, setEdit] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const deleted = useQuery({
    queryKey: ['deleted-calendars', session.workspaceId],
    enabled: session.canManageCalendars,
    queryFn: () =>
      api<{ calendars: CalendarSummary[] }>(
        '/api/calendars?workspaceId=' + session.workspaceId + '&deleted=1',
      ),
  });
  async function change(method: string, id?: string, body?: unknown) {
    setBusy(true);
    setError('');
    try {
      await api(id ? '/api/calendars/' + id : '/api/calendars', method, body);
      setEdit(null);
      setName('');
      await client.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>My calendars</Text>
      {session.canManageCalendars ? (
        <>
          <Field label="Calendar name" value={name} onChange={setName} />
          <Text>Color</Text>
          <View style={styles.wrap}>
            {['#0b57d0', '#00897b', '#b3261e', '#8e24aa', '#e37400'].map(
              (c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={'Choose ' + c}
                  onPress={() => setColor(c)}
                  style={{
                    backgroundColor: c,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    margin: 4,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff' }}>
                    {color === c ? '✓' : ''}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
          <Button
            title={edit ? 'Save changes' : 'Add calendar'}
            disabled={busy || !name.trim()}
            onPress={() =>
              void change(edit ? 'PATCH' : 'POST', edit ?? undefined, {
                name,
                color,
                ...(!edit ? { workspaceId: session.workspaceId } : {}),
              })
            }
          />
          {edit && (
            <Button
              title="Cancel edit"
              secondary
              onPress={() => {
                setEdit(null);
                setName('');
              }}
            />
          )}
        </>
      ) : (
        <Text style={styles.muted}>
          Only owners and administrators can manage calendars.
        </Text>
      )}
      {session.calendars.map((c) => (
        <View
          key={c.id}
          style={[
            styles.card,
            { borderLeftWidth: 4, borderLeftColor: c.color },
          ]}
        >
          <Text style={styles.label}>
            {c.name}
            {c.isArchived ? ' (archived)' : ''}
          </Text>
          {session.canManageCalendars && (
            <>
              <Button
                title="Edit"
                secondary
                onPress={() => {
                  setEdit(c.id);
                  setName(c.name);
                  setColor(c.color);
                }}
              />
              <Button
                title={c.isArchived ? 'Unarchive' : 'Archive'}
                secondary
                disabled={busy}
                onPress={() =>
                  void change('PATCH', c.id, { isArchived: !c.isArchived })
                }
              />
              <Button
                title="Delete calendar"
                secondary
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    'Delete ' + c.name + '?',
                    'Its events will be hidden. You can restore the calendar below.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => void change('DELETE', c.id),
                      },
                    ],
                  )
                }
              />
            </>
          )}
        </View>
      ))}
      {deleted.data?.calendars.map((c) => (
        <View key={c.id} style={styles.card}>
          <Text>{c.name} (deleted)</Text>
          <Button
            title="Restore"
            secondary
            disabled={busy}
            onPress={() => void change('POST', c.id)}
          />
        </View>
      ))}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}
function Home() {
  const client = useQueryClient();
  const bootstrap = useQuery({
    queryKey: ['session'],
    queryFn: () => api<SessionBootstrap>('/api/session'),
    refetchInterval:30000,
  });
  const [tab, setTab] = useState<
      'agenda' | 'month' | 'calendars' | 'assistant'
    >('agenda'),
    [anchor, setAnchor] = useState(new Date()),
    [selected, setSelected] = useState<Partial<EventRecord> | null>(null),
    [hidden, setHidden] = useState<string[]>([]);
  const session = bootstrap.data;
  const zone = session?.timeZone ?? 'UTC';
  const y = Number(formatInTimeZone(anchor, zone, 'yyyy')),
    m = Number(formatInTimeZone(anchor, zone, 'MM'));
  const rangeStart = fromZonedTime(new Date(y, m - 1, 1, 0), zone),
    rangeEnd = fromZonedTime(new Date(y, m, 1, 0), zone);
  const calendars =
    session?.calendars.filter((c) => !c.isArchived && !hidden.includes(c.id)) ??
    [];
  const events = useQuery({
    queryKey: [
      'events',
      session?.workspaceId,
      calendars.map((c) => c.id),
      rangeStart.toISOString(),
    ],
    enabled: !!session,
    refetchInterval:30000,
    queryFn: () =>
      fetchEvents({
        workspaceId: session!.workspaceId,
        calendarIds: calendars.map((c) => c.id),
        rangeStart,
        rangeEnd,
      }),
  });
  if (!session)
    {return (
      <View style={styles.content}>
        {bootstrap.isLoading ? (
          <ActivityIndicator color="#0b57d0" />
        ) : (
          <>
            <Text style={styles.error}>{bootstrap.error?.message}</Text>
            <Button title="Retry" onPress={() => void bootstrap.refetch()} />
            <Button
              title="Sign out"
              secondary
              onPress={() => void supabase.auth.signOut()}
            />
          </>
        )}
      </View>
    );}
  const list = events.data ?? [];
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(monthStart);
    d.setUTCDate(1 - monthStart.getUTCDay() + i);
    return {
      key: d.toISOString().slice(0, 10),
      number: d.getUTCDate(),
      current: d.getUTCMonth() === m - 1,
    };
  });
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.brand}>Tempo</Text>
        <Button
          title="Sign out"
          secondary
          onPress={() => void supabase.auth.signOut()}
        />
      </View>
      <View style={styles.wrap}>
        {(['agenda', 'month', 'calendars', 'assistant'] as const).map((v) => (
          <Button
            key={v}
            title={(v === tab ? '● ' : '') + v[0].toUpperCase() + v.slice(1)}
            secondary
            onPress={() => setTab(v)}
          />
        ))}
      </View>
      {tab === 'calendars' ? (
        <Calendars session={session} />
      ) : tab === 'assistant' ? (
        <Assistant session={session} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.row}>
            <Button
              title="‹"
              secondary
              onPress={() =>
                setAnchor(fromZonedTime(new Date(y, m - 2, 15, 12), zone))
              }
            />
            <Text style={styles.heading}>
              {formatInTimeZone(anchor, zone, 'MMMM yyyy')}
            </Text>
            <Button
              title="›"
              secondary
              onPress={() =>
                setAnchor(fromZonedTime(new Date(y, m, 15, 12), zone))
              }
            />
          </View>
          <View style={styles.row}>
            <Button
              title="Today"
              secondary
              onPress={() => setAnchor(new Date())}
            />
            <Button
              title="+ Event"
              disabled={!calendars.length}
              onPress={() => setSelected({ calendarId: calendars[0]?.id })}
            />
          </View>
          <View style={styles.wrap}>
            {session.calendars
              .filter((c) => !c.isArchived)
              .map((c) => (
                <Button
                  key={c.id}
                  title={(hidden.includes(c.id) ? '○ ' : '✓ ') + c.name}
                  secondary
                  onPress={() =>
                    setHidden((old) =>
                      old.includes(c.id)
                        ? old.filter((id) => id !== c.id)
                        : [...old, c.id],
                    )
                  }
                />
              ))}
          </View>
          {tab === 'month' && (
            <>
              <View style={styles.wrap}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <Text key={d} style={styles.weekday}>
                    {d}
                  </Text>
                ))}
              </View>
              <View style={styles.wrap}>
                {days.map((d) => {
                  const count = list.filter(
                    (e) =>
                      formatInTimeZone(e.startAt, zone, 'yyyy-MM-dd') <=
                        d.key &&
                      formatInTimeZone(e.endAt, zone, 'yyyy-MM-dd') >= d.key,
                  ).length;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        'Create event on ' +
                        d.key +
                        ', ' +
                        count +
                        ' existing events'
                      }
                      key={d.key}
                      style={[styles.day, !d.current && { opacity: 0.35 }]}
                      onPress={() => {
                        setSelected({
                          startAt: fromZonedTime(
                            d.key + 'T09:00',
                            zone,
                          ).toISOString(),
                          endAt: fromZonedTime(
                            d.key + 'T10:00',
                            zone,
                          ).toISOString(),
                          calendarId: calendars[0]?.id,
                        });
                      }}
                    >
                      <Text>{d.number}</Text>
                      {count > 0 && (
                        <Text style={{ color: '#0b57d0', fontSize: 10 }}>
                          {count} event{count === 1 ? '' : 's'}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          {events.isLoading && <ActivityIndicator color="#0b57d0" />}
          {events.error && (
            <>
              <Text style={styles.error}>{events.error.message}</Text>
              <Button
                title="Retry events"
                secondary
                onPress={() => void events.refetch()}
              />
            </>
          )}
          {!events.isLoading && !events.error && !list.length && (
            <Text style={styles.muted}>
              No events this month. Add an event or choose a calendar.
            </Text>
          )}
          {list.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={'Edit ' + e.title}
              style={[
                styles.card,
                {
                  borderLeftWidth: 4,
                  borderLeftColor:
                    session.calendars.find((c) => c.id === e.calendarId)
                      ?.color ?? '#0b57d0',
                },
              ]}
              onPress={() => setSelected(e)}
            >
              <Text style={styles.label}>{e.title}</Text>
              <Text>
                {formatInTimeZone(
                  e.startAt,
                  zone,
                  e.allDay ? 'EEE, MMM d' : 'EEE, MMM d · HH:mm',
                )}{' '}
                {!e.allDay && '– ' + formatInTimeZone(e.endAt, zone, 'HH:mm')}
              </Text>
              {!!e.location && <Text style={styles.muted}>{e.location}</Text>}
            </Pressable>
          ))}
        </ScrollView>
      )}
      {selected && (
        <EventEditor
          event={selected}
          session={session}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            void client.invalidateQueries({ queryKey: ['events'] });
          }}
        />
      )}
    </>
  );
}
function Root() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        setSession(null);
        setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        qc.clear();
      }
      setSession(next);
      setLoading(false);
    });
    if (AppState.currentState === 'active') {supabase.auth.startAutoRefresh();}
    const app = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
      if (state === 'active') {supabase.auth.startAutoRefresh();}
      else {supabase.auth.stopAutoRefresh();}
    });
    return () => {
      data.subscription.unsubscribe();
      app.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafd" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <ActivityIndicator />
        ) : session ? (
          <Home key={session.user.id} />
        ) : (
          <SignIn />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={qc}>
          <Root />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafd' },
  content: { padding: 16, paddingBottom: 40 },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0b57d0',
    marginVertical: 12,
  },
  heading: {
    fontSize: 21,
    fontWeight: '600',
    color: '#1f1f1f',
    marginVertical: 12,
  },
  muted: { color: '#444746', lineHeight: 21, marginVertical: 6 },
  label: { fontWeight: '600', color: '#1f1f1f', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#747775',
    borderRadius: 12,
    padding: 12,
    color: '#1f1f1f',
    backgroundColor: '#fff',
    minHeight: 48,
  },
  button: {
    backgroundColor: '#0b57d0',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginVertical: 5,
    marginRight: 5,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { backgroundColor: '#e8f0fe' },
  buttonText: { color: '#fff', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginVertical: 3,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#e0e3e7',
  },
  error: { color: '#b3261e', marginVertical: 12 },
  weekday: {
    width: '14.28%',
    textAlign: 'center',
    paddingVertical: 10,
    color: '#444746',
  },
  day: {
    width: '14.28%',
    height: 68,
    padding: 4,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#e0e3e7',
    backgroundColor: '#fff',
  },
});
