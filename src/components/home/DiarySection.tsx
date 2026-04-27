import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  format, addDays, addWeeks, startOfDay, startOfWeek, endOfWeek,
  isSameDay, isMonday, isToday, isBefore, getDaysInMonth, startOfMonth,
  addMonths, subMonths, getDay,
} from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Phone, Video, CheckSquare, CalendarClock, Plus, Bell,
  MoreHorizontal, X, Check, ChevronLeft, ChevronRight,
} from 'lucide-react';

const DARK = {
  card: '#1A1F2E',
  border: '#2D3748',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  hover: '#252B3B',
};

const EVENT_COLORS: Record<string, { border: string; bg: string }> = {
  call: { border: '#818cf8', bg: 'rgba(99,102,241,0.22)' },
  meeting: { border: '#10b981', bg: 'rgba(16,185,129,0.28)' },
  reminder: { border: '#f59e0b', bg: 'rgba(245,158,11,0.25)' },
  task: { border: '#3b82f6', bg: 'rgba(59,130,246,0.25)' },
};

const EVENT_ICONS: Record<string, React.ElementType> = {
  call: Phone, meeting: Video, task: CheckSquare, reminder: Bell,
};

const TYPE_EMOJI: Record<string, string> = {
  call: '📞', meeting: '🎥', reminder: '🔔', task: '✅',
};

type DiaryEvent = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  event_type: string;
  status: string;
  candidate_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  job_id: string | null;
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_PILLS = [9, 10, 11, 12, 13, 14, 15, 16, 17];
const EVENT_TYPES = ['call', 'meeting', 'reminder', 'task'] as const;

// ─── 7-Day Strip ───
function WeekStrip({
  weekStart,
  selectedDay,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  eventDates,
}: {
  weekStart: Date;
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  eventDates: Set<string>;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex items-center gap-1 mb-4">
      <button onClick={onPrevWeek} className="p-1 rounded hover:bg-slate-700/50 shrink-0">
        <ChevronLeft className="w-4 h-4" style={{ color: DARK.textSecondary }} />
      </button>
      <div className="flex flex-1 gap-1 justify-between">
        {days.map((day, i) => {
          const selected = isSameDay(day, selectedDay);
          const today = isToday(day);
          const hasEvents = eventDates.has(format(day, 'yyyy-MM-dd'));
          return (
            <button
              key={i}
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex flex-col items-center py-1.5 px-2 rounded-lg transition-all min-w-[40px]',
                selected ? 'bg-indigo-600' : 'hover:bg-slate-700/40',
              )}
            >
              <span className="text-[10px] font-medium" style={{ color: selected ? '#fff' : DARK.textSecondary }}>
                {DAY_NAMES[i]}
              </span>
              <span
                className="text-sm font-semibold mt-0.5"
                style={{ color: selected ? '#fff' : today ? '#818CF8' : DARK.text }}
              >
                {format(day, 'd')}
              </span>
              <span
                className={cn('w-1 h-1 rounded-full mt-0.5', hasEvents ? '' : 'invisible')}
                style={{ background: selected ? '#fff' : '#818CF8' }}
              />
            </button>
          );
        })}
      </div>
      <button onClick={onNextWeek} className="p-1 rounded hover:bg-slate-700/50 shrink-0">
        <ChevronRight className="w-4 h-4" style={{ color: DARK.textSecondary }} />
      </button>
    </div>
  );
}

// ─── Event Row ───
function EventRow({ evt, onClick }: { evt: DiaryEvent; onClick?: () => void }) {
  const qc = useQueryClient();
  const colors = EVENT_COLORS[evt.event_type] || EVENT_COLORS.task;
  const Icon = EVENT_ICONS[evt.event_type] || CalendarClock;
  const startDate = new Date(evt.start_time);

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from('diary_events').update({ status }).eq('id', evt.id);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ['diary_events'], exact: false });
      toast.success(status === 'completed' ? 'Marked complete' : status === 'cancelled' ? 'Cancelled' : 'Dismissed');
    },
  });

  return (
    <div
      className="group flex items-center gap-3 py-2 px-2 transition-colors rounded-lg cursor-pointer hover:brightness-110"
      onClick={onClick}
    >
      <span className="text-[11px] font-mono shrink-0 w-10 text-right" style={{ color: DARK.textSecondary }}>
        {format(startDate, 'HH:mm')}
      </span>
      <div
        className="flex items-center gap-2.5 flex-1 min-w-0 rounded-md px-3 py-2"
        style={{ background: colors.bg, borderLeft: `3px solid ${colors.border}` }}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: colors.border }} />
        <span className="text-sm font-medium truncate" style={{ color: DARK.text }}>{evt.title}</span>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {evt.event_type === 'reminder' && (
          <>
            <button onClick={e => { e.stopPropagation(); updateStatus.mutate('completed'); }}
              className="p-1 rounded hover:bg-green-900/30" title="Done">
              <Check className="w-3.5 h-3.5 text-green-400" />
            </button>
            <button onClick={e => { e.stopPropagation(); updateStatus.mutate('dismissed'); }}
              className="p-1 rounded hover:bg-red-900/30" title="Dismiss">
              <X className="w-3.5 h-3.5 text-red-400" />
            </button>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={e => e.stopPropagation()} className="p-1 rounded hover:bg-slate-700/50">
              <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => updateStatus.mutate('completed')}>
              <Check className="w-3.5 h-3.5 mr-2" /> Mark complete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateStatus.mutate('cancelled')} className="text-red-400">
              <X className="w-3.5 h-3.5 mr-2" /> Cancel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Mini Calendar for Quick-Add ───
function MiniCalendar({
  selectedDay,
  onSelect,
  eventDates,
}: {
  selectedDay: Date;
  onSelect: (d: Date) => void;
  eventDates: Set<string>;
}) {
  const [viewMonth, setViewMonth] = useState(startOfMonth(selectedDay));

  const daysInMonth = getDaysInMonth(viewMonth);
  const firstDayIdx = (getDay(viewMonth) + 6) % 7; // Mon=0
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDayIdx; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="p-0.5 rounded hover:bg-slate-700/50">
          <ChevronLeft className="w-3.5 h-3.5" style={{ color: DARK.textSecondary }} />
        </button>
        <span className="text-xs font-medium" style={{ color: DARK.text }}>{format(viewMonth, 'MMMM yyyy')}</span>
        <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-0.5 rounded hover:bg-slate-700/50">
          <ChevronRight className="w-3.5 h-3.5" style={{ color: DARK.textSecondary }} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((h, i) => (
          <span key={i} className="text-[10px] font-medium py-0.5" style={{ color: DARK.textSecondary }}>{h}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`e-${i}`} />;
          const sel = isSameDay(day, selectedDay);
          const today = isToday(day);
          const hasEvt = eventDates.has(format(day, 'yyyy-MM-dd'));
          return (
            <button
              key={i}
              onClick={() => onSelect(day)}
              className={cn(
                'relative flex flex-col items-center justify-center w-[26px] h-[26px] mx-auto rounded-full text-[11px] font-medium transition-colors',
                sel ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700/40',
              )}
              style={!sel ? { color: today ? '#818CF8' : DARK.text } : undefined}
            >
              {format(day, 'd')}
              {hasEvt && (
                <span className="absolute bottom-0 w-1 h-1 rounded-full" style={{ background: sel ? '#fff' : '#818CF8' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Inline Quick-Add Form ───
function QuickAddForm({
  workspaceId,
  userId,
  selectedDay,
  eventDates,
  onClose,
}: {
  workspaceId: string;
  userId: string;
  selectedDay: Date;
  eventDates: Set<string>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(selectedDay);
  const [hour, setHour] = useState<number | null>(null);
  const [eventType, setEventType] = useState<typeof EVENT_TYPES[number]>('reminder');

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dt = new Date(date);
      const h = hour ?? 9;
      dt.setHours(h, 0, 0, 0);
      const iso = dt.toISOString();
      let endIso = iso;
      if (eventType === 'call') {
        const end = new Date(dt); end.setMinutes(30);
        endIso = end.toISOString();
      } else if (eventType === 'meeting') {
        const end = new Date(dt); end.setHours(h + 1);
        endIso = end.toISOString();
      }
      const { error } = await supabase.from('diary_events').insert({
        workspace_id: workspaceId,
        user_id: userId,
        title,
        event_type: eventType,
        start_time: iso,
        end_time: endIso,
        status: 'scheduled',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary_events'], exact: false });
      toast.success('Event added');
      onClose();
    },
    onError: () => toast.error('Failed to save'),
  });

  return (
    <div className="space-y-3 p-3 rounded-lg border mt-2" style={{ background: DARK.hover, borderColor: DARK.border }}>
      <Input
        placeholder="Call back Ken / Meeting with Acme / Remind me to..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="bg-transparent border-slate-600 text-sm"
        style={{ color: DARK.text }}
        autoFocus
      />
      <MiniCalendar selectedDay={date} onSelect={setDate} eventDates={eventDates} />
      {/* Time pills */}
      <div className="flex gap-1 flex-wrap">
        {TIME_PILLS.map(h => (
          <button
            key={h}
            onClick={() => setHour(hour === h ? null : h)}
            className={cn(
              'px-2 py-1 rounded text-[11px] font-medium transition-colors',
              hour === h ? 'bg-indigo-600 text-white' : 'hover:text-white',
            )}
            style={hour !== h ? { background: DARK.border, color: DARK.textSecondary } : undefined}
          >
            {h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
          </button>
        ))}
      </div>
      {/* Type pills */}
      <div className="flex gap-1.5">
        {EVENT_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setEventType(t)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
              eventType === t ? 'text-white' : 'hover:text-white',
            )}
            style={{
              background: eventType === t ? EVENT_COLORS[t].border : DARK.border,
              color: eventType !== t ? DARK.textSecondary : undefined,
            }}
          >
            {TYPE_EMOJI[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose} className="text-slate-400 text-xs h-7">Cancel</Button>
        <Button
          size="sm"
          disabled={!title.trim() || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-7"
        >
          Save
        </Button>
      </div>
    </div>
  );
}

// ─── Main Export ───
export function DiarySection({ workspaceId, userId }: { workspaceId: string | undefined; userId: string | undefined }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = startOfDay(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(today);
  const [showAdd, setShowAdd] = useState(false);

  // Fetch 4 weeks of events for dot indicators
  const fetchStart = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), []);
  const fetchEnd = useMemo(() => addWeeks(fetchStart, 4), [fetchStart]);

  const { data: allEvents = [] } = useQuery({
    queryKey: ['diary_events', workspaceId, 'diary-widget'],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('diary_events')
        .select('id, title, description, start_time, end_time, event_type, status, candidate_id, contact_id, company_id, job_id')
        .eq('workspace_id', workspaceId)
        .in('status', ['scheduled'])
        .gte('start_time', fetchStart.toISOString())
        .lte('start_time', fetchEnd.toISOString())
        .order('start_time');
      if (error) return [];
      return (data || []) as DiaryEvent[];
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });

  // Set of dates with events (for dot indicators)
  const eventDates = useMemo(() => {
    const s = new Set<string>();
    for (const e of allEvents) s.add(format(new Date(e.start_time), 'yyyy-MM-dd'));
    return s;
  }, [allEvents]);

  // Events for selected day
  const dayEvents = useMemo(() => {
    const dayStr = format(selectedDay, 'yyyy-MM-dd');
    return allEvents.filter(e => format(new Date(e.start_time), 'yyyy-MM-dd') === dayStr)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [allEvents, selectedDay]);

  const handleEventClick = useCallback((evt: DiaryEvent) => {
    if (evt.contact_id) navigate(`/contacts/${evt.contact_id}`);
    else if (evt.candidate_id) navigate(`/talent/${evt.candidate_id}`);
    else if (evt.company_id) navigate(`/companies/${evt.company_id}`);
  }, [navigate]);

  // Live updates: refresh diary the moment AI calls (or anyone) book a new event
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`diary_events:${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'diary_events', filter: `workspace_id=eq.${workspaceId}` },
        () => qc.invalidateQueries({ queryKey: ['diary_events'], exact: false }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, qc]);

  // ─── Auto-reminders (Monday mornings) ───
  useEffect(() => {
    if (!workspaceId || !userId) return;
    const now = new Date();
    if (!isMonday(now) || now.getHours() > 10) return;

    const run = async () => {
      const todayStart = startOfDay(now);
      const morningIso = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate(), 9).toISOString();

      const { data: existingToday } = await supabase
        .from('diary_events').select('title')
        .eq('workspace_id', workspaceId).eq('user_id', userId).eq('event_type', 'reminder')
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', addDays(todayStart, 1).toISOString());

      const existingTitles = new Set((existingToday || []).map((e: any) => e.title));
      const newReminders: any[] = [];

      const { data: overdueInvoices } = await supabase
        .from('crm_invoices')
        .select('id, invoice_number, company_id, crm_companies:company_id(name)')
        .eq('status', 'unpaid')
        .lt('due_date', format(now, 'yyyy-MM-dd'));

      for (const inv of (overdueInvoices || []).slice(0, 3)) {
        const companyName = (inv as any).crm_companies?.name || 'Unknown';
        const t = `Overdue invoice — ${companyName}`;
        if (!existingTitles.has(t)) {
          newReminders.push({ workspace_id: workspaceId, user_id: userId, title: t, event_type: 'reminder', start_time: morningIso, end_time: morningIso, status: 'scheduled', company_id: inv.company_id });
        }
        if (newReminders.length >= 5) break;
      }

      if (newReminders.length < 5) {
        const staleDate = addDays(now, -14).toISOString();
        const { data: staleDeals } = await supabase
          .from('crm_deals').select('id, title, company_id')
          .lt('updated_at', staleDate)
          .not('stage', 'in', '("closed_won","closed_lost")')
          .limit(5 - newReminders.length);
        for (const deal of staleDeals || []) {
          const t = `Chase deal — ${deal.title}`;
          if (!existingTitles.has(t)) {
            newReminders.push({ workspace_id: workspaceId, user_id: userId, title: t, event_type: 'reminder', start_time: morningIso, end_time: morningIso, status: 'scheduled', company_id: deal.company_id });
          }
          if (newReminders.length >= 5) break;
        }
      }

      if (newReminders.length > 0) {
        await supabase.from('diary_events').insert(newReminders);
        qc.invalidateQueries({ queryKey: ['diary_events'], exact: false });
      }
    };
    run();
  }, [workspaceId, userId, qc]);

  return (
    <div>
      {/* Week strip */}
      <WeekStrip
        weekStart={weekStart}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        onPrevWeek={() => setWeekStart(addWeeks(weekStart, -1))}
        onNextWeek={() => setWeekStart(addWeeks(weekStart, 1))}
        eventDates={eventDates}
      />

      {/* Day label */}
      <p className="text-xs font-medium mb-2" style={{ color: DARK.textSecondary }}>
        {isSameDay(selectedDay, today) ? 'Today' : format(selectedDay, 'EEEE, d MMMM')}
        {dayEvents.length > 0 && ` · ${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}`}
      </p>

      {/* Event list */}
      {dayEvents.length === 0 && !showAdd ? (
        <div className="text-center py-6">
          <p className="text-sm" style={{ color: DARK.textSecondary }}>Nothing scheduled — add one below</p>
        </div>
      ) : (
        <div className="space-y-1">
          {dayEvents.map(evt => (
            <EventRow key={evt.id} evt={evt} onClick={() => handleEventClick(evt)} />
          ))}
        </div>
      )}

      {/* Quick-add trigger / form */}
      {showAdd && workspaceId && userId ? (
        <QuickAddForm
          workspaceId={workspaceId}
          userId={userId}
          selectedDay={selectedDay}
          eventDates={eventDates}
          onClose={() => setShowAdd(false)}
        />
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center gap-2 py-2.5 mt-2 rounded-lg border border-dashed transition-colors hover:border-indigo-500/50 hover:bg-indigo-500/5"
          style={{ borderColor: DARK.border, color: DARK.textSecondary }}
        >
          <Plus className="w-4 h-4 ml-3" />
          <span className="text-xs">Add event or reminder...</span>
        </button>
      )}
    </div>
  );
}
