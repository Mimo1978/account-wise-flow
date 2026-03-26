import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, startOfDay, isMonday, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Phone, Video, CheckSquare, CalendarClock, Plus, Bell,
  MoreHorizontal, X, Check, Clock, PhoneCall, Search,
} from 'lucide-react';

const DARK = {
  card: '#1A1F2E',
  border: '#2D3748',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  hover: '#252B3B',
};

const EVENT_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  meeting: Video,
  task: CheckSquare,
  reminder: Bell,
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

// ─── Quick Date/Time helpers ───
const getQuickDate = (label: string): Date => {
  const today = startOfDay(new Date());
  switch (label) {
    case 'Today': return today;
    case 'Tomorrow': return addDays(today, 1);
    case 'This Friday': {
      const d = new Date(today);
      const day = d.getDay();
      d.setDate(d.getDate() + ((5 - day + 7) % 7 || 7));
      return d;
    }
    case 'Next Monday': {
      const d = new Date(today);
      const day = d.getDay();
      d.setDate(d.getDate() + ((1 - day + 7) % 7 || 7));
      return d;
    }
    default: return today;
  }
};

const TIME_OPTIONS = [
  { label: 'Morning (9am)', hours: 9, minutes: 0 },
  { label: 'Midday (12pm)', hours: 12, minutes: 0 },
  { label: 'Afternoon (3pm)', hours: 15, minutes: 0 },
  { label: 'End of day (5pm)', hours: 17, minutes: 0 },
];

// ─── Quick Add Reminder Form ───
function QuickAddReminder({ workspaceId, userId, onClose }: {
  workspaceId: string;
  userId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [dateLabel, setDateLabel] = useState('Today');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [selectedTime, setSelectedTime] = useState(TIME_OPTIONS[0]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactName, setSelectedContactName] = useState('');
  const [showContactSearch, setShowContactSearch] = useState(false);

  const { data: contactResults = [] } = useQuery({
    queryKey: ['contact-search-reminder', contactSearch],
    queryFn: async () => {
      if (contactSearch.length < 2) return [];
      const { data } = await supabase
        .from('contacts')
        .select('id, name')
        .ilike('name', `%${contactSearch}%`)
        .limit(5);
      return data || [];
    },
    enabled: contactSearch.length >= 2,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dt = new Date(selectedDate);
      dt.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
      const iso = dt.toISOString();
      const { error } = await supabase.from('diary_events').insert({
        workspace_id: workspaceId,
        user_id: userId,
        title,
        event_type: 'reminder',
        start_time: iso,
        end_time: iso,
        status: 'scheduled',
        contact_id: selectedContactId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary_events'] });
      toast.success('Reminder saved');
      onClose();
    },
    onError: () => toast.error('Failed to save reminder'),
  });

  return (
    <div className="p-3 space-y-3 rounded-lg border" style={{ background: DARK.card, borderColor: DARK.border }}>
      <Input
        placeholder="What's the reminder?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="bg-transparent border-slate-600 text-sm"
        style={{ color: DARK.text }}
        autoFocus
      />
      <div className="flex gap-2 flex-wrap">
        {['Today', 'Tomorrow', 'This Friday', 'Next Monday'].map((d) => (
          <button
            key={d}
            onClick={() => { setSelectedDate(getQuickDate(d)); setDateLabel(d); setShowCustomDate(false); }}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              dateLabel === d ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            )}
            style={dateLabel !== d ? { background: DARK.border } : undefined}
          >
            {d}
          </button>
        ))}
        <Popover open={showCustomDate} onOpenChange={setShowCustomDate}>
          <PopoverTrigger asChild>
            <button
              onClick={() => { setShowCustomDate(true); setDateLabel('custom'); }}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                dateLabel === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              )}
              style={dateLabel !== 'custom' ? { background: DARK.border } : undefined}
            >
              {dateLabel === 'custom' ? format(selectedDate, 'dd MMM') : 'Custom'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { if (d) { setSelectedDate(d); setDateLabel('custom'); setShowCustomDate(false); } }}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex gap-2 flex-wrap">
        {TIME_OPTIONS.map((t) => (
          <button
            key={t.label}
            onClick={() => setSelectedTime(t)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              selectedTime.label === t.label ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            )}
            style={selectedTime.label !== t.label ? { background: DARK.border } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Contact linker */}
      <div className="relative">
        {selectedContactId ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs" style={{ background: DARK.border, color: DARK.text }}>
            <span>{selectedContactName}</span>
            <button onClick={() => { setSelectedContactId(null); setSelectedContactName(''); }}>
              <X className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border" style={{ borderColor: DARK.border }}>
              <Search className="w-3 h-3 text-slate-500" />
              <input
                placeholder="Link to a contact (optional)"
                value={contactSearch}
                onChange={(e) => { setContactSearch(e.target.value); setShowContactSearch(true); }}
                onFocus={() => setShowContactSearch(true)}
                className="bg-transparent outline-none flex-1 text-xs"
                style={{ color: DARK.text }}
              />
            </div>
            {showContactSearch && contactResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border shadow-lg" style={{ background: DARK.card, borderColor: DARK.border }}>
                {contactResults.map((c: any) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 text-xs hover:brightness-125"
                    style={{ color: DARK.text }}
                    onClick={() => {
                      setSelectedContactId(c.id);
                      setSelectedContactName(c.name);
                      setContactSearch('');
                      setShowContactSearch(false);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
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

// ─── Event Row ───
function EventRow({ evt, onClick }: { evt: DiaryEvent; onClick?: () => void }) {
  const qc = useQueryClient();
  const Icon = EVENT_ICONS[evt.event_type] || CalendarClock;
  const startDate = new Date(evt.start_time);
  const endDate = new Date(evt.end_time);
  const isReminder = evt.event_type === 'reminder';
  const isZeroDuration = evt.start_time === evt.end_time;

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from('diary_events')
        .update({ status })
        .eq('id', evt.id);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ['diary_events'] });
      toast.success(status === 'completed' ? 'Marked complete' : status === 'cancelled' ? 'Cancelled' : 'Updated');
    },
  });

  return (
    <div
      className="group flex items-center gap-3 py-2.5 px-2 transition-colors rounded-lg cursor-pointer hover:brightness-110"
      onClick={onClick}
      style={{ background: 'transparent' }}
    >
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: isReminder ? '#F59E0B20' : '#6366F120' }}>
        <Icon className="w-4 h-4" style={{ color: isReminder ? '#FBBF24' : '#818CF8' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: DARK.text }}>{evt.title}</p>
        <p className="text-xs" style={{ color: DARK.textSecondary }}>
          {format(startDate, 'EEEE')} · {isZeroDuration
            ? format(startDate, 'HH:mm')
            : `${format(startDate, 'HH:mm')}–${format(endDate, 'HH:mm')}`}
        </p>
      </div>
      <span className="text-xs shrink-0" style={{ color: DARK.textSecondary }}>{format(startDate, 'dd MMM')}</span>

      {/* Inline actions on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isReminder && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); updateStatus.mutate('completed'); }}
              className="p-1 rounded hover:bg-green-900/30"
              title="Done"
            >
              <Check className="w-3.5 h-3.5 text-green-400" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); updateStatus.mutate('dismissed'); }}
              className="p-1 rounded hover:bg-red-900/30"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5 text-red-400" />
            </button>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-slate-700/50">
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

// ─── Main Diary Section ───
export function DiarySection({ workspaceId, userId }: { workspaceId: string | undefined; userId: string | undefined }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'schedule' | 'reminders'>('schedule');
  const [showAddReminder, setShowAddReminder] = useState(false);

  const { data: allEvents = [] } = useQuery({
    queryKey: ['diary_events', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const now = new Date();
      const end = addDays(now, 7);
      const { data, error } = await supabase
        .from('diary_events')
        .select('id, title, description, start_time, end_time, event_type, status, candidate_id, contact_id, company_id, job_id')
        .eq('workspace_id', workspaceId)
        .in('status', ['scheduled'])
        .gte('start_time', now.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time');
      if (error) return [];
      return (data || []) as DiaryEvent[];
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });

  const scheduleEvents = allEvents.filter((e) => e.event_type !== 'reminder');
  const reminderEvents = allEvents.filter((e) => e.event_type === 'reminder');

  // ─── Auto-reminders (Monday mornings only) ───
  useEffect(() => {
    if (!workspaceId || !userId) return;
    const today = new Date();
    if (!isMonday(today)) return;
    if (today.getHours() > 10) return; // Only run before 10am

    const createAutoReminders = async () => {
      const todayStart = startOfDay(today);
      const todayIso = todayStart.toISOString();
      const morningIso = new Date(todayStart.setHours(9, 0, 0, 0)).toISOString();

      // Check existing auto-reminders for today
      const { data: existingToday } = await supabase
        .from('diary_events')
        .select('title')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('event_type', 'reminder')
        .gte('start_time', todayIso)
        .lte('start_time', addDays(todayStart, 1).toISOString());

      const existingTitles = new Set((existingToday || []).map((e: any) => e.title));
      const newReminders: any[] = [];

      // Condition 1: Overdue invoices
      const { data: overdueInvoices } = await supabase
        .from('crm_invoices')
        .select('id, invoice_number, company_id, crm_companies:company_id(name)')
        .eq('status', 'unpaid')
        .lt('due_date', format(today, 'yyyy-MM-dd'));

      for (const inv of (overdueInvoices || []).slice(0, 3)) {
        const companyName = (inv as any).crm_companies?.name || 'Unknown';
        const title = `Overdue invoice — ${companyName}`;
        if (!existingTitles.has(title)) {
          newReminders.push({
            workspace_id: workspaceId,
            user_id: userId,
            title,
            event_type: 'reminder',
            start_time: morningIso,
            end_time: morningIso,
            status: 'scheduled',
            company_id: inv.company_id,
          });
        }
        if (newReminders.length >= 5) break;
      }

      // Condition 2: Stale deals (no update in 14 days)
      if (newReminders.length < 5) {
        const staleDate = addDays(today, -14).toISOString();
        const { data: staleDeals } = await supabase
          .from('crm_deals')
          .select('id, title, company_id')
          .lt('updated_at', staleDate)
          .not('stage', 'in', '("closed_won","closed_lost")')
          .limit(5 - newReminders.length);

        for (const deal of staleDeals || []) {
          const title = `Chase deal — ${deal.title}`;
          if (!existingTitles.has(title)) {
            newReminders.push({
              workspace_id: workspaceId,
              user_id: userId,
              title,
              event_type: 'reminder',
              start_time: morningIso,
              end_time: morningIso,
              status: 'scheduled',
              company_id: deal.company_id,
            });
          }
          if (newReminders.length >= 5) break;
        }
      }

      if (newReminders.length > 0) {
        await supabase.from('diary_events').insert(newReminders);
        qc.invalidateQueries({ queryKey: ['diary_events'] });
      }
    };

    createAutoReminders();
  }, [workspaceId, userId, qc]);

  const handleEventClick = useCallback((evt: DiaryEvent) => {
    if (evt.contact_id) navigate(`/contacts/${evt.contact_id}`);
    else if (evt.candidate_id) navigate(`/talent/${evt.candidate_id}`);
    else if (evt.company_id) navigate(`/companies/${evt.company_id}`);
  }, [navigate]);

  const displayEvents = activeTab === 'schedule' ? scheduleEvents : reminderEvents;

  return (
    <div>
      {/* Tabs + Quick add */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: DARK.border }}>
          <button
            onClick={() => setActiveTab('schedule')}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-colors',
              activeTab === 'schedule' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            Schedule
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5',
              activeTab === 'reminders' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            Reminders
            {reminderEvents.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {reminderEvents.length}
              </span>
            )}
          </button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-7 gap-1 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20"
          onClick={() => setShowAddReminder(!showAddReminder)}
        >
          <Plus className="w-3 h-3" /> Reminder
        </Button>
      </div>

      {/* Quick add form */}
      {showAddReminder && workspaceId && userId && (
        <div className="mb-3">
          <QuickAddReminder
            workspaceId={workspaceId}
            userId={userId}
            onClose={() => setShowAddReminder(false)}
          />
        </div>
      )}

      {/* Event list */}
      {displayEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: DARK.border }}>
            {activeTab === 'schedule'
              ? <CalendarClock className="w-6 h-6" style={{ color: DARK.textSecondary }} />
              : <Bell className="w-6 h-6" style={{ color: DARK.textSecondary }} />}
          </div>
          <p className="text-sm font-medium" style={{ color: DARK.text }}>
            {activeTab === 'schedule' ? 'No events this week' : 'No reminders'}
          </p>
          <p className="text-xs mt-1" style={{ color: DARK.textSecondary }}>
            {activeTab === 'schedule'
              ? 'Booked calls, meetings and tasks will appear here.'
              : 'Reminders and follow-ups will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-0 divide-y" style={{ borderColor: DARK.border }}>
          {displayEvents.map((evt) => (
            <EventRow
              key={evt.id}
              evt={evt}
              onClick={() => handleEventClick(evt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
