import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import MobileBottomNav from '../components/MobileBottomNav';
import { getErrorFeedback, getInfoFeedback, showInfoFeedback } from '../utils/comingSoon';

const SESSION_DRAFT_STORAGE_KEY = 'teachSessionDraft:v1';

const INITIAL_SESSION_FORM = {
  title: '',
  description: '',
  sessionType: '1:1 Mentoring',
  startTime: '',
  endTime: '',
  priceAmount: '',
  meetingLink: '',
  cancellationWindowHours: 24,
  rescheduleWindowHours: 12,
  maxParticipants: 1
};

const SESSION_TEMPLATE_PRESETS = [
  {
    id: 'architecture-clinic',
    label: 'Architecture Clinic',
    values: {
      title: 'System Design & Architecture Clinic',
      description: 'Hands-on architecture mentoring for engineers who want stronger system design decisions, trade-off thinking, and scalable implementation patterns.',
      sessionType: '1:1 Mentoring',
      priceAmount: '79',
      maxParticipants: 1
    }
  },
  {
    id: 'interview-sprint',
    label: 'Interview Sprint',
    values: {
      title: 'Interview Prep Sprint',
      description: 'Focused mock interview with targeted feedback on communication, coding approach, and problem-solving speed for your next role.',
      sessionType: 'Interview Coaching',
      priceAmount: '59',
      maxParticipants: 1
    }
  },
  {
    id: 'group-lab',
    label: 'Group Lab',
    values: {
      title: 'Weekly Skills Group Lab',
      description: 'Interactive small-group lab with practical exercises, peer learning, and mentor guidance to improve delivery confidence and consistency.',
      sessionType: 'Group Workshop',
      priceAmount: '99',
      maxParticipants: 8
    }
  }
];

const formatCurrency = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(value || 0));

const formatTimeRange = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return 'TBD';
  }
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${formatter.format(s)} - ${formatter.format(e)}`;
};

export default function TeachingPage({ notify }) {
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [roadmaps, setRoadmaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [sessionMessage, setSessionMessage] = useState('');
  const [sessionErrors, setSessionErrors] = useState({});
  const [showSessionConfirmModal, setShowSessionConfirmModal] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [showPublishBurst, setShowPublishBurst] = useState(false);
  const [publishSoundEnabled, setPublishSoundEnabled] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [scheduleView, setScheduleView] = useState('today');
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const currentWorkspaceTab = ['overview', 'sessions', 'availability', 'verification'].includes(activeTab)
    ? activeTab
    : 'overview';
  const [sessionForm, setSessionForm] = useState(INITIAL_SESSION_FORM);
  const [sessionDraftSavedAt, setSessionDraftSavedAt] = useState('');
  const [availabilityForm, setAvailabilityForm] = useState({
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  });

  const playPublishSound = () => {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }
      const audioContext = new AudioContextCtor();
      const now = audioContext.currentTime;
      const notes = [523.25, 659.25, 783.99];

      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const start = now + (index * 0.09);
        const end = start + 0.14;

        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(0.045, start + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(start);
        oscillator.stop(end);
      });
    } catch {
      // Keep publish flow silent if browser blocks audio playback.
    }
  };

  const validateSessionForm = (form) => {
    const errors = {};
    const title = String(form?.title || '').trim();
    const description = String(form?.description || '').trim();
    const sessionType = String(form?.sessionType || '').trim();
    const meetingLink = String(form?.meetingLink || '').trim();
    const price = Number(form?.priceAmount);
    const cancellationWindowHours = Number(form?.cancellationWindowHours);
    const rescheduleWindowHours = Number(form?.rescheduleWindowHours);
    const maxParticipants = Number(form?.maxParticipants);
    const startDate = form?.startTime ? new Date(form.startTime) : null;
    const endDate = form?.endTime ? new Date(form.endTime) : null;

    if (!title) {
      errors.title = 'Please enter a session title.';
    }
    if (!sessionType) {
      errors.sessionType = 'Please enter a session type.';
    }
    if (!description) {
      errors.description = 'Please add a short session description.';
    } else if (description.length < 20) {
      errors.description = 'Description should be at least 20 characters.';
    }

    if (!form?.startTime) {
      errors.startTime = 'Please choose a start time.';
    } else if (!startDate || Number.isNaN(startDate.getTime())) {
      errors.startTime = 'Start time is invalid.';
    }

    if (!form?.endTime) {
      errors.endTime = 'Please choose an end time.';
    } else if (!endDate || Number.isNaN(endDate.getTime())) {
      errors.endTime = 'End time is invalid.';
    }

    if (startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate <= startDate) {
      errors.endTime = 'End time must be after start time.';
    }

    if (!Number.isFinite(price) || price < 0) {
      errors.priceAmount = 'Price must be 0 or greater.';
    }

    if (meetingLink) {
      const isValidMeetingLink = /^https?:\/\//i.test(meetingLink);
      if (!isValidMeetingLink) {
        errors.meetingLink = 'Meeting link must start with http:// or https://';
      }
    }

    if (!Number.isFinite(cancellationWindowHours) || cancellationWindowHours < 0) {
      errors.cancellationWindowHours = 'Cancellation window must be 0 or greater.';
    }

    if (!Number.isFinite(rescheduleWindowHours) || rescheduleWindowHours < 0) {
      errors.rescheduleWindowHours = 'Reschedule window must be 0 or greater.';
    }

    if (!Number.isFinite(maxParticipants) || maxParticipants < 1) {
      errors.maxParticipants = 'Max participants must be at least 1.';
    }

    return errors;
  };

  const updateSessionField = (field, value) => {
    setSessionForm((prev) => {
      const next = { ...prev, [field]: value };
      setSessionErrors((current) => (Object.keys(current).length > 0 ? validateSessionForm(next) : current));
      return next;
    });
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError('');
      let responses = [];

      try {
        responses = await Promise.allSettled([
          client.get('/api/v1/users/me'),
          client.get('/api/v1/bookings'),
          client.get('/api/v1/payments'),
          client.get('/api/v1/sessions'),
          client.get('/api/v1/roadmaps'),
          client.get('/api/v1/availability/my-slots')
        ]);
      } catch {
        if (!isMounted) {
          return;
        }
        setLoadError(getErrorFeedback('mentorWorkspaceLoadFailed').message);
        notify?.({
          type: 'error',
          title: 'Workspace unavailable',
          message: getErrorFeedback('mentorWorkspaceLoadHint').message
        });
        setLoading(false);
        return;
      }

      if (!isMounted) {
        return;
      }

      const getData = (index, fallback) => {
        const entry = responses[index];
        if (entry.status === 'fulfilled') {
          return entry.value?.data?.data ?? fallback;
        }
        return fallback;
      };

      setProfile(getData(0, null));
      setBookings(getData(1, []));
      setPayments(getData(2, []));
      setSessions(getData(3, []));
      setRoadmaps(getData(4, []));
      setAvailabilitySlots(getData(5, []));

      const failedCalls = responses.filter((result) => result.status === 'rejected').length;
      if (failedCalls > 0) {
        setLoadError(getErrorFeedback('mentorMetricsPartial').message);
      }
      setLoading(false);
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [notify, reloadKey]);

  useEffect(() => {
    const savedSetting = window.localStorage.getItem('publishSoundEnabled');
    setPublishSoundEnabled(savedSetting === 'true');
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_DRAFT_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      setSessionForm((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(parsed).filter(([key]) => Object.prototype.hasOwnProperty.call(INITIAL_SESSION_FORM, key))
        )
      }));
      setSessionMessage('Restored your last session draft.');
    } catch {
      window.localStorage.removeItem(SESSION_DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SESSION_DRAFT_STORAGE_KEY, JSON.stringify(sessionForm));
      setSessionDraftSavedAt(new Date().toISOString());
    } catch {
      // Ignore autosave failures in restricted browser contexts.
    }
  }, [sessionForm]);

  const mentorId = profile?.id;

  const mentorBookings = useMemo(() => (
    bookings.filter((booking) => booking?.session?.mentor?.id === mentorId)
  ), [bookings, mentorId]);

  const mentorSessions = useMemo(() => (
    sessions.filter((session) => session?.mentor?.id === mentorId)
  ), [mentorId, sessions]);

  const mentorReleasedPayments = useMemo(() => (
    payments.filter((payment) => (
      String(payment?.status || '') === 'RELEASED'
      && payment?.booking?.session?.mentor?.id === mentorId
    ))
  ), [mentorId, payments]);

  useEffect(() => {
    const targetId = activeTab === 'sessions' || activeTab === 'availability' || activeTab === 'verification'
      ? activeTab
      : 'overview';

    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeTab, loading]);

  const requestCards = useMemo(() => (
    mentorBookings
      .filter((booking) => ['PENDING', 'RESCHEDULE_REQUESTED'].includes(String(booking?.bookingStatus || '')))
      .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime())
      .slice(0, 3)
      .map((booking) => ({
        id: booking.id,
        name: String(booking?.learner?.fullName || 'Learner').trim(),
        topic: String(booking?.session?.title || 'Session request').trim(),
        note: String(booking?.notes || booking?.message || 'Looking forward to your guidance.').trim(),
        avatar: String(booking?.learner?.profileImageUrl || '').trim()
      }))
  ), [mentorBookings]);

  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    const allUpcoming = mentorSessions
      .filter((session) => new Date(session?.startTime || 0).getTime() >= now - (10 * 60 * 1000))
      .sort((a, b) => new Date(a?.startTime || 0).getTime() - new Date(b?.startTime || 0).getTime())
      .map((session) => ({
        ...session,
        startMs: new Date(session?.startTime || 0).getTime()
      }));

    const boundary = now + (24 * 60 * 60 * 1000);
    const filtered = scheduleView === 'today'
      ? allUpcoming.filter((session) => session.startMs < boundary)
      : allUpcoming;

    return filtered
      .slice(0, 3)
      .map((session, idx) => ({
        id: session.id,
        time: formatTimeRange(session.startTime, session.endTime),
        title: String(session.title || 'Upcoming session').trim(),
        subtitle: `${String(session.sessionType || 'Session')} - ${session.maxParticipants || session.capacity || 1} seats`,
        primary: idx === 0
      }));
  }, [mentorSessions, scheduleView]);

  const mentorSessionCards = useMemo(() => (
    mentorSessions
      .slice()
      .sort((a, b) => new Date(a?.startTime || 0).getTime() - new Date(b?.startTime || 0).getTime())
      .slice(0, 6)
      .map((session) => ({
        id: session.id,
        title: String(session?.title || 'Session').trim(),
        type: String(session?.sessionType || 'Session').trim(),
        schedule: formatTimeRange(session?.startTime, session?.endTime),
        amount: formatCurrency(session?.priceAmount || 0),
        participants: Number(session?.maxParticipants || session?.capacity || 1)
      }))
  ), [mentorSessions]);

  const progressRows = useMemo(() => (
    roadmaps
      .filter((roadmap) => roadmap?.booking?.session?.mentor?.id === mentorId)
      .slice(0, 3)
      .map((roadmap) => ({
        id: roadmap.id,
        name: String(roadmap?.booking?.learner?.fullName || 'Learner').trim(),
        course: String(roadmap?.title || roadmap?.booking?.session?.title || 'Learning roadmap').trim(),
        progress: Math.min(100, Math.max(0, Number(roadmap?.progressPercent || 0)))
      }))
  ), [mentorId, roadmaps]);

  const currentBalance = useMemo(() => (
    mentorReleasedPayments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0)
  ), [mentorReleasedPayments]);

  const monthlyGrowth = useMemo(() => {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return mentorReleasedPayments
      .filter((payment) => new Date(payment?.createdAt || 0).getTime() >= cutoff)
      .reduce((sum, payment) => sum + Number(payment?.amount || 0), 0);
  }, [mentorReleasedPayments]);

  const avgCompletion = useMemo(() => {
    if (progressRows.length === 0) {
      return 0;
    }
    return Math.round(progressRows.reduce((sum, item) => sum + item.progress, 0) / progressRows.length);
  }, [progressRows]);

  const activeLearners = useMemo(() => (
    new Set(mentorBookings.map((booking) => booking?.learner?.id).filter(Boolean)).size
  ), [mentorBookings]);

  const handleBookingAction = async (bookingId, status) => {
    setActionMessage('');
    try {
      const response = await client.patch(`/api/v1/bookings/${bookingId}/status`, { status });
      const updated = response?.data?.data;
      setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? updated : booking)));
      setActionMessage(getInfoFeedback('bookingUpdatedStatus', { bookingId, status }).message);
      notify?.({
        type: 'success',
        title: 'Booking updated',
        message: getInfoFeedback('bookingRequestMoved', { status }).message
      });
    } catch {
      const message = getErrorFeedback('bookingStatusUpdateFailed').message;
      setActionMessage(message);
      notify?.({
        type: 'error',
        title: 'Booking update failed',
        message
      });
    }
  };

  const handleCreateSession = async (event) => {
    event.preventDefault();
    setSessionMessage('');
    const errors = validateSessionForm(sessionForm);
    setSessionErrors(errors);

    if (Object.keys(errors).length > 0) {
      setSessionMessage('Please fix the highlighted fields and try again.');
      return;
    }

    setShowSessionConfirmModal(true);
  };

  const handleApplySessionTemplate = (templateValues) => {
    setSessionForm((prev) => {
      const next = { ...prev, ...templateValues };
      setSessionErrors((current) => (Object.keys(current).length > 0 ? validateSessionForm(next) : current));
      return next;
    });
    setSessionMessage('Template applied. Review and publish when ready.');
  };

  const handleResetSessionForm = () => {
    setSessionForm(INITIAL_SESSION_FORM);
    setSessionErrors({});
    setSessionMessage('Session form cleared.');
    window.localStorage.removeItem(SESSION_DRAFT_STORAGE_KEY);
    setSessionDraftSavedAt('');
  };

  const submitCreateSession = async () => {
    setSessionMessage('');
    setCreatingSession(true);

    try {
      const response = await client.post('/api/v1/sessions', {
        title: sessionForm.title.trim(),
        description: sessionForm.description.trim(),
        sessionType: sessionForm.sessionType.trim(),
        startTime: sessionForm.startTime ? new Date(sessionForm.startTime).toISOString() : null,
        endTime: sessionForm.endTime ? new Date(sessionForm.endTime).toISOString() : null,
        priceAmount: Number(sessionForm.priceAmount || 0),
        meetingLink: sessionForm.meetingLink.trim(),
        cancellationWindowHours: Number(sessionForm.cancellationWindowHours || 24),
        rescheduleWindowHours: Number(sessionForm.rescheduleWindowHours || 12),
        maxParticipants: Number(sessionForm.maxParticipants || 1)
      });

      const createdSession = response?.data?.data;
      if (createdSession) {
        setSessions((prev) => [createdSession, ...prev]);
      }

      setSessionMessage('Session created successfully.');
      setSessionErrors({});
      setShowSessionConfirmModal(false);
      setShowPublishBurst(true);
      if (publishSoundEnabled) {
        playPublishSound();
      }
      notify?.({
        type: 'success',
        title: 'Session published',
        message: 'Your session is live and visible to learners in Manage Sessions.',
        className: 'toast-session-publish'
      });
      setSessionForm((prev) => ({
        ...prev,
        ...INITIAL_SESSION_FORM
      }));
      window.localStorage.removeItem(SESSION_DRAFT_STORAGE_KEY);
      setSessionDraftSavedAt('');
    } catch (error) {
      setSessionMessage(error?.response?.data?.data?.error || 'Could not create session.');
      notify?.({
        type: 'error',
        title: 'Session creation failed',
        message: error?.response?.data?.data?.error || 'Could not create session.'
      });
    } finally {
      setCreatingSession(false);
    }
  };

  const handleAddAvailabilitySlot = async (event) => {
    event.preventDefault();
    setAvailabilityMessage('');

    try {
      const response = await client.post('/api/v1/availability/my-slots', {
        dayOfWeek: Number(availabilityForm.dayOfWeek),
        startTime: availabilityForm.startTime,
        endTime: availabilityForm.endTime,
        timezone: availabilityForm.timezone,
        active: true
      });

      const createdSlot = response?.data?.data;
      if (createdSlot) {
        setAvailabilitySlots((prev) => [...prev, createdSlot]);
      }

      setAvailabilityMessage(getInfoFeedback('availabilitySlotAdded').message);
      notify?.({
        type: 'success',
        title: 'Availability added',
        message: 'Learners can now match your teaching windows more easily.'
      });
      setAvailabilityForm((prev) => ({
        ...prev,
        startTime: '09:00',
        endTime: '17:00'
      }));
    } catch (error) {
      setAvailabilityMessage(error?.response?.data?.data?.error || getErrorFeedback('availabilityAddSlotFailed').message);
    }
  };

  const handleDeleteAvailabilitySlot = async (slotId) => {
    setAvailabilityMessage('');
    try {
      await client.delete(`/api/v1/availability/my-slots/${slotId}`);
      setAvailabilitySlots((prev) => prev.filter((slot) => slot.id !== slotId));
      setAvailabilityMessage('Availability slot removed.');
    } catch (error) {
      setAvailabilityMessage(error?.response?.data?.data?.error || getErrorFeedback('availabilityDeleteSlotFailed').message);
    }
  };

  useEffect(() => {
    if (!showPublishBurst) {
      return undefined;
    }
    const timer = window.setTimeout(() => setShowPublishBurst(false), 1500);
    return () => window.clearTimeout(timer);
  }, [showPublishBurst]);

  const handlePublishSoundToggle = () => {
    setPublishSoundEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem('publishSoundEnabled', String(next));
      return next;
    });
  };

  const draftSavedLabel = useMemo(() => {
    if (!sessionDraftSavedAt) {
      return '';
    }
    const date = new Date(sessionDraftSavedAt);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }, [sessionDraftSavedAt]);

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24 md:pb-0">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-10 space-y-12">
        <section id="overview" className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 sm:p-6 lg:p-8 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-on-tertiary-fixed-variant">Mentor Hub</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">Manage your sessions from one place</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
                Create a session, publish availability, and keep your teaching workspace organized.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/teach?tab=overview"
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${currentWorkspaceTab === 'overview' ? 'bg-primary text-on-primary' : 'border border-outline-variant/20 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'}`}
              >
                Overview
              </Link>
              <Link
                to="/teach?tab=sessions"
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${currentWorkspaceTab === 'sessions' ? 'bg-primary text-on-primary' : 'border border-outline-variant/20 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'}`}
              >
                Manage Sessions
              </Link>
              <Link
                to="/teach?tab=availability"
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${currentWorkspaceTab === 'availability' ? 'bg-primary text-on-primary' : 'border border-outline-variant/20 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'}`}
              >
                Availability
              </Link>
              <Link
                to="/teach?tab=verification"
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${currentWorkspaceTab === 'verification' ? 'bg-primary text-on-primary' : 'border border-outline-variant/20 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'}`}
              >
                Verification
              </Link>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Total Sessions</p>
              <p className="mt-1 text-2xl font-extrabold text-on-surface">{mentorSessions.length}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Pending Requests</p>
              <p className="mt-1 text-2xl font-extrabold text-on-surface">{requestCards.length}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Current Balance</p>
              <p className="mt-1 text-2xl font-extrabold text-on-surface">{formatCurrency(currentBalance)}</p>
            </div>
          </div>
        </section>

        <section id="sessions" className={`rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 sm:p-6 lg:p-8 shadow-sm space-y-6 ${currentWorkspaceTab !== 'sessions' ? 'opacity-80' : ''}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-on-tertiary-fixed-variant">Create Session</p>
              <h2 className="text-2xl font-bold text-on-surface">Publish a new teaching slot</h2>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <p className="text-sm text-on-surface-variant">Visible in your mentor hub and ready for learners to book.</p>
              {draftSavedLabel && (
                <span className="rounded-full border border-outline-variant/20 bg-surface-container-lowest px-3 py-1 text-xs font-semibold text-on-surface-variant">
                  Draft auto-saved at {draftSavedLabel}
                </span>
              )}
              <label className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface">
                <input
                  type="checkbox"
                  checked={publishSoundEnabled}
                  onChange={handlePublishSoundToggle}
                />
                <span>{publishSoundEnabled ? 'Publish sound on' : 'Publish sound off (default muted)'}</span>
              </label>
            </div>
          </div>
          {sessionMessage && <p className="text-sm font-semibold text-primary">{sessionMessage}</p>}
          <div className="flex flex-wrap gap-2">
            {SESSION_TEMPLATE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-high"
                onClick={() => handleApplySessionTemplate(preset.values)}
              >
                Use {preset.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <form className="grid grid-cols-1 gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 sm:p-5 xl:col-span-3 lg:grid-cols-2" onSubmit={handleCreateSession}>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">Title</span>
              <input required className={`rounded-lg border bg-surface-container-lowest px-4 py-3 ${sessionErrors.title ? 'border-red-400' : 'border-outline-variant/20'}`} value={sessionForm.title} onChange={(e) => updateSessionField('title', e.target.value)} placeholder="React Architecture Clinic" />
              {sessionErrors.title && <span className="text-xs font-semibold text-red-600">{sessionErrors.title}</span>}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">Session type</span>
              <input required className={`rounded-lg border bg-surface-container-lowest px-4 py-3 ${sessionErrors.sessionType ? 'border-red-400' : 'border-outline-variant/20'}`} value={sessionForm.sessionType} onChange={(e) => updateSessionField('sessionType', e.target.value)} placeholder="1:1 Mentoring" />
              {sessionErrors.sessionType && <span className="text-xs font-semibold text-red-600">{sessionErrors.sessionType}</span>}
            </label>
            <label className="grid gap-2 lg:col-span-2">
              <span className="text-sm font-semibold text-on-surface">Description</span>
              <textarea required rows={4} className={`rounded-lg border bg-surface-container-lowest px-4 py-3 ${sessionErrors.description ? 'border-red-400' : 'border-outline-variant/20'}`} value={sessionForm.description} onChange={(e) => updateSessionField('description', e.target.value)} placeholder="Describe the outcome, audience, and what learners should prepare." />
              {sessionErrors.description && <span className="text-xs font-semibold text-red-600">{sessionErrors.description}</span>}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">Start time</span>
              <input required type="datetime-local" className={`rounded-lg border bg-surface-container-lowest px-4 py-3 ${sessionErrors.startTime ? 'border-red-400' : 'border-outline-variant/20'}`} value={sessionForm.startTime} onChange={(e) => updateSessionField('startTime', e.target.value)} />
              {sessionErrors.startTime && <span className="text-xs font-semibold text-red-600">{sessionErrors.startTime}</span>}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">End time</span>
              <input required type="datetime-local" className={`rounded-lg border bg-surface-container-lowest px-4 py-3 ${sessionErrors.endTime ? 'border-red-400' : 'border-outline-variant/20'}`} value={sessionForm.endTime} onChange={(e) => updateSessionField('endTime', e.target.value)} />
              {sessionErrors.endTime && <span className="text-xs font-semibold text-red-600">{sessionErrors.endTime}</span>}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">Price amount</span>
              <input required type="number" min="0" step="0.01" className={`rounded-lg border bg-surface-container-lowest px-4 py-3 ${sessionErrors.priceAmount ? 'border-red-400' : 'border-outline-variant/20'}`} value={sessionForm.priceAmount} onChange={(e) => updateSessionField('priceAmount', e.target.value)} placeholder="50" />
              {sessionErrors.priceAmount && <span className="text-xs font-semibold text-red-600">{sessionErrors.priceAmount}</span>}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">Meeting link</span>
              <input className={`rounded-lg border bg-surface-container-lowest px-4 py-3 ${sessionErrors.meetingLink ? 'border-red-400' : 'border-outline-variant/20'}`} value={sessionForm.meetingLink} onChange={(e) => updateSessionField('meetingLink', e.target.value)} placeholder="https://meet.google.com/..." />
              {sessionErrors.meetingLink && <span className="text-xs font-semibold text-red-600">{sessionErrors.meetingLink}</span>}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">Cancellation window (hours)</span>
              <input type="number" min="0" className={`rounded-lg border bg-surface-container-lowest px-4 py-3 ${sessionErrors.cancellationWindowHours ? 'border-red-400' : 'border-outline-variant/20'}`} value={sessionForm.cancellationWindowHours} onChange={(e) => updateSessionField('cancellationWindowHours', e.target.value)} />
              {sessionErrors.cancellationWindowHours && <span className="text-xs font-semibold text-red-600">{sessionErrors.cancellationWindowHours}</span>}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">Reschedule window (hours)</span>
              <input type="number" min="0" className={`rounded-lg border bg-surface-container-lowest px-4 py-3 ${sessionErrors.rescheduleWindowHours ? 'border-red-400' : 'border-outline-variant/20'}`} value={sessionForm.rescheduleWindowHours} onChange={(e) => updateSessionField('rescheduleWindowHours', e.target.value)} />
              {sessionErrors.rescheduleWindowHours && <span className="text-xs font-semibold text-red-600">{sessionErrors.rescheduleWindowHours}</span>}
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">Max participants</span>
              <input type="number" min="1" className={`rounded-lg border bg-surface-container-lowest px-4 py-3 ${sessionErrors.maxParticipants ? 'border-red-400' : 'border-outline-variant/20'}`} value={sessionForm.maxParticipants} onChange={(e) => updateSessionField('maxParticipants', e.target.value)} />
              {sessionErrors.maxParticipants && <span className="text-xs font-semibold text-red-600">{sessionErrors.maxParticipants}</span>}
            </label>
            <div className="flex items-end lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <button type="submit" className="rounded-lg bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:opacity-90">Review and create session</button>
                <button type="button" className="rounded-lg border border-outline-variant/20 px-5 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-high" onClick={handleResetSessionForm}>Clear form</button>
              </div>
            </div>
            </form>

            <aside className="space-y-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 sm:p-5 xl:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-on-surface">Scheduled Sessions</h3>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{mentorSessionCards.length}</span>
              </div>
              {mentorSessionCards.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No sessions yet. Publish your first one using the form.</p>
              ) : (
                <div className="space-y-3">
                  {mentorSessionCards.map((item) => (
                    <article key={item.id} className="rounded-xl border border-outline-variant/15 bg-surface-container px-4 py-3">
                      <p className="text-sm font-bold text-on-surface">{item.title}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{item.type} • {item.schedule}</p>
                      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                        <span>{item.amount}</span>
                        <span>{item.participants} seats</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </section>

        <section id="availability" className={`rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 sm:p-6 lg:p-8 shadow-sm space-y-6 ${currentWorkspaceTab !== 'availability' ? 'opacity-80' : ''}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-on-tertiary-fixed-variant">Availability</p>
              <h2 className="text-2xl font-bold text-on-surface">Publish your teaching windows</h2>
            </div>
            <p className="text-sm text-on-surface-variant">This helps learners find a matching time slot before booking.</p>
          </div>
          {availabilityMessage && <p className="text-sm font-semibold text-primary">{availabilityMessage}</p>}
          <form className="grid grid-cols-1 gap-4 lg:grid-cols-4" onSubmit={handleAddAvailabilitySlot}>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">Day of week</span>
              <select className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-3" value={availabilityForm.dayOfWeek} onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, dayOfWeek: e.target.value }))}>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
                <option value={7}>Sunday</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">Start time</span>
              <input type="time" className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-3" value={availabilityForm.startTime} onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, startTime: e.target.value }))} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">End time</span>
              <input type="time" className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-3" value={availabilityForm.endTime} onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, endTime: e.target.value }))} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-on-surface">Timezone</span>
              <input className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-3" value={availabilityForm.timezone} onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, timezone: e.target.value }))} />
            </label>
            <div className="flex items-end lg:col-span-4">
              <button type="submit" className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-5 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-high">Add availability</button>
            </div>
          </form>
          <div className="space-y-3">
            {availabilitySlots.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No availability slots yet. Add one above so learners can book your sessions.</p>
            ) : availabilitySlots.slice(0, 4).map((slot) => (
              <div key={slot.id} className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant/10 bg-surface-container-high px-4 py-3">
                <div>
                  <p className="font-semibold text-on-surface">Day {slot.dayOfWeek}: {slot.startTime} - {slot.endTime}</p>
                  <p className="text-xs text-on-surface-variant">{slot.timezone}</p>
                </div>
                <button type="button" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-low" onClick={() => handleDeleteAvailabilitySlot(slot.id)}>Remove</button>
              </div>
            ))}
          </div>
        </section>

        <section id="verification" className={`rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 sm:p-6 lg:p-8 shadow-sm space-y-3 ${currentWorkspaceTab !== 'verification' ? 'opacity-80' : ''}`}>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-on-tertiary-fixed-variant">Verification</p>
          <h2 className="text-2xl font-bold text-on-surface">Keep your mentor verification active</h2>
          <p className="text-sm text-on-surface-variant max-w-3xl">
            If you clicked verification from the mentor hub, this section is where you can review the status and keep the rest of the workspace focused on session management.
          </p>
          <Link to="/home" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:opacity-90">Back to Mentor Hub</Link>
        </section>

        {loadError && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <button
                type="button"
                className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                onClick={() => setReloadKey((prev) => prev + 1)}
              >
                Retry load
              </button>
            </div>
          </section>
        )}

        {currentWorkspaceTab === 'overview' && (
        <>
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-tertiary-fixed-variant">Instructor Overview</p>
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-on-surface sm:text-5xl lg:text-7xl">Your Performance Hub</h1>
            <p className="max-w-xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
              {loading
                ? 'Syncing teaching workspace with live backend data...'
                : `Welcome back ${String(profile?.fullName || 'Mentor').split(' ')[0]}. You currently have ${requestCards.length} pending session requests.`}
            </p>
            {actionMessage && <p className="mt-3 text-sm text-primary font-semibold">{actionMessage}</p>}
          </div>

          <div className="lg:col-span-4">
            <div className="rounded-2xl bg-primary p-6 sm:p-8 text-on-primary shadow-lg">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-primary-fixed/80">Current Balance</p>
                  <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{formatCurrency(currentBalance)}</h2>
                </div>
                <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
              </div>
              <div className="flex items-center gap-2 font-medium text-primary-fixed">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                <span>{formatCurrency(monthlyGrowth)} this month</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex h-full flex-col rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 sm:p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-on-surface">Session Requests</h3>
              <span className="rounded-full bg-tertiary-fixed px-3 py-1 text-xs font-bold text-on-tertiary-fixed">{requestCards.length} NEW</span>
            </div>
            <div className="flex flex-1 flex-col gap-4">
              {requestCards.length === 0 ? (
                <div>
                  <p className="text-sm text-on-surface-variant">No pending requests. New bookings will appear here automatically.</p>
                  <p className="mt-2 text-xs text-on-surface-variant">Tip: keep your session slots active in the sessions tab to receive requests.</p>
                </div>
              ) : requestCards.map((request) => (
                <div key={request.id} className="group rounded-lg bg-surface-container-lowest p-4 transition-all hover:shadow-md">
                  <div className="flex items-center gap-4">
                    {request.avatar ? (
                      <img alt={request.name} className="h-12 w-12 rounded-full object-cover flex-none" src={request.avatar} />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary flex-none">
                        {String(request.name).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-bold text-on-surface">{request.name}</h4>
                      <p className="truncate text-xs text-on-surface-variant">{request.topic}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-on-surface-variant italic">"{request.note}"</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="rounded-lg bg-primary py-2 text-xs font-bold text-on-primary" type="button" onClick={() => handleBookingAction(request.id, 'ACCEPTED')}>Accept</button>
                    <button className="rounded-lg bg-surface-container py-2 text-xs font-bold text-on-surface-variant" type="button" onClick={() => handleBookingAction(request.id, 'REJECTED')}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 sm:p-6 lg:col-span-2 lg:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-2xl font-bold text-on-surface">Upcoming Sessions</h3>
              <div className="flex gap-2">
                <button
                  className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${scheduleView === 'today' ? 'bg-surface-container-low text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  type="button"
                  onClick={() => setScheduleView('today')}
                >
                  Today
                </button>
                <button
                  className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${scheduleView === 'week' ? 'bg-surface-container-low text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  type="button"
                  onClick={() => setScheduleView('week')}
                >
                  Week
                </button>
              </div>
            </div>
            <div className="relative space-y-8 border-l-2 border-surface-dim pl-6 sm:pl-8">
              {upcomingSessions.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No upcoming sessions yet.</p>
              ) : upcomingSessions.map((session) => (
                <article key={session.id} className="relative">
                  <div className={`absolute -left-[29px] top-1 h-4 w-4 rounded-full ${session.primary ? 'bg-primary' : 'bg-outline-variant'} ring-4 ring-surface-container-lowest`} />
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-on-tertiary-fixed-variant">{session.time}</span>
                      <h4 className="text-lg font-bold text-on-surface">{session.title}</h4>
                      <p className="text-sm text-on-surface-variant">{session.subtitle}</p>
                    </div>
                    <button
                      className={`rounded-lg px-6 py-2.5 text-sm font-bold transition-all active:scale-95 ${session.primary ? 'bg-primary text-on-primary hover:opacity-90' : 'border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'}`}
                      type="button"
                      onClick={() => {
                        const feedback = showInfoFeedback({ key: 'sessionOpened', params: { name: session.title }, notify });
                        setActionMessage(feedback.message);
                      }}
                    >
                      {session.primary ? 'Join Session' : 'View Details'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 sm:p-6 md:col-span-2 lg:col-span-2">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-xl font-bold text-on-surface">Active Student Progress</h3>
              <span className="material-symbols-outlined text-primary">query_stats</span>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-end justify-between gap-4">
                  <span className="text-xs font-bold uppercase text-on-surface-variant">Avg. Completion</span>
                  <span className="text-sm font-bold text-primary">{avgCompletion}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-outline-variant/20">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, avgCompletion))}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-end justify-between gap-4">
                  <span className="text-xs font-bold uppercase text-on-surface-variant">Course Satisfaction</span>
                  <span className="text-sm font-bold text-primary">4.9/5</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-outline-variant/20">
                  <div className="h-full w-[94%] bg-primary" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-highest/30 p-5 sm:p-6 md:col-span-1 lg:col-span-1 flex flex-col justify-center">
            <p className="mb-1 text-sm text-on-surface-variant">Total Active Learners</p>
            <h4 className="text-4xl font-extrabold text-on-surface">{activeLearners}</h4>
            <p className="mt-3 text-xs text-on-surface-variant">Live count from accepted and pending mentor bookings.</p>
          </div>
        </section>
        </>
        )}
      </main>

      {showPublishBurst && (
        <div className="session-publish-burst" role="status" aria-live="polite">
          <span className="material-symbols-outlined" aria-hidden="true">celebration</span>
          <span className="session-publish-burst-label">Session published</span>
        </div>
      )}

      {showSessionConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-tertiary-fixed-variant">Confirm Session</p>
                <h3 className="mt-2 text-xl font-bold text-on-surface">Ready to publish this session?</h3>
              </div>
              <button
                type="button"
                className="rounded-lg border border-outline-variant/20 px-2 py-1 text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
                onClick={() => setShowSessionConfirmModal(false)}
                disabled={creatingSession}
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-on-surface-variant">Title</span>
                <span className="font-bold text-on-surface">{sessionForm.title || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-on-surface-variant">Session type</span>
                <span className="font-bold text-on-surface">{sessionForm.sessionType || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-on-surface-variant">Time</span>
                <span className="font-bold text-on-surface">{formatTimeRange(sessionForm.startTime, sessionForm.endTime)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-on-surface-variant">Price</span>
                <span className="font-bold text-on-surface">{formatCurrency(sessionForm.priceAmount || 0)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-on-surface-variant">Participants</span>
                <span className="font-bold text-on-surface">{sessionForm.maxParticipants || 1}</span>
              </div>
            </div>

            <p className="mt-4 text-xs text-on-surface-variant">
              You can edit meeting links and details later from Manage Sessions.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
                onClick={() => setShowSessionConfirmModal(false)}
                disabled={creatingSession}
              >
                Back to edit
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:opacity-90 disabled:opacity-70"
                onClick={submitCreateSession}
                disabled={creatingSession}
              >
                {creatingSession ? 'Publishing...' : 'Confirm and publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
