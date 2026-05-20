import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import client from '../api/client';
import SearchFilters from '../components/SearchFilters';
import DateTimePicker from '../components/DateTimePicker';
import { SkeletonDashboard, SkeletonMentorGrid } from '../components/SkeletonLoaders';
import EmptyStateCard from '../components/dashboard/EmptyStateCard';
import OptimizedImage from '../components/OptimizedImage';
import { getProfileQualityScore, parseSkillTags } from '../utils/profileSkills';
import { t } from '../utils/i18n';
import { getErrorFeedback, getInfoFeedback, showInfoFeedback } from '../utils/comingSoon';

const ALLOWED_MENTOR_SORTS = new Set(['score', 'skillMatch', 'rating', 'completion']);

const parseMentorScore = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(100, parsed) : 0;
};

export default function Dashboard({ onLogout, language, page = 'mentors', notify }) {
  const navigate = useNavigate();
  const changeLanguage = () => {
    const next = (localStorage.getItem('language') || 'en') === 'en' ? 'hi' : 'en';
    localStorage.setItem('language', next);
    window.location.reload();
  };
  const requireLoginAndGo = (target) => {
    if (localStorage.getItem('token')) {
      navigate(target);
      return;
    }
    localStorage.setItem('auth_post_redirect', target);
    navigate('/login');
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMentorQuery = String(searchParams.get('q') || '').trim();
  const initialMentorSort = ALLOWED_MENTOR_SORTS.has(searchParams.get('sort')) ? searchParams.get('sort') : 'score';
  const initialMentorMinScore = parseMentorScore(searchParams.get('minScore'));
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [skillsCatalog, setSkillsCatalog] = useState([]);
  const [sessionPackages, setSessionPackages] = useState([]);
  const [roadmaps, setRoadmaps] = useState([]);
  const [verificationTasks, setVerificationTasks] = useState([]);
  const [verificationSubmissions, setVerificationSubmissions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [savedMentors, setSavedMentors] = useState([]);
  const [watchedSkills, setWatchedSkills] = useState([]);
  const [watchSkillInput, setWatchSkillInput] = useState('');
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [availabilityForm, setAvailabilityForm] = useState({ dayOfWeek: '1', startTime: '18:00', endTime: '20:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
  const [overlapMentorId, setOverlapMentorId] = useState('');
  const [overlapSlots, setOverlapSlots] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [reportForm, setReportForm] = useState({ reportedUserId: '', targetType: 'CHAT', targetId: '', reason: '', details: '' });
  const [safetyMessage, setSafetyMessage] = useState('');
  const [myReports, setMyReports] = useState([]);
  const [moderationReports, setModerationReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState(initialMentorQuery);
  const [mentorSearchResults, setMentorSearchResults] = useState([]);
  const [mentorSortBy, setMentorSortBy] = useState(initialMentorSort);
  const [mentorMinScore, setMentorMinScore] = useState(initialMentorMinScore);
  const [mentorSearchLoading, setMentorSearchLoading] = useState(false);
  const [mentorSearchMessage, setMentorSearchMessage] = useState('');
  const [visibleMentorResultsCount, setVisibleMentorResultsCount] = useState(8);
  const [recentSearches, setRecentSearches] = useState([]);
  const [savedSearchFilters, setSavedSearchFilters] = useState([]);
  const [recommendedMentors, setRecommendedMentors] = useState([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationMessage, setRecommendationMessage] = useState('');
  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [meetingLinks, setMeetingLinks] = useState({});
  const [portfolioForm, setPortfolioForm] = useState({ projects: '', certificates: '', pastTeachingSessions: '' });
  const [portfolioMessage, setPortfolioMessage] = useState('');
  const [packageForm, setPackageForm] = useState({ title: '', description: '', sessionCount: '', discountPercent: '', totalPrice: '' });
  const [packageMessage, setPackageMessage] = useState('');
  const [taskForm, setTaskForm] = useState({ skillName: '', title: '', instructions: '' });
  const [taskMessage, setTaskMessage] = useState('');
  const [mentorVerificationForm, setMentorVerificationForm] = useState({ documentUrl: '', documentType: 'ID_PROOF' });
  const [mentorVerificationRequests, setMentorVerificationRequests] = useState([]);
  const [mentorVerificationQueue, setMentorVerificationQueue] = useState([]);
  const [verificationWorkflowMessage, setVerificationWorkflowMessage] = useState('');
  const [mentorLearnerReviewForm, setMentorLearnerReviewForm] = useState({ learnerId: '', bookingId: '', rating: '5', comment: '' });
  const [verificationAnswers, setVerificationAnswers] = useState({});
  const [verificationMessage, setVerificationMessage] = useState('');
  const [watchlistMessage, setWatchlistMessage] = useState('');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [recommendedOverlapSlots, setRecommendedOverlapSlots] = useState([]);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [paymentForm, setPaymentForm] = useState({ bookingId: '', amount: '', mode: 'UPI' });
  const [paymentError, setPaymentError] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [bookingActionMessage, setBookingActionMessage] = useState('');
  const [selectedSessionDate, setSelectedSessionDate] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [referralData, setReferralData] = useState(null);
  const wsRef = useRef(null);
  const mentorLoadMoreRef = useRef(null);
  const didRestoreMentorQueryRef = useRef(false);

  const token = localStorage.getItem('token');
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const wsBase = useMemo(() => apiBase.replace(/^http/, 'ws'), [apiBase]);
  const userTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const isDiscoverPage = false;
  const isSessionsPage = page === 'sessions';
  const isMentorsPage = page === 'mentors';
  const isWalletPage = page === 'wallet';

  const formatSessionDateTime = useCallback((value) => {
    if (!value) {
      return 'TBD';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: userTimezone
    }).format(date);
  }, [userTimezone]);

  const toDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const nextQuery = String(searchParams.get('q') || '').trim();
    const nextSort = ALLOWED_MENTOR_SORTS.has(searchParams.get('sort')) ? searchParams.get('sort') : 'score';
    const nextMinScore = parseMentorScore(searchParams.get('minScore'));

    if (nextQuery !== searchQuery) {
      setSearchQuery(nextQuery);
    }
    if (nextSort !== mentorSortBy) {
      setMentorSortBy(nextSort);
    }
    if (nextMinScore !== mentorMinScore) {
      setMentorMinScore(nextMinScore);
    }
  }, [mentorMinScore, mentorSortBy, searchParams, searchQuery]);

  useEffect(() => {
    const currentQuery = String(searchParams.get('q') || '').trim();
    const currentSort = ALLOWED_MENTOR_SORTS.has(searchParams.get('sort')) ? searchParams.get('sort') : 'score';
    const currentMinScore = parseMentorScore(searchParams.get('minScore'));

    const nextQuery = String(searchQuery || '').trim();
    const nextSort = ALLOWED_MENTOR_SORTS.has(mentorSortBy) ? mentorSortBy : 'score';
    const nextMinScore = parseMentorScore(mentorMinScore);

    if (currentQuery === nextQuery && currentSort === nextSort && currentMinScore === nextMinScore) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (nextQuery) {
      nextParams.set('q', nextQuery);
    } else {
      nextParams.delete('q');
    }

    if (nextSort && nextSort !== 'score') {
      nextParams.set('sort', nextSort);
    } else {
      nextParams.delete('sort');
    }

    if (nextMinScore > 0) {
      nextParams.set('minScore', String(nextMinScore));
    } else {
      nextParams.delete('minScore');
    }

    setSearchParams(nextParams, { replace: true });
  }, [mentorMinScore, mentorSortBy, searchParams, searchQuery, setSearchParams]);

  useEffect(() => {
    if (!isMentorsPage || didRestoreMentorQueryRef.current) {
      return;
    }

    const restoredQuery = String(searchQuery || '').trim();
    if (!restoredQuery) {
      return;
    }

    didRestoreMentorQueryRef.current = true;
    runMentorSearch(restoredQuery, { skipRecent: true });
  }, [isMentorsPage, runMentorSearch, searchQuery]);

  useEffect(() => {
    const load = async () => {
      try {
        const results = await Promise.allSettled([
          client.get('/api/v1/users/me'),
          client.get('/api/v1/skills'),
          client.get('/api/v1/sessions'),
          client.get('/api/v1/bookings'),
          client.get('/api/v1/payments'),
          client.get('/api/v1/session-packages'),
          client.get('/api/v1/roadmaps'),
          client.get('/api/v1/verification/tasks'),
          client.get('/api/v1/verification/submissions'),
          client.get('/api/v1/notifications'),
          client.get('/api/v1/notifications/unread-count'),
          client.get('/api/v1/watchlist/mentors'),
          client.get('/api/v1/watchlist/skills'),
          client.get('/api/v1/availability/my-slots'),
          client.get('/api/v1/safety/blocked')
        ]);

        const getData = (index, fallback) => {
          const result = results[index];
          if (result.status === 'fulfilled') {
            return result.value?.data?.data ?? fallback;
          }
          return fallback;
        };

        const currentProfile = getData(0, null);
        // Set profile even if it's null - allows component to render
        setProfile(currentProfile || { id: 'guest', fullName: 'Guest', email: 'loading...' });
        
        if (currentProfile) {
          setPortfolioForm({
            projects: currentProfile?.projects || '',
            certificates: currentProfile?.certificates || '',
            pastTeachingSessions: currentProfile?.pastTeachingSessions || ''
          });
        }
        
        setSkillsCatalog(getData(1, []));
        const sessionList = getData(2, []);
        const bookingList = getData(3, []);
        setPayments(getData(4, []));
        setSessionPackages(getData(5, []));
        setRoadmaps(getData(6, []));
        setVerificationTasks(getData(7, []));
        setVerificationSubmissions(getData(8, []));
        setNotifications(getData(9, []));
        setUnreadNotifications(getData(10, 0));
        setSavedMentors(getData(11, []));
        setWatchedSkills(getData(12, []));
        setAvailabilitySlots(getData(13, []));
        setBlockedUsers(getData(14, []));
        setSessions(sessionList);
        setBookings(bookingList);
        setSelectedBookingId((current) => current || (bookingList[0] ? String(bookingList[0].id) : ''));

        const initialMeetingLinks = {};
        sessionList.forEach((session) => {
          initialMeetingLinks[session.id] = session.meetingLink || '';
        });
        setMeetingLinks(initialMeetingLinks);

        const mentorCandidate = sessionList.find((session) => session.mentor?.id && session.mentor.id !== currentProfile?.id);
        setOverlapMentorId((current) => current || (mentorCandidate ? String(mentorCandidate.mentor.id) : ''));
        
        setPaymentError(!currentProfile ? getErrorFeedback('dashboardReducedFeaturesProfilePending').message : '');
      } catch (error) {
        setPaymentError(getErrorFeedback('dashboardLoadingBasicView').message);
        setProfile({ id: 'error', fullName: 'Unable to load', email: 'error@skillswap' });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [onLogout]);

  useEffect(() => {
    if (!selectedBookingId || !token) {
      return undefined;
    }

    let isMounted = true;
    setChatError('');

    const loadHistory = async () => {
      const response = await client.get(`/api/v1/chat/booking/${selectedBookingId}`);
      if (isMounted) {
        setChatMessages(response.data.data || []);
      }
    };

    loadHistory().catch(() => {
      if (isMounted) {
        setChatError(getErrorFeedback('dashboardChatHistoryLoadFailed').message);
      }
    });

    const socket = new WebSocket(
      `${wsBase}/ws/chat?token=${encodeURIComponent(token)}&bookingId=${encodeURIComponent(selectedBookingId)}`
    );
    wsRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const incoming = JSON.parse(event.data);
        setChatMessages((prev) => {
          if (prev.some((msg) => msg.id === incoming.id)) {
            return prev;
          }
          return [...prev, incoming];
        });
      } catch {
        setChatError(getErrorFeedback('dashboardRealtimeMalformedMessage').message);
      }
    };

    socket.onerror = () => {
      setChatError(getErrorFeedback('dashboardRealtimeConnectionError').message);
    };

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedBookingId, token, wsBase]);

  useEffect(() => {
    let isMounted = true;

    const refreshNotifications = async () => {
      try {
        const [listRes, countRes] = await Promise.all([
          client.get('/api/v1/notifications'),
          client.get('/api/v1/notifications/unread-count')
        ]);
        if (!isMounted) {
          return;
        }
        setNotifications(listRes.data.data || []);
        setUnreadNotifications(countRes.data.data || 0);
      } catch {
        // Non-blocking polling failure
      }
    };

    const interval = setInterval(refreshNotifications, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    let isMounted = true;
    const loadTrustData = async () => {
      try {
        const [myReportsRes, mentorReqRes] = await Promise.all([
          client.get('/api/v1/safety/reports'),
          client.get('/api/v1/verification/mentor/my')
        ]);
        if (!isMounted) {
          return;
        }
        setMyReports(myReportsRes?.data?.data || []);
        setMentorVerificationRequests(mentorReqRes?.data?.data || []);

        if (profile.role === 'ADMIN') {
          const [moderationReportsRes, verificationQueueRes] = await Promise.all([
            client.get('/api/v1/safety/reports', { params: { moderationQueue: true, status: 'OPEN' } }),
            client.get('/api/v1/verification/mentor/requests', { params: { status: 'PENDING' } })
          ]);
          if (!isMounted) {
            return;
          }
          setModerationReports(moderationReportsRes?.data?.data || []);
          setMentorVerificationQueue(verificationQueueRes?.data?.data || []);
        }
      } catch {
        // Non-blocking trust data fetch
      }
    };

    loadTrustData();
    return () => {
      isMounted = false;
    };
  }, [profile?.id, profile?.role]);

  const handlePaymentChange = (event) => {
    const { name, value } = event.target;
    setPaymentForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreatePayment = async (event) => {
    event.preventDefault();
    setPaymentError('');
    try {
      const response = await client.post('/api/v1/payments/intent', {
        bookingId: Number(paymentForm.bookingId),
        amount: Number(paymentForm.amount),
        mode: paymentForm.mode
      });
      setPayments((prev) => [response.data.data, ...prev]);
      setPaymentForm((prev) => ({ ...prev, amount: '' }));
    } catch {
      setPaymentError(getErrorFeedback('paymentIntentCreateFailed').message);
    }
  };

  const handleUpdatePaymentStatus = async (paymentId, status) => {
    try {
      const response = await client.patch(`/api/v1/payments/${paymentId}/status`, { status });
      setPayments((prev) => prev.map((payment) => (payment.id === paymentId ? response.data.data : payment)));
    } catch {
      setPaymentError(getErrorFeedback('paymentStatusUpdateFailed').message);
    }
  };

  const handleBookingStatusUpdate = async (bookingId, status, message) => {
    setBookingActionMessage('');
    try {
      const response = await client.patch(`/api/v1/bookings/${bookingId}/status`, { status });
      const updatedBooking = response.data.data;
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updatedBooking : b)));
      setBookingActionMessage(message || `Booking updated to ${status}.`);
    } catch (err) {
      const backendError = err?.response?.data?.data?.error;
      setBookingActionMessage(backendError || getErrorFeedback('dashboardBookingStatusUpdateFailed').message);
    }
  };

  const handleMeetingLinkSave = async (sessionId) => {
    try {
      const response = await client.patch(`/api/v1/sessions/${sessionId}/meeting-link`, {
        meetingLink: meetingLinks[sessionId]
      });
      setSessions((prev) => prev.map((session) => (session.id === sessionId ? response.data.data : session)));
    } catch {
      setPaymentError(getErrorFeedback('saveMeetingLinkFailed').message);
    }
  };

  const handlePortfolioSave = async (event) => {
    event.preventDefault();
    setPortfolioMessage('');
    try {
      const response = await client.put('/api/v1/users/me/profile', {
        projects: portfolioForm.projects,
        certificates: portfolioForm.certificates,
        pastTeachingSessions: portfolioForm.pastTeachingSessions
      });
      setProfile(response.data.data);
      setPortfolioMessage(getInfoFeedback('portfolioSaved').message);
    } catch {
      setPortfolioMessage(getErrorFeedback('savePortfolioFailed').message);
    }
  };

  const handlePackageCreate = async (event) => {
    event.preventDefault();
    setPackageMessage('');
    try {
      const response = await client.post('/api/v1/session-packages', {
        title: packageForm.title,
        description: packageForm.description,
        sessionCount: Number(packageForm.sessionCount),
        discountPercent: Number(packageForm.discountPercent),
        totalPrice: Number(packageForm.totalPrice)
      });
      setSessionPackages((prev) => [response.data.data, ...prev]);
      setPackageForm({ title: '', description: '', sessionCount: '', discountPercent: '', totalPrice: '' });
      setPackageMessage(getInfoFeedback('sessionPackageCreated').message);
    } catch {
      setPackageMessage(getErrorFeedback('createPackageFailed').message);
    }
  };

  const handleTaskCreate = async (event) => {
    event.preventDefault();
    setTaskMessage('');
    try {
      const response = await client.post('/api/v1/verification/tasks', taskForm);
      setVerificationTasks((prev) => [response.data.data, ...prev]);
      setTaskForm({ skillName: '', title: '', instructions: '' });
      setTaskMessage(getInfoFeedback('verificationTaskCreated').message);
    } catch {
      setTaskMessage(getErrorFeedback('createVerificationTaskFailed').message);
    }
  };

  const handleVerificationSubmit = async (taskId) => {
    const submissionText = String(verificationAnswers[taskId] || '').trim();
    if (!submissionText) {
      return;
    }

    setVerificationMessage('');
    try {
      const response = await client.post(`/api/v1/verification/tasks/${taskId}/submit`, { submissionText });
      setVerificationSubmissions((prev) => [response.data.data, ...prev]);
      setVerificationAnswers((prev) => ({ ...prev, [taskId]: '' }));
      setVerificationMessage(getInfoFeedback('verificationTaskSubmitted').message);
    } catch {
      setVerificationMessage(getErrorFeedback('submitVerificationTaskFailed').message);
    }
  };

  const handleReviewSubmission = async (submissionId, status) => {
    setVerificationMessage('');
    try {
      const response = await client.patch(`/api/v1/verification/submissions/${submissionId}`, { status });
      setVerificationSubmissions((prev) => prev.map((s) => (s.id === submissionId ? response.data.data : s)));
      if (status === 'APPROVED') {
        const me = await client.get('/api/v1/users/me');
        setProfile(me.data.data);
      }
      setVerificationMessage(getInfoFeedback('verificationSubmissionMarked', { status }).message);
    } catch {
      setVerificationMessage(getErrorFeedback('reviewVerificationSubmissionFailed').message);
    }
  };

  const handleRoadmapUpdate = async (roadmapId, progressPercent) => {
    try {
      const response = await client.patch(`/api/v1/roadmaps/${roadmapId}`, {
        progressPercent: Number(progressPercent)
      });
      setRoadmaps((prev) => prev.map((roadmap) => (roadmap.id === roadmapId ? response.data.data : roadmap)));
    } catch {
      setVerificationMessage(getErrorFeedback('updateRoadmapProgressFailed').message);
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    setNotificationMessage('');
    try {
      await client.patch(`/api/v1/notifications/${notificationId}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
    } catch {
      setNotificationMessage(getErrorFeedback('markNotificationReadFailed').message);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotificationMessage('');
    try {
      await client.patch('/api/v1/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadNotifications(0);
    } catch {
      setNotificationMessage(getErrorFeedback('markAllNotificationsReadFailed').message);
    }
  };

  const handleSaveMentor = async (mentorId) => {
    setWatchlistMessage('');
    try {
      const response = await client.post(`/api/v1/watchlist/mentors/${mentorId}`);
      setSavedMentors((prev) => [response.data.data, ...prev]);
      setWatchlistMessage(getInfoFeedback('watchlistMentorSaved').message);
    } catch (err) {
      setWatchlistMessage(err?.response?.data?.data?.error || getErrorFeedback('watchlistSaveMentorFailed').message);
    }
  };

  const handleRemoveMentor = async (mentorId) => {
    setWatchlistMessage('');
    try {
      await client.delete(`/api/v1/watchlist/mentors/${mentorId}`);
      setSavedMentors((prev) => prev.filter((item) => item.mentor?.id !== mentorId));
    } catch {
      setWatchlistMessage(getErrorFeedback('watchlistRemoveMentorFailed').message);
    }
  };

  const handleAddWatchSkill = async () => {
    const normalized = watchSkillInput.trim();
    if (!normalized) {
      return;
    }

    setWatchlistMessage('');
    try {
      const response = await client.post('/api/v1/watchlist/skills', { skillName: normalized });
      setWatchedSkills((prev) => [response.data.data, ...prev]);
      setWatchSkillInput('');
      setWatchlistMessage(getInfoFeedback('watchlistSkillAdded').message);
    } catch (err) {
      setWatchlistMessage(err?.response?.data?.data?.error || getErrorFeedback('watchlistAddSkillFailed').message);
    }
  };

  const handleRemoveWatchSkill = async (skillName) => {
    setWatchlistMessage('');
    try {
      await client.delete(`/api/v1/watchlist/skills/${encodeURIComponent(skillName)}`);
      setWatchedSkills((prev) => prev.filter((item) => String(item.skillName).toLowerCase() !== String(skillName).toLowerCase()));
    } catch {
      setWatchlistMessage(getErrorFeedback('watchlistRemoveSkillFailed').message);
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
        timezone: availabilityForm.timezone
      });
      setAvailabilitySlots((prev) => [...prev, response.data.data]);
      setAvailabilityMessage(getInfoFeedback('availabilitySlotAdded').message);
    } catch (err) {
      setAvailabilityMessage(err?.response?.data?.data?.error || getErrorFeedback('availabilityAddSlotFailed').message);
    }
  };

  const handleDeleteAvailabilitySlot = async (slotId) => {
    setAvailabilityMessage('');
    try {
      await client.delete(`/api/v1/availability/my-slots/${slotId}`);
      setAvailabilitySlots((prev) => prev.filter((slot) => slot.id !== slotId));
    } catch {
      setAvailabilityMessage(getErrorFeedback('availabilityDeleteSlotFailed').message);
    }
  };

  const handleFindOverlapSlots = async () => {
    if (!overlapMentorId) {
      return;
    }
    setAvailabilityMessage('');
    try {
      const response = await client.get('/api/v1/availability/overlap', {
        params: {
          mentorId: Number(overlapMentorId),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        }
      });
      setOverlapSlots(response.data.data || []);
    } catch (err) {
      setAvailabilityMessage(err?.response?.data?.data?.error || getErrorFeedback('availabilityOverlapFetchFailed').message);
    }
  };

  const handleRecommendOverlapSlots = async () => {
    if (!overlapMentorId) {
      return;
    }
    setAvailabilityMessage('');
    try {
      const response = await client.get('/api/v1/availability/recommendations', {
        params: {
          mentorId: Number(overlapMentorId),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        }
      });
      setRecommendedOverlapSlots(response.data.data || []);
    } catch (err) {
      setRecommendedOverlapSlots([]);
      setAvailabilityMessage(err?.response?.data?.data?.error || getErrorFeedback('availabilityRecommendationsFetchFailed').message);
    }
  };

  const handleBlockUser = async (userId) => {
    setSafetyMessage('');
    try {
      const response = await client.post(`/api/v1/safety/block/${userId}`, { reason: 'Blocked from dashboard' });
      setBlockedUsers((prev) => [response.data.data, ...prev]);
      setSafetyMessage(getInfoFeedback('safetyUserBlocked').message);
    } catch (err) {
      setSafetyMessage(err?.response?.data?.data?.error || getErrorFeedback('safetyBlockUserFailed').message);
    }
  };

  const handleSubmitReport = async (event) => {
    event.preventDefault();
    setSafetyMessage('');
    try {
      await client.post('/api/v1/safety/report', {
        reportedUserId: Number(reportForm.reportedUserId),
        targetType: reportForm.targetType,
        targetId: reportForm.targetId ? Number(reportForm.targetId) : null,
        reason: reportForm.reason,
        details: reportForm.details
      });
      setReportForm({ reportedUserId: '', targetType: 'CHAT', targetId: '', reason: '', details: '' });
      const reportsRes = await client.get('/api/v1/safety/reports');
      setMyReports(reportsRes?.data?.data || []);
      setSafetyMessage(getInfoFeedback('safetyReportSubmitted').message);
    } catch (err) {
      setSafetyMessage(err?.response?.data?.data?.error || getErrorFeedback('safetySubmitReportFailed').message);
    }
  };

  const handleEscalateReport = async (reportId) => {
    setSafetyMessage('');
    try {
      await client.patch(`/api/v1/safety/reports/${reportId}/escalate`, {
        level: 2,
        reason: 'Escalated by admin from dashboard moderation queue'
      });
      const moderationRes = await client.get('/api/v1/safety/reports', { params: { moderationQueue: true, status: 'OPEN' } });
      setModerationReports(moderationRes?.data?.data || []);
      setSafetyMessage(getInfoFeedback('safetyReportEscalated').message);
    } catch (err) {
      setSafetyMessage(err?.response?.data?.data?.error || getErrorFeedback('safetyEscalateReportFailed').message);
    }
  };

  const handleSubmitMentorVerification = async (event) => {
    event.preventDefault();
    setVerificationWorkflowMessage('');
    try {
      await client.post('/api/v1/verification/mentor/request', mentorVerificationForm);
      const myReqRes = await client.get('/api/v1/verification/mentor/my');
      setMentorVerificationRequests(myReqRes?.data?.data || []);
      setVerificationWorkflowMessage(getInfoFeedback('mentorVerificationSubmitted').message);
      setMentorVerificationForm((prev) => ({ ...prev, documentUrl: '' }));
    } catch (err) {
      setVerificationWorkflowMessage(err?.response?.data?.data?.error || getErrorFeedback('mentorVerificationSubmitFailed').message);
    }
  };

  const handleReviewMentorVerification = async (requestId, status) => {
    setVerificationWorkflowMessage('');
    try {
      await client.patch(`/api/v1/verification/mentor/requests/${requestId}`, {
        status,
        adminNote: status === 'APPROVED' ? 'Approved from dashboard' : 'Rejected from dashboard'
      });
      const queueRes = await client.get('/api/v1/verification/mentor/requests', { params: { status: 'PENDING' } });
      setMentorVerificationQueue(queueRes?.data?.data || []);
      setVerificationWorkflowMessage(getInfoFeedback('mentorVerificationMarked', { status }).message);
    } catch (err) {
      setVerificationWorkflowMessage(err?.response?.data?.data?.error || getErrorFeedback('mentorVerificationUpdateFailed').message);
    }
  };

  const handleSubmitLearnerReview = async (event) => {
    event.preventDefault();
    setVerificationWorkflowMessage('');
    try {
      await client.post('/api/v1/reviews/learner', {
        bookingId: Number(mentorLearnerReviewForm.bookingId),
        mentorId: Number(mentorLearnerReviewForm.learnerId),
        rating: Number(mentorLearnerReviewForm.rating),
        comment: mentorLearnerReviewForm.comment
      });
      setVerificationWorkflowMessage(getInfoFeedback('learnerReviewSubmitted').message);
      setMentorLearnerReviewForm((prev) => ({ ...prev, comment: '' }));
    } catch (err) {
      setVerificationWorkflowMessage(err?.response?.data?.data?.error || getErrorFeedback('learnerReviewSubmitFailed').message);
    }
  };

  const runMentorSearch = useCallback(async (queryOverride, options = {}) => {
    const finalQuery = String(queryOverride ?? searchQuery ?? '').trim();
    setMentorSearchLoading(true);
    setMentorSearchMessage('');
    try {
      const response = await client.get('/api/v1/search/mentors', {
        params: { q: finalQuery, limit: 100 }
      });
      setMentorSearchResults(response.data.data || []);

      if (!options.skipRecent && finalQuery) {
        setRecentSearches((prev) => {
          const next = [
            finalQuery,
            ...prev.filter((item) => String(item || '').toLowerCase() !== finalQuery.toLowerCase())
          ];
          return next.slice(0, 8);
        });
      }

      const resultCount = (response?.data?.data || []).length;
      if (resultCount === 0) {
        setMentorSearchMessage(getErrorFeedback('mentorSearchNoMatches').message);
      }
    } catch {
      setMentorSearchResults([]);
      setMentorSearchMessage(getErrorFeedback('mentorSearchFailed').message);
    } finally {
      setMentorSearchLoading(false);
    }
  }, [searchQuery]);

  const handleBookNearestSession = async (mentorId) => {
    setMentorSearchMessage('');
    if (!token) {
      setMentorSearchMessage(getInfoFeedback('mentorSearchLoginToBook').message);
      return;
    }

    try {
      const sessionsResponse = await client.get(`/api/v1/sessions/mentor/${mentorId}`);
      const mentorSessions = sessionsResponse?.data?.data || [];
      if (mentorSessions.length === 0) {
        setMentorSearchMessage(getInfoFeedback('mentorSearchNoUpcoming').message);
        return;
      }

      const nearestSession = [...mentorSessions]
        .sort((a, b) => new Date(a?.startTime || 0).getTime() - new Date(b?.startTime || 0).getTime())[0];

      if (!nearestSession?.id) {
        setMentorSearchMessage(getErrorFeedback('mentorSearchNoValidSession').message);
        return;
      }

      const bookingResponse = await client.post('/api/v1/bookings', { sessionId: nearestSession.id });
      const createdBooking = bookingResponse?.data?.data;
      if (createdBooking) {
        setBookings((prev) => [createdBooking, ...prev]);
      }

      setMentorSearchMessage(getInfoFeedback('mentorSearchBookedNearest', {
        title: nearestSession.title,
        dateTime: formatSessionDateTime(nearestSession.startTime)
      }).message);
    } catch (err) {
      const backendError = err?.response?.data?.data?.error;
      if (String(backendError || '').toLowerCase().includes('full')) {
        try {
          const sessionsResponse = await client.get(`/api/v1/sessions/mentor/${mentorId}`);
          const mentorSessions = sessionsResponse?.data?.data || [];
          const nearestSession = [...mentorSessions]
            .sort((a, b) => new Date(a?.startTime || 0).getTime() - new Date(b?.startTime || 0).getTime())[0];
          if (nearestSession?.id) {
            await client.post(`/api/v1/waitlist/session/${nearestSession.id}`);
            setMentorSearchMessage(getInfoFeedback('mentorSearchWaitlistAdded').message);
            return;
          }
        } catch {
          setMentorSearchMessage(getErrorFeedback('mentorSearchWaitlistFailed').message);
          return;
        }
      }
      setMentorSearchMessage(backendError || getErrorFeedback('mentorSearchBookFailed').message);
    }
  };

  const handleSaveCurrentFilter = () => {
    const normalizedQuery = String(searchQuery || '').trim();
    const normalizedMinScore = Number(mentorMinScore || 0);
    const filter = {
      id: Date.now(),
      query: normalizedQuery,
      sortBy: mentorSortBy,
      minScore: normalizedMinScore
    };

    setSavedSearchFilters((prev) => {
      const filtered = prev.filter(
        (item) => !(item.query === filter.query && item.sortBy === filter.sortBy && Number(item.minScore) === filter.minScore)
      );
      return [filter, ...filtered].slice(0, 8);
    });
  };

  const handleApplySavedFilter = async (filter) => {
    setSearchQuery(filter.query || '');
    setMentorSortBy(filter.sortBy || 'score');
    setMentorMinScore(Number(filter.minScore || 0));
    await runMentorSearch(filter.query || '', { skipRecent: true });
  };

  const handleDeleteSavedFilter = (filterId) => {
    setSavedSearchFilters((prev) => prev.filter((item) => item.id !== filterId));
  };

  const sendChatMessage = async (event) => {
    event.preventDefault();
    setChatError('');
    const content = chatInput.trim();
    if (!content || !selectedBookingId) {
      return;
    }

    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ content }));
      setChatInput('');
      return;
    }

    try {
      const response = await client.post(`/api/v1/chat/booking/${selectedBookingId}`, { content });
      setChatMessages((prev) => [...prev, response.data.data]);
      setChatInput('');
    } catch {
      setChatError(getErrorFeedback('dashboardChatSendFailed').message);
    }
  };

  const selectedBooking = useMemo(
    () => bookings.find((booking) => String(booking.id) === String(selectedBookingId)),
    [bookings, selectedBookingId]
  );

  const paymentEligibleBookings = useMemo(() => {
    const existingPaymentBookingIds = new Set(
      payments
        .map((payment) => payment?.booking?.id)
        .filter((id) => id !== null && id !== undefined)
    );

    return bookings
      .filter((booking) => ['ACCEPTED', 'COMPLETED', 'RESCHEDULE_REQUESTED'].includes(String(booking?.bookingStatus || '')))
      .filter((booking) => !existingPaymentBookingIds.has(booking.id));
  }, [bookings, payments]);

  useEffect(() => {
    setPaymentForm((prev) => {
      const hasCurrent = paymentEligibleBookings.some((booking) => String(booking.id) === String(prev.bookingId));
      if (hasCurrent) {
        return prev;
      }
      const firstEligibleId = paymentEligibleBookings[0] ? String(paymentEligibleBookings[0].id) : '';
      return { ...prev, bookingId: firstEligibleId };
    });
  }, [paymentEligibleBookings]);

  useEffect(() => {
    if (!paymentForm.bookingId) {
      return;
    }

    const selectedPaymentBooking = paymentEligibleBookings.find(
      (booking) => String(booking.id) === String(paymentForm.bookingId)
    );

    if (!selectedPaymentBooking) {
      return;
    }

    const suggestedAmount = Number(selectedPaymentBooking?.session?.priceAmount || 0);
    if (!Number.isFinite(suggestedAmount) || suggestedAmount <= 0) {
      return;
    }

    setPaymentForm((prev) => {
      if (String(prev.amount || '').trim()) {
        return prev;
      }
      return { ...prev, amount: suggestedAmount };
    });
  }, [paymentEligibleBookings, paymentForm.bookingId]);

  const sessionCalendarDays = useMemo(() => {
    const byDate = new Map();
    sessions.forEach((session) => {
      const key = toDateKey(session.startTime);
      if (!key) {
        return;
      }
      byDate.set(key, (byDate.get(key) || 0) + 1);
    });
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateKey, count]) => ({ dateKey, count }));
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (!selectedSessionDate) {
      return sessions;
    }
    return sessions.filter((session) => toDateKey(session.startTime) === selectedSessionDate);
  }, [sessions, selectedSessionDate]);

  const relatedBookings = useMemo(() => {
    if (!profile?.id) {
      return [];
    }
    return bookings
      .filter((booking) => booking?.learner?.id === profile.id || booking?.session?.mentor?.id === profile.id)
      .sort((a, b) => new Date(a?.session?.startTime || 0) - new Date(b?.session?.startTime || 0));
  }, [bookings, profile?.id]);

  const mentorCompletedBookings = useMemo(() => {
    if (!profile?.id) {
      return [];
    }
    return bookings.filter((booking) => (
      booking?.session?.mentor?.id === profile.id
      && String(booking?.bookingStatus || '') === 'COMPLETED'
    ));
  }, [bookings, profile?.id]);

  const upcomingReminder = useMemo(() => {
    const now = Date.now();
    const next24Hours = now + (24 * 60 * 60 * 1000);
    const eligible = relatedBookings
      .filter((booking) => ['ACCEPTED', 'PENDING', 'RESCHEDULE_REQUESTED'].includes(String(booking.bookingStatus || '')))
      .map((booking) => ({ booking, startMs: new Date(booking?.session?.startTime || 0).getTime() }))
      .filter((item) => Number.isFinite(item.startMs) && item.startMs > now && item.startMs <= next24Hours)
      .sort((a, b) => a.startMs - b.startMs)[0];

    if (!eligible) {
      return null;
    }

    const diffMs = eligible.startMs - now;
    const totalMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const urgency = totalMinutes <= 30 ? 'urgent' : totalMinutes <= 180 ? 'soon' : 'normal';
    return {
      booking: eligible.booking,
      countdownText: hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`,
      urgency
    };
  }, [relatedBookings]);

  const mentorOptions = useMemo(() => {
    const byId = new Map();
    sessions.forEach((session) => {
      if (session?.mentor?.id && session.mentor.id !== profile?.id) {
        byId.set(session.mentor.id, session.mentor);
      }
    });
    return Array.from(byId.values());
  }, [sessions, profile?.id]);

  const userSkills = useMemo(() => {
    return parseSkillTags(profile?.skills);
  }, [profile?.skills]);

  const recommendationQueries = useMemo(() => {
    const fromWatchlist = watchedSkills
      .map((item) => String(item?.skillName || '').trim())
      .filter(Boolean);

    const fromProfileLearning = userSkills
      .filter((skill) => ['Beginner', 'Intermediate'].includes(String(skill.level || '')))
      .map((skill) => String(skill.name || '').trim())
      .filter(Boolean);

    const fromAllProfileSkills = userSkills
      .map((skill) => String(skill.name || '').trim())
      .filter(Boolean);

    const profileSkillSource = fromProfileLearning.length > 0 ? fromProfileLearning : fromAllProfileSkills;
    const deduped = Array.from(new Set([...fromWatchlist, ...profileSkillSource]));
    return deduped.slice(0, 5);
  }, [userSkills, watchedSkills]);

  const discoverQuickSearchSkills = useMemo(() => {
    const catalogNames = skillsCatalog
      .map((item) => String(item?.name || '').trim())
      .filter(Boolean)
      .slice(0, 12);
    return Array.from(new Set([...recommendationQueries, ...catalogNames])).slice(0, 10);
  }, [recommendationQueries, skillsCatalog]);

  const displayedMentorResults = useMemo(() => {
    const withMinScore = mentorSearchResults.filter((item) => Number(item?.score || 0) >= Number(mentorMinScore || 0));
    const sorted = [...withMinScore].sort((a, b) => {
      if (mentorSortBy === 'rating') {
        return Number(b?.ratingScore || 0) - Number(a?.ratingScore || 0);
      }
      if (mentorSortBy === 'completion') {
        return Number(b?.completionRateScore || 0) - Number(a?.completionRateScore || 0);
      }
      if (mentorSortBy === 'skillMatch') {
        return Number(b?.skillMatch || 0) - Number(a?.skillMatch || 0);
      }
      return Number(b?.score || 0) - Number(a?.score || 0);
    });
    return sorted;
  }, [mentorMinScore, mentorSearchResults, mentorSortBy]);

  const paginatedMentorResults = useMemo(
    () => displayedMentorResults.slice(0, visibleMentorResultsCount),
    [displayedMentorResults, visibleMentorResultsCount]
  );

  const hasMoreMentorResults = paginatedMentorResults.length < displayedMentorResults.length;

  useEffect(() => {
    setVisibleMentorResultsCount(8);
  }, [mentorSearchResults, mentorSortBy, mentorMinScore]);

  useEffect(() => {
    if (!isDiscoverPage || !hasMoreMentorResults || !mentorLoadMoreRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }
        setVisibleMentorResultsCount((prev) => prev + 8);
      },
      { rootMargin: '150px 0px' }
    );

    observer.observe(mentorLoadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMoreMentorResults, isDiscoverPage]);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    const recentKey = `discoverRecentSearches:${profile.id}`;
    const savedFiltersKey = `discoverSavedFilters:${profile.id}`;

    try {
      const storedRecent = JSON.parse(localStorage.getItem(recentKey) || '[]');
      const storedFilters = JSON.parse(localStorage.getItem(savedFiltersKey) || '[]');
      setRecentSearches(Array.isArray(storedRecent) ? storedRecent.slice(0, 8) : []);
      setSavedSearchFilters(Array.isArray(storedFilters) ? storedFilters.slice(0, 8) : []);
    } catch {
      setRecentSearches([]);
      setSavedSearchFilters([]);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }
    localStorage.setItem(`discoverRecentSearches:${profile.id}`, JSON.stringify(recentSearches.slice(0, 8)));
  }, [profile?.id, recentSearches]);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }
    localStorage.setItem(`discoverSavedFilters:${profile.id}`, JSON.stringify(savedSearchFilters.slice(0, 8)));
  }, [profile?.id, savedSearchFilters]);

  const isMentor = profile?.role === 'MENTOR';
  const pageSubtitle = isSessionsPage
    ? 'Calendar, bookings, reschedules, reminders, and live chat in one place'
    : 'Your skill exchange command center';

  const profileQualityScore = useMemo(() => getProfileQualityScore(profile), [profile]);

  const mentorAnalytics = useMemo(() => {
    const mentorBookings = bookings.filter((b) => b.session?.mentor?.id === profile?.id);
    const mentorPayments = payments.filter((p) => p.booking?.session?.mentor?.id === profile?.id);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const weeklyEarnings = mentorPayments
      .filter((p) => p.status === 'RELEASED')
      .filter((p) => new Date(p.createdAt) >= weekStart)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const completedBookings = mentorBookings.filter((b) => b.bookingStatus === 'COMPLETED');
    const learnersCount = new Map();
    mentorBookings.forEach((b) => {
      const learnerId = b.learner?.id;
      if (learnerId) {
        learnersCount.set(learnerId, (learnersCount.get(learnerId) || 0) + 1);
      }
    });
    const repeatLearners = Array.from(learnersCount.values()).filter((count) => count > 1).length;

    const skillDemand = new Map();
    mentorBookings.forEach((b) => {
      const title = String(b.session?.title || '').trim();
      if (!title) {
        return;
      }
      const key = title.split(/\s+/)[0].toLowerCase();
      if (key.length < 2) {
        return;
      }
      skillDemand.set(key, (skillDemand.get(key) || 0) + 1);
    });
    const topSkillDemand = Array.from(skillDemand.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'n/a';

    return {
      weeklyEarnings,
      sessionsPosted: sessions.filter((s) => s.mentor?.id === profile?.id).length,
      bookingsReceived: mentorBookings.length,
      completedBookings: completedBookings.length,
      repeatLearners,
      topSkillDemand
    };
  }, [bookings, payments, profile?.id, sessions]);

  const mentorSessionRequests = useMemo(() => {
    if (!profile?.id) {
      return [];
    }

    return bookings
      .filter((booking) => booking.session?.mentor?.id === profile?.id && ['PENDING', 'RESCHEDULE_REQUESTED'].includes(String(booking.bookingStatus || '')))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      .slice(0, 2)
      .map((booking) => ({
        id: booking.id,
        name: String(booking?.learner?.fullName || 'Learner').trim(),
        topic: String(booking?.session?.title || 'Session request').trim(),
        note: String(booking?.notes || booking?.message || 'A new learner is waiting for approval.').trim(),
        avatar: String(booking?.learner?.profileImageUrl || '').trim()
      }));
  }, [bookings, profile?.id]);

  const mentorScheduleItems = useMemo(() => {
    if (!profile?.id) {
      return [];
    }

    const now = Date.now();

    return sessions
      .filter((session) => session.mentor?.id === profile?.id && new Date(session.startTime || 0).getTime() >= now - (15 * 60 * 1000))
      .sort((a, b) => new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime())
      .slice(0, 3)
      .map((session) => ({
        id: session.id,
        dateLabel: new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit' }).format(new Date(session.startTime || Date.now())),
        title: String(session.title || 'Upcoming Session').trim(),
        subtitle: session.sessionType ? `${session.sessionType} • ${session.capacity || 'Live session'}` : 'Live session',
        startTime: formatSessionDateTime(session.startTime),
        isLive: new Date(session.startTime || 0).getTime() <= now && new Date(session.endTime || 0).getTime() >= now,
        meetingLink: String(session.meetingLink || '').trim()
      }));
  }, [formatSessionDateTime, profile?.id, sessions]);

  const mentorProgressItems = useMemo(() => {
    if (!profile?.id) {
      return [];
    }

    return roadmaps
      .filter((roadmap) => roadmap?.booking?.session?.mentor?.id === profile?.id || roadmap?.booking?.learner?.id === profile?.id)
      .slice(0, 3)
      .map((roadmap) => ({
        id: roadmap.id,
        name: String(roadmap?.booking?.learner?.fullName || roadmap?.booking?.session?.title || 'Student').trim(),
        course: String(roadmap.title || roadmap?.booking?.session?.title || 'Learning roadmap').trim(),
        progress: Number(roadmap.progressPercent || 0)
      }));
  }, [profile?.id, roadmaps]);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    const key = `referralData:${profile.id}`;
    const existing = localStorage.getItem(key);
    if (existing) {
      try {
        setReferralData(JSON.parse(existing));
        return;
      } catch {
        // fall through to initialize
      }
    }

    const generated = {
      code: `SKILL-${profile.id}-${Math.floor(1000 + Math.random() * 9000)}`,
      invitedFriends: 0,
      successfulReferrals: 0,
      creditsEarned: 0
    };
    localStorage.setItem(key, JSON.stringify(generated));
    setReferralData(generated);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }
    const suggestions = [];

    if (profileQualityScore < 80) {
      suggestions.push(`Improve profile quality from ${profileQualityScore}% to 100% by completing all fields.`);
    }
    if (userSkills.length < 3) {
      suggestions.push('Add at least 3 skill tags to improve matching accuracy.');
    }
    if (!String(profile?.aboutMe || '').trim() || String(profile?.aboutMe || '').trim().length < 80) {
      suggestions.push('Write a stronger bio: include experience, teaching style, and target learner level.');
    }
    if (isMentor) {
      const topSkill = userSkills[0]?.name || 'your top skill';
      suggestions.push(`Suggested session titles: "${topSkill} for Beginners", "${topSkill} Interview Prep", "Hands-on ${topSkill} Project".`);
      const avgReleased = payments
        .filter((p) => p.booking?.session?.mentor?.id === profile.id && p.status === 'RELEASED')
        .reduce((sum, p, _, arr) => sum + Number(p.amount || 0) / Math.max(arr.length, 1), 0);
      if (avgReleased > 0) {
        suggestions.push(`Current average released payment is INR ${avgReleased.toFixed(2)}. Suggested price band: INR ${(avgReleased * 0.9).toFixed(0)} - ${(avgReleased * 1.15).toFixed(0)}.`);
      } else {
        suggestions.push('Set an introductory price and increase after first 5 completed sessions.');
      }
    }

    setAiSuggestions(suggestions);
  }, [isMentor, payments, profile?.aboutMe, profile?.id, profileQualityScore, userSkills]);

  useEffect(() => {
    if (!profile?.id) {
      setRecommendedMentors([]);
      setRecommendationMessage('');
      return;
    }

    let isMounted = true;

    const loadRecommendations = async () => {
      setRecommendationLoading(true);
      setRecommendationMessage('');

      try {
        const queries = recommendationQueries.length > 0 ? recommendationQueries : [''];
        const results = await Promise.all(
          queries.map((query) => client.get('/api/v1/search/mentors', { params: { q: query, limit: 12 } }))
        );

        const merged = new Map();
        results.forEach((response, idx) => {
          const query = queries[idx];
          const list = response?.data?.data || [];

          list.forEach((item) => {
            const existing = merged.get(item.mentorId);
            const hitSkill = query ? [query] : [];
            if (!existing) {
              merged.set(item.mentorId, {
                ...item,
                hitSkills: hitSkill,
                aggregateScore: Number(item.score || 0),
                occurrences: 1
              });
              return;
            }

            const seenSkills = new Set([...(existing.hitSkills || []), ...hitSkill]);
            const newOccurrences = existing.occurrences + 1;
            const totalScore = (existing.aggregateScore * existing.occurrences) + Number(item.score || 0);
            merged.set(item.mentorId, {
              ...existing,
              score: Number((totalScore / newOccurrences).toFixed(2)),
              aggregateScore: totalScore / newOccurrences,
              occurrences: newOccurrences,
              hitSkills: Array.from(seenSkills)
            });
          });
        });

        const sorted = Array.from(merged.values())
          .sort((a, b) => Number(b.aggregateScore || 0) - Number(a.aggregateScore || 0))
          .slice(0, 8);

        if (!isMounted) {
          return;
        }

        setRecommendedMentors(sorted);
        if (sorted.length === 0) {
          setRecommendationMessage('No recommendations yet. Add learning skills in your watchlist to get better matches.');
        }
      } catch {
        if (isMounted) {
          setRecommendedMentors([]);
          setRecommendationMessage(getErrorFeedback('recommendationsLoadFailed').message);
        }
      } finally {
        if (isMounted) {
          setRecommendationLoading(false);
        }
      }
    };

    loadRecommendations();

    return () => {
      isMounted = false;
    };
  }, [profile?.id, recommendationQueries]);

  const recordReferralSuccess = () => {
    if (!profile?.id || !referralData) {
      return;
    }
    const updated = {
      ...referralData,
      invitedFriends: referralData.invitedFriends + 1,
      successfulReferrals: referralData.successfulReferrals + 1,
      creditsEarned: referralData.creditsEarned + 100
    };
    setReferralData(updated);
    localStorage.setItem(`referralData:${profile.id}`, JSON.stringify(updated));
  };

  if (!isLoading && isMentorsPage) {
    return (
      <div className="min-h-screen bg-surface text-on-surface pb-24 md:pb-0">
        <aside className="fixed left-0 top-20 hidden h-[calc(100vh-5rem)] w-64 flex-col border-r border-slate-200/50 bg-slate-50 pt-6 md:flex dark:border-slate-800/50 dark:bg-slate-950">
          <div className="mb-8 px-6">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg premium-gradient text-white text-[9px] font-extrabold tracking-tight flex items-center justify-center">SS</span>
              <h2 className="font-headline text-lg font-extrabold text-emerald-900 dark:text-emerald-100">Skill Swapper</h2>
            </div>
            <p className="text-xs font-semibold text-slate-700">Master Mentor</p>
          </div>
          <nav className="flex-1 space-y-1">
            <Link className="flex items-center gap-3 rounded-r-full bg-emerald-50 px-6 py-3 font-bold text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100" to="/mentors">
              <span className="material-symbols-outlined">dashboard</span>
              <span className="font-headline text-sm font-medium">Overview</span>
            </Link>
            <Link className="flex items-center gap-3 px-6 py-3 text-slate-600 transition-colors hover:bg-emerald-50/50 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-900/10" to="/sessions">
              <span className="material-symbols-outlined">group</span>
              <span className="font-headline text-sm font-medium">Students</span>
            </Link>
            <Link className="flex items-center gap-3 px-6 py-3 text-slate-600 transition-colors hover:bg-emerald-50/50 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-900/10" to="/sessions">
              <span className="material-symbols-outlined">calendar_today</span>
              <span className="font-headline text-sm font-medium">Schedule</span>
            </Link>
            <Link className="flex items-center gap-3 px-6 py-3 text-slate-600 transition-colors hover:bg-emerald-50/50 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-900/10" to="/wallet">
              <span className="material-symbols-outlined">insights</span>
              <span className="font-headline text-sm font-medium">Analytics</span>
            </Link>
            <Link className="flex items-center gap-3 px-6 py-3 text-slate-600 transition-colors hover:bg-emerald-50/50 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-900/10" to="/resources">
              <span className="material-symbols-outlined">inventory_2</span>
              <span className="font-headline text-sm font-medium">Resources</span>
            </Link>
          </nav>
          <div className="px-4 mb-6">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container py-3 font-bold text-on-primary shadow-lg shadow-primary/10"
              type="button"
              onClick={() => navigate('/teach')}
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Lesson
            </button>
          </div>
        </aside>

        <main className="px-4 pb-12 pt-6 md:ml-64 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-on-surface">Mentor Dashboard</h1>
                <p className="max-w-2xl text-on-surface-variant">Welcome back to your curated teaching workspace. You have {mentorSessionRequests.length} new session requests and a workshop starting soon.</p>
              </div>
              <div className="hidden text-right lg:block">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-on-tertiary-fixed-variant">Expertise Level</span>
                <span className="font-headline text-2xl font-bold text-primary">Master Curator</span>
              </div>
            </header>

            <section className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
                <div className="mb-4 flex items-start justify-between">
                  <span className="material-symbols-outlined rounded-lg bg-primary-fixed p-2 text-primary">account_balance_wallet</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600">+ 12.5%</span>
                </div>
                <p className="mb-1 text-sm font-medium text-on-surface-variant">Current Balance</p>
                <h3 className="text-3xl font-extrabold text-on-surface">$4,820.50</h3>
              </div>
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
                <div className="mb-4 flex items-start justify-between">
                  <span className="material-symbols-outlined rounded-lg bg-tertiary-fixed p-2 text-tertiary">trending_up</span>
                  <span className="rounded-full bg-tertiary-fixed/30 px-2 py-1 text-xs font-bold text-tertiary">Monthly</span>
                </div>
                <p className="mb-1 text-sm font-medium text-on-surface-variant">Monthly Growth</p>
                <h3 className="text-3xl font-extrabold text-on-surface">+ $940.00</h3>
              </div>
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
                <div className="mb-4 flex items-start justify-between">
                  <span className="material-symbols-outlined rounded-lg bg-secondary-fixed p-2 text-secondary">star</span>
                  <span className="rounded-full bg-secondary-fixed/50 px-2 py-1 text-xs font-bold text-secondary">Top 1%</span>
                </div>
                <p className="mb-1 text-sm font-medium text-on-surface-variant">Avg. Course Satisfaction</p>
                <h3 className="text-3xl font-extrabold text-on-surface">4.9/5</h3>
              </div>
            </section>

            <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
              <section className="lg:col-span-1">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-on-surface">Session Requests</h2>
                  <button className="text-sm font-bold text-primary" type="button" onClick={() => navigate('/sessions')}>View All</button>
                </div>
                <div className="space-y-4">
                  {mentorSessionRequests.length === 0 ? (
                    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5 text-sm text-on-surface-variant">No pending session requests right now.</div>
                  ) : mentorSessionRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5 transition-shadow hover:shadow-md">
                      <div className="mb-4 flex gap-4">
                        {request.avatar ? (
                          <img className="h-12 w-12 rounded-lg object-cover" alt={request.name} src={request.avatar} />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container text-sm font-bold text-primary">{String(request.name || 'L').charAt(0).toUpperCase()}</div>
                        )}
                        <div>
                          <h4 className="font-bold text-on-surface">{request.name}</h4>
                          <p className="text-xs text-on-surface-variant">{request.topic}</p>
                        </div>
                      </div>
                      <p className="mb-4 text-xs italic text-on-surface-variant">"{request.note}"</p>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-on-primary"
                          type="button"
                          onClick={() => handleBookingStatusUpdate(request.id, 'ACCEPTED', 'Booking request accepted.')}
                        >
                          Accept
                        </button>
                        <button
                          className="flex-1 rounded-lg bg-surface-container py-2 text-xs font-bold text-on-surface-variant"
                          type="button"
                          onClick={() => handleBookingStatusUpdate(request.id, 'REJECTED', 'Booking request declined.')}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="lg:col-span-2">
                <div className="rounded-2xl bg-surface-container-low p-6 sm:p-8 h-full">
                  <div className="mb-8 flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-on-surface">Upcoming Schedule</h2>
                    <div className="flex gap-2">
                      <button className="rounded-lg bg-surface-container-lowest p-2 text-on-surface shadow-sm" type="button" onClick={() => setSelectedSessionDate('')} aria-label="Show all upcoming sessions"><span className="material-symbols-outlined">calendar_month</span></button>
                      <button className="rounded-lg bg-surface-container-lowest p-2 text-on-surface shadow-sm" type="button" onClick={() => window.location.assign('/teach?tab=sessions')} aria-label="Manage schedule"><span className="material-symbols-outlined">edit_calendar</span></button>
                    </div>
                  </div>
                  {mentorScheduleItems.length > 0 && (
                    <div className="mb-6 flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary-container/20 p-6 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-6">
                        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-primary font-headline text-on-primary">
                          <span className="text-xs font-bold uppercase">{mentorScheduleItems[0].dateLabel.split(' ')[0]}</span>
                          <span className="text-xl font-extrabold">{mentorScheduleItems[0].dateLabel.split(' ')[1]}</span>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                            {mentorScheduleItems[0].isLive ? 'Happening Now' : 'Next Up'}
                          </div>
                          <h3 className="text-xl font-bold text-on-surface">{mentorScheduleItems[0].title}</h3>
                          <p className="flex items-center gap-2 text-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm">group</span> {mentorScheduleItems[0].subtitle}
                          </p>
                        </div>
                      </div>
                      <button
                        className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-bold text-on-primary transition-colors hover:bg-emerald-800"
                        type="button"
                        onClick={() => {
                          if (mentorScheduleItems[0].meetingLink) {
                            window.open(mentorScheduleItems[0].meetingLink, '_blank', 'noopener,noreferrer');
                            return;
                          }
                          const feedback = showInfoFeedback({ key: 'missingMeetingLink', notify });
                          setNotificationMessage(feedback.message);
                        }}
                      >
                        <span className="material-symbols-outlined">videocam</span>
                        {mentorScheduleItems[0].meetingLink ? 'Open Session' : 'Join Session'}
                      </button>
                    </div>
                  )}
                  <div className="space-y-4">
                    {mentorScheduleItems.slice(1).map((session, index) => (
                      <div key={session.id} className="flex flex-col gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                          <span className="w-16 text-xs font-bold text-on-surface-variant">{session.startTime}</span>
                          <div className={`h-8 w-1 rounded-full ${index % 2 === 0 ? 'bg-tertiary' : 'bg-secondary'}`} />
                          <h4 className="truncate font-bold text-on-surface">{session.title}</h4>
                        </div>
                        <button className="self-end rounded-full p-2 text-primary transition-colors hover:bg-primary/5 md:self-auto" type="button" onClick={() => window.location.assign(`/teach?tab=sessions&sessionId=${encodeURIComponent(session.id)}`)} aria-label={`Manage ${session.title}`}>
                          <span className="material-symbols-outlined">more_vert</span>
                        </button>
                      </div>
                    ))}
                    {mentorScheduleItems.length === 0 && (
                      <EmptyStateCard
                        icon="event_available"
                        title="No upcoming sessions found yet"
                        description="Publish a session so learners can book your next availability."
                        actionLabel="Create session"
                        actionTo="/teach?tab=sessions"
                        className="is-compact"
                        tone="secondary"
                      />
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <section>
                <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm sm:p-8">
                  <h2 className="mb-8 text-xl font-bold text-on-surface">Active Student Progress</h2>
                  <div className="space-y-6">
                    {mentorProgressItems.length > 0 ? mentorProgressItems.map((item) => (
                      <div key={item.id}>
                        <div className="mb-2 flex items-end justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-bold text-on-surface">{item.name}</h4>
                            <p className="text-xs text-on-surface-variant">{item.course}</p>
                          </div>
                          <span className="text-sm font-bold text-primary">{item.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }} />
                        </div>
                      </div>
                    )) : (
                      <EmptyStateCard
                        icon="timeline"
                        title="No roadmap progress yet"
                        description="Bookings will populate this area as learners start their sessions."
                        actionLabel="Review sessions"
                        actionTo="/sessions"
                        className="is-compact"
                        tone="primary"
                      />
                    )}
                  </div>
                </div>
              </section>

              <section>
                <div className="relative h-full overflow-hidden rounded-2xl bg-inverse-surface p-6 text-on-primary shadow-xl sm:p-8">
                  <div className="absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-primary/20 blur-[100px]" />
                  <div className="relative z-10">
                    <h2 className="mb-8 text-xl font-bold text-inverse-on-surface">Growth Analytics</h2>
                    <div className="mb-8 grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-emerald-400">Retention Rate</span>
                        <span className="font-headline text-2xl font-bold">{mentorAnalytics.completedBookings > 0 ? Math.min(99.9, (mentorAnalytics.repeatLearners / Math.max(mentorAnalytics.completedBookings, 1)) * 100 + 90).toFixed(1) : '98.2'}%</span>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-emerald-400">New Students</span>
                        <span className="font-headline text-2xl font-bold">{mentorAnalytics.bookingsReceived}</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-4 text-sm"><span className="text-on-surface-variant/80">Avg. Response Time</span><span className="font-bold">45 mins</span></div>
                      <div className="flex items-center justify-between border-b border-white/10 pb-4 text-sm"><span className="text-on-surface-variant/80">Content Engagement</span><span className="font-bold">+18.4%</span></div>
                      <div className="flex items-center justify-between border-b border-white/10 pb-4 text-sm"><span className="text-on-surface-variant/80">Workshop Attendance</span><span className="font-bold">94%</span></div>
                    </div>
                    <button className="mt-6 w-full rounded-xl border border-white/10 bg-white/10 py-3 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-white/20" type="button" onClick={() => navigate('/wallet')}>Download Performance Report</button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>

        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="dashboard">
      {isLoading && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <SkeletonDashboard />
        </div>
      )}
      
      {!isLoading && (
      <>
      <header>
        <h2>Welcome, {profile?.fullName || 'Guest'}</h2>
        <p className="header-subtitle">{pageSubtitle}</p>
        <p className="muted">Current page: {page}</p>
      </header>

      {(isSessionsPage || isDiscoverPage) && upcomingReminder && (
        <section className={`dashboard-card session-reminder-banner session-reminder-${upcomingReminder.urgency}`}>
          <div className="session-reminder-head">
            <h3>Upcoming session reminder</h3>
            <span className="session-reminder-chip">{upcomingReminder.countdownText}</span>
          </div>
          <p>
            <strong>{upcomingReminder.booking?.session?.title}</strong> starts in {upcomingReminder.countdownText}
            {' '}({formatSessionDateTime(upcomingReminder.booking?.session?.startTime)} {userTimezone})
          </p>
          <div className="session-reminder-actions">
            <button type="button" onClick={() => navigate('/messages')}>Open chat</button>
            <button type="button" className="secondary" onClick={() => navigate('/sessions')}>Open sessions</button>
          </div>
        </section>
      )}

      {(isDiscoverPage || isMentorsPage) && (
        isMentorsPage ? (
          <section className="dashboard-card mentor-teaching-hero">
            <div className="mentor-teaching-hero-grid">
              <div className="mentor-teaching-copy">
                <p className="mentor-teaching-kicker">Teaching Studio</p>
                <h3>Design lessons, manage bookings, and keep your classroom moving.</h3>
                <p className="mentor-teaching-description">
                  A single workspace for lesson strategy, session throughput, learner trust, and content you can ship fast.
                </p>
                <div className="mentor-teaching-actions">
                  <button type="button" onClick={() => navigate('/teach')}>Create session package</button>
                  <button type="button" className="secondary" onClick={() => navigate('/teach')}>Review submissions</button>
                  <button type="button" className="ghost" onClick={() => navigate('/sessions')}>Open teaching calendar</button>
                </div>
              </div>

              <div className="mentor-teaching-metrics">
                <div className="mentor-metric-tile">
                  <span className="mentor-metric-label">Weekly earnings</span>
                  <strong>INR {mentorAnalytics.weeklyEarnings.toFixed(2)}</strong>
                  <p>Live released revenue across your sessions.</p>
                </div>
                <div className="mentor-metric-tile">
                  <span className="mentor-metric-label">Sessions posted</span>
                  <strong>{mentorAnalytics.sessionsPosted}</strong>
                  <p>Your active catalog and workshop count.</p>
                </div>
                <div className="mentor-metric-tile">
                  <span className="mentor-metric-label">Bookings received</span>
                  <strong>{mentorAnalytics.bookingsReceived}</strong>
                  <p>Requests currently flowing into your teaching funnel.</p>
                </div>
                <div className="mentor-metric-tile">
                  <span className="mentor-metric-label">Profile quality</span>
                  <strong>{profileQualityScore}%</strong>
                  <p>{profileQualityScore >= 80 ? 'Ready for higher conversion.' : 'Improve bio and links to increase trust.'}</p>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="dashboard-card">
            <h3>{isMentor ? 'Mentor overview' : 'Learner overview'}</h3>
            {isMentor ? (
              <ul>
                <li>Active sessions: {sessions.filter((s) => s.mentor?.id === profile?.id).length}</li>
                <li>Incoming bookings: {bookings.filter((b) => b.session?.mentor?.id === profile?.id).length}</li>
                <li>Verification tasks: {verificationTasks.filter((t) => t.mentor?.id === profile?.id).length}</li>
              </ul>
            ) : (
              <>
                <ul>
                  <li>Your bookings: {bookings.filter((b) => b.learner?.id === profile?.id).length}</li>
                  <li>Saved mentors: {savedMentors.length}</li>
                  <li>Watched skills: {watchedSkills.length}</li>
                </ul>
              </>
            )}

            {isDiscoverPage && (
              <>
                <h4>Recommended mentors for you</h4>
                {recommendationQueries.length > 0 ? (
                  <p className="muted">Based on: {recommendationQueries.join(', ')}</p>
                ) : (
                  <p className="muted">Add skills to your watchlist to get personalized mentor matches.</p>
                )}

                {recommendationLoading ? (
                  <p className="muted">Loading recommendations...</p>
                ) : recommendedMentors.length === 0 ? (
                  <p className="muted">{recommendationMessage || 'No recommendations available yet.'}</p>
                ) : (
                  <ul>
                    {recommendedMentors.slice(0, 4).map((mentor) => {
                      const alreadySaved = savedMentors.some((saved) => saved.mentor?.id === mentor.mentorId);
                      return (
                        <li key={mentor.mentorId}>
                          <div>
                            <strong>{mentor.mentorName}</strong> | Match score: {mentor.score}
                          </div>
                          <div className="muted">
                            Matched: {(mentor.hitSkills || []).join(', ') || 'General relevance'}
                          </div>
                          <div className="inline-actions">
                            <a className="meeting-link" href={`/mentors/${mentor.mentorId}`} onClick={(e) => { e.preventDefault(); requireLoginAndGo(`/mentors/${mentor.mentorId}`); }}>View profile</a>
                            {alreadySaved ? (
                              <button type="button" onClick={() => handleRemoveMentor(mentor.mentorId)}>Remove</button>
                            ) : (
                              <button type="button" onClick={() => handleSaveMentor(mentor.mentorId)}>Save</button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>
        )
      )}

      {isSessionsPage && isMentor && (
      <section className="dashboard-card">
        <h3>Mentor verification badge</h3>
        <form onSubmit={handleSubmitMentorVerification}>
          <input
            type="url"
            placeholder="Verification document URL (https://...)"
            value={mentorVerificationForm.documentUrl}
            onChange={(e) => setMentorVerificationForm((prev) => ({ ...prev, documentUrl: e.target.value }))}
            required
          />
          <select
            value={mentorVerificationForm.documentType}
            onChange={(e) => setMentorVerificationForm((prev) => ({ ...prev, documentType: e.target.value }))}
          >
            <option value="ID_PROOF">ID Proof</option>
            <option value="CERTIFICATION">Certification</option>
            <option value="PORTFOLIO">Portfolio Proof</option>
          </select>
          <button type="submit">Submit for approval</button>
        </form>
        {verificationWorkflowMessage && <p className="muted">{verificationWorkflowMessage}</p>}
        <ul>
          {mentorVerificationRequests.map((item) => (
            <li key={item.id}>
              Request #{item.id} | {item.documentType} | <strong>{item.status}</strong>
              {item.adminNote && <div className="muted">Admin note: {item.adminNote}</div>}
            </li>
          ))}
        </ul>
      </section>
      )}

      {isSessionsPage && isMentor && (
      <section className="dashboard-card">
        <h3>Rate learners after sessions</h3>
        <form onSubmit={handleSubmitLearnerReview}>
          <select
            value={mentorLearnerReviewForm.bookingId}
            onChange={(e) => {
              const bookingId = e.target.value;
              const selected = mentorCompletedBookings.find((b) => String(b.id) === String(bookingId));
              setMentorLearnerReviewForm((prev) => ({
                ...prev,
                bookingId,
                learnerId: selected?.learner?.id ? String(selected.learner.id) : prev.learnerId
              }));
            }}
            required
          >
            <option value="">Select completed booking</option>
            {mentorCompletedBookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                #{booking.id} - {booking.learner?.fullName} - {booking.session?.title}
              </option>
            ))}
          </select>
          <select
            value={mentorLearnerReviewForm.rating}
            onChange={(e) => setMentorLearnerReviewForm((prev) => ({ ...prev, rating: e.target.value }))}
          >
            <option value="5">5 - Excellent learner</option>
            <option value="4">4 - Very good</option>
            <option value="3">3 - Good</option>
            <option value="2">2 - Needs improvement</option>
            <option value="1">1 - Poor engagement</option>
          </select>
          <textarea
            rows={3}
            placeholder="Learner feedback"
            value={mentorLearnerReviewForm.comment}
            onChange={(e) => setMentorLearnerReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
          />
          <button type="submit" disabled={!mentorLearnerReviewForm.bookingId || !mentorLearnerReviewForm.learnerId}>Submit learner review</button>
        </form>
      </section>
      )}

      {isDiscoverPage && (
      <section className="dashboard-card">
        <h3>Notifications {unreadNotifications > 0 ? `(${unreadNotifications} unread)` : ''}</h3>
        <div className="inline-actions">
          <button type="button" onClick={handleMarkAllNotificationsRead}>Mark all read</button>
        </div>
        {notificationMessage && <p className="muted">{notificationMessage}</p>}
        {notifications.length === 0 ? (
          <p className="muted">No notifications yet.</p>
        ) : (
          <ul>
            {notifications.slice(0, 15).map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong> {!item.read && <span className="muted">(new)</span>}
                </div>
                <div className="muted">{item.message}</div>
                {!item.read && (
                  <button type="button" onClick={() => handleMarkNotificationRead(item.id)}>Mark read</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {isDiscoverPage && (
      <section className="dashboard-card">
        <h3>{t(language, 'aiAssistantTitle')}</h3>
        <div className="inline-actions">
          <button type="button" onClick={() => setAiSuggestions((prev) => [...prev])}>{t(language, 'refreshInsights')}</button>
        </div>
        {aiSuggestions.length === 0 ? (
          <p className="muted">{t(language, 'aiAssistantEmpty')}</p>
        ) : (
          <ul>
            {aiSuggestions.map((item, idx) => (
              <li key={`ai-${idx}`}>{item}</li>
            ))}
          </ul>
        )}
      </section>
      )}

      {isMentor && isMentorsPage && (
        <section className="dashboard-card">
          <h3>{t(language, 'revenueTitle')}</h3>
          <ul>
            <li>{t(language, 'weeklyEarnings')}: INR {mentorAnalytics.weeklyEarnings.toFixed(2)}</li>
              <li>{t(language, 'conversionFunnel')}: {mentorAnalytics.sessionsPosted} sessions {'->'} {mentorAnalytics.bookingsReceived} bookings {'->'} {mentorAnalytics.completedBookings} completed</li>
            <li>{t(language, 'repeatLearners')}: {mentorAnalytics.repeatLearners}</li>
            <li>{t(language, 'topSkillDemand')}: {mentorAnalytics.topSkillDemand}</li>
          </ul>
        </section>
      )}

      {(isWalletPage || isDiscoverPage) && (
      <section className="dashboard-card">
        <h3>{t(language, 'referralTitle')}</h3>
        {!referralData ? (
          <p className="muted">Loading referral data...</p>
        ) : (
          <>
            <p><strong>{t(language, 'yourReferralCode')}:</strong> <span className="ref-code">{referralData.code}</span></p>
            <ul>
              <li>{t(language, 'invitedFriends')}: {referralData.invitedFriends}</li>
              <li>{t(language, 'successfulReferrals')}: {referralData.successfulReferrals}</li>
              <li>{t(language, 'creditsEarned')}: {referralData.creditsEarned}</li>
            </ul>
            <button type="button" onClick={recordReferralSuccess}>{t(language, 'addReferralSuccess')}</button>
          </>
        )}
      </section>
      )}

      {isDiscoverPage && (
      <section className="dashboard-card">
        <h3>Mentor Search (Relevance Scoring)</h3>
        <SearchFilters
          onSearch={(value) => {
            setSearchQuery(value);
            if (value.trim()) {
              runMentorSearch(value);
            } else {
              setMentorSearchResults([]);
              setMentorSearchMessage(getInfoFeedback('mentorSearchEnterKeyword').message);
            }
          }}
          onFilterChange={(filter) => {
            setMentorMinScore(filter.rating ? Math.max(0, Number(filter.rating) * 20) : 0);
            setMentorSortBy(filter.rating ? 'rating' : 'score');
          }}
        />

        <div className="inline-form">
          <select value={mentorSortBy} onChange={(e) => setMentorSortBy(e.target.value)}>
            <option value="score">Sort: Best overall</option>
            <option value="skillMatch">Sort: Skill match</option>
            <option value="rating">Sort: Rating score</option>
            <option value="completion">Sort: Completion score</option>
          </select>
          <input
            type="number"
            min="0"
            max="100"
            value={mentorMinScore}
            onChange={(e) => setMentorMinScore(e.target.value)}
            placeholder="Min score"
          />
          <button type="button" onClick={handleSaveCurrentFilter}>Save current filter</button>
        </div>

        {discoverQuickSearchSkills.length > 0 && (
          <div className="quick-search-chips">
            {discoverQuickSearchSkills.map((skill) => (
              <button
                key={`discover-chip-${skill}`}
                type="button"
                className="quick-chip"
                onClick={() => {
                  setSearchQuery(skill);
                  runMentorSearch(skill);
                }}
              >
                {skill}
              </button>
            ))}
          </div>
        )}

        {recentSearches.length > 0 && (
          <div>
            <p className="muted">Recent searches</p>
            <div className="quick-search-chips">
              {recentSearches.map((item) => (
                <button
                  key={`recent-${item}`}
                  type="button"
                  className="quick-chip"
                  onClick={() => {
                    setSearchQuery(item);
                    runMentorSearch(item, { skipRecent: true });
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {savedSearchFilters.length > 0 && (
          <div>
            <p className="muted">Saved filters</p>
            <ul className="saved-filters-list">
              {savedSearchFilters.map((filter) => (
                <li key={filter.id}>
                  <span>
                    Query: {filter.query || 'All'} | Sort: {filter.sortBy} | Min score: {filter.minScore}
                  </span>
                  <div className="inline-actions">
                    <button type="button" onClick={() => handleApplySavedFilter(filter)}>Apply</button>
                    <button type="button" onClick={() => handleDeleteSavedFilter(filter.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mentorSearchLoading && <p className="muted">Searching mentors...</p>}
        {mentorSearchMessage && <p className="muted">{mentorSearchMessage}</p>}

        {paginatedMentorResults.length === 0 ? (
          <p className="muted">No search results yet. Try a query like Java, React, DSA.</p>
        ) : (
          <ul>
            {paginatedMentorResults.map((result) => (
              <li key={result.mentorId}>
                <strong>{result.mentorName}</strong> | Score: {result.score}
                <div className="muted">Skill match: {result.skillMatch}, Rating: {result.ratingScore}, Response: {result.responseTimeScore}, Completion: {result.completionRateScore}</div>
                <div className="inline-actions">
                  <a className="meeting-link" href={`/mentors/${result.mentorId}`} onClick={(e) => { e.preventDefault(); requireLoginAndGo(`/mentors/${result.mentorId}`); }}>Open public profile</a>
                  <button type="button" onClick={() => handleBookNearestSession(result.mentorId)}>Book now</button>
                  <button
                    type="button"
                    onClick={() => {
                      const bestSkill = String(result?.skills || '').split(',')[0]?.trim() || searchQuery;
                      if (!bestSkill) {
                        return;
                      }
                      setSearchQuery(bestSkill);
                      runMentorSearch(bestSkill);
                    }}
                  >
                    Find similar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hasMoreMentorResults && (
          <div ref={mentorLoadMoreRef} className="discover-load-more-anchor">
            <button
              type="button"
              onClick={() => setVisibleMentorResultsCount((prev) => prev + 8)}
            >
              Load more
            </button>
          </div>
        )}
      </section>
      )}

      {isMentorsPage && (
        <section className="dashboard-card">
          <h3>Your account</h3>
          {profile?.profileImageUrl && (
            <div className="profile-image-preview-wrap">
              <OptimizedImage src={profile.profileImageUrl} alt={profile?.fullName || 'Profile'} className="profile-image-preview" />
            </div>
          )}
          <div className="profile-quality-meter">
            <div className="profile-quality-header">
              <strong>Profile quality:</strong>
              <span>{profileQualityScore}%</span>
            </div>
            <div className="profile-quality-track">
              <div className="profile-quality-fill" style={{ width: `${profileQualityScore}%` }} />
            </div>
          </div>
          <p><strong>Email:</strong> {profile?.email}</p>
          <p><strong>Role:</strong> {profile?.role}</p>
          <p><strong>Wallet:</strong> {profile?.walletAddress || 'Not linked'}</p>
          <p>
            <strong>Skills:</strong>{' '}
            {userSkills.length > 0
              ? userSkills.map((skill) => `${skill.name} (${skill.level})`).join(', ')
              : 'Not set'}
          </p>
          <p><strong>About:</strong> {profile?.aboutMe || 'Not set'}</p>
          <p><strong>Verified skills:</strong> {profile?.verifiedSkills || 'None yet'}</p>
          <p>
            <strong>GitHub:</strong>{' '}
            {profile?.githubUrl ? (
              <a className="meeting-link" href={profile.githubUrl} target="_blank" rel="noreferrer">{profile.githubUrl}</a>
            ) : 'Not set'}
          </p>
          <p>
            <strong>LinkedIn:</strong>{' '}
            {profile?.linkedinUrl ? (
              <a className="meeting-link" href={profile.linkedinUrl} target="_blank" rel="noreferrer">{profile.linkedinUrl}</a>
            ) : 'Not set'}
          </p>
        </section>
      )}

      {isMentorsPage && (
      <section className="dashboard-card">
        <h3>Skills</h3>
        <p><strong>Your skills:</strong></p>
        {userSkills.length > 0 ? (
          <div className="skill-tag-list">
            {userSkills.map((skill) => (
              <span key={`${skill.name}-${skill.level}`} className="skill-tag-chip">
                {skill.name} ({skill.level})
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">No personal skills found. Update your profile to add them.</p>
        )}

        <p><strong>Platform skills:</strong></p>
        {skillsCatalog.length > 0 ? (
          <ul>
            {skillsCatalog.map((skill) => <li key={skill.id}>{skill.name} - {skill.category}</li>)}
          </ul>
        ) : (
          <p className="muted">No platform skills available yet.</p>
        )}
      </section>
      )}

      {isDiscoverPage && (
      <section className="dashboard-card">
        <h3>Saved Mentors and Skill Watchlist</h3>
        <div className="inline-form">
          <select value={overlapMentorId} onChange={(e) => setOverlapMentorId(e.target.value)}>
            <option value="">Select mentor</option>
            {mentorOptions.map((mentor) => (
              <option key={mentor.id} value={mentor.id}>{mentor.fullName}</option>
            ))}
          </select>
          <button type="button" onClick={() => overlapMentorId && handleSaveMentor(Number(overlapMentorId))}>Save Mentor</button>
        </div>

        <div className="inline-form">
          <input
            placeholder="Watch skill (e.g. Java)"
            value={watchSkillInput}
            onChange={(e) => setWatchSkillInput(e.target.value)}
          />
          <button type="button" onClick={handleAddWatchSkill}>Add Skill</button>
        </div>

        {watchlistMessage && <p className="muted">{watchlistMessage}</p>}

        <p><strong>Saved mentors:</strong></p>
        {savedMentors.length === 0 ? (
          <p className="muted">No mentors saved yet.</p>
        ) : (
          <ul>
            {savedMentors.map((item) => (
              <li key={item.id}>
                {item.mentor?.fullName}
                {item.mentor?.id && (
                  <a className="meeting-link" href={`/mentors/${item.mentor.id}`} onClick={(e) => { e.preventDefault(); requireLoginAndGo(`/mentors/${item.mentor.id}`); }}>View profile</a>
                )}
                <button type="button" onClick={() => handleRemoveMentor(item.mentor?.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}

        <p><strong>Watched skills:</strong></p>
        {watchedSkills.length === 0 ? (
          <p className="muted">No watched skills yet.</p>
        ) : (
          <ul>
            {watchedSkills.map((item) => (
              <li key={item.id}>
                {item.skillName}
                <button type="button" onClick={() => handleRemoveWatchSkill(item.skillName)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {(isSessionsPage || isDiscoverPage) && (
      <section className="dashboard-card">
        <h3>Availability and Timezone Overlap</h3>
        <form onSubmit={handleAddAvailabilitySlot}>
          <select
            value={availabilityForm.dayOfWeek}
            onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, dayOfWeek: e.target.value }))}
          >
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
            <option value="7">Sunday</option>
          </select>
          <input type="time" value={availabilityForm.startTime} onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, startTime: e.target.value }))} required />
          <input type="time" value={availabilityForm.endTime} onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, endTime: e.target.value }))} required />
          <input
            placeholder="Timezone (e.g. Asia/Kolkata)"
            value={availabilityForm.timezone}
            onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, timezone: e.target.value }))}
            required
          />
          <button type="submit">Add Slot</button>
        </form>

        <div className="inline-form">
          <select value={overlapMentorId} onChange={(e) => setOverlapMentorId(e.target.value)}>
            <option value="">Select mentor for overlap</option>
            {mentorOptions.map((mentor) => (
              <option key={mentor.id} value={mentor.id}>{mentor.fullName}</option>
            ))}
          </select>
          <button type="button" onClick={handleFindOverlapSlots}>Find overlap</button>
          <button type="button" onClick={handleRecommendOverlapSlots}>Smart recommend</button>
        </div>

        {availabilityMessage && <p className="muted">{availabilityMessage}</p>}

        <p><strong>Your slots:</strong></p>
        <ul>
          {availabilitySlots.map((slot) => (
            <li key={slot.id}>
              Day {slot.dayOfWeek}: {slot.startTime} - {slot.endTime} ({slot.timezone})
              <button type="button" onClick={() => handleDeleteAvailabilitySlot(slot.id)}>Delete</button>
            </li>
          ))}
        </ul>

        <p><strong>Overlap slots in your timezone:</strong></p>
        {overlapSlots.length === 0 ? (
          <p className="muted">No overlap computed yet.</p>
        ) : (
          <ul>
            {overlapSlots.map((slot, idx) => (
              <li key={`${slot.dayOfWeek}-${slot.startTime}-${idx}`}>
                Day {slot.dayOfWeek}: {slot.startTime} - {slot.endTime} ({slot.timezone})
              </li>
            ))}
          </ul>
        )}

        <p><strong>Recommended slots (history + overlap):</strong></p>
        {recommendedOverlapSlots.length === 0 ? (
          <p className="muted">No smart recommendations yet.</p>
        ) : (
          <ul>
            {recommendedOverlapSlots.map((slot, idx) => (
              <li key={`recommended-${slot.dayOfWeek}-${slot.startTime}-${idx}`}>
                Day {slot.dayOfWeek}: {slot.startTime} - {slot.endTime} ({slot.timezone})
                <div className="muted">Score: {slot.historyScore} | {slot.reason}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {(isMentorsPage || isDiscoverPage) && (
      <section className="dashboard-card">
        <h3>Trust and Safety</h3>
        <form onSubmit={handleSubmitReport}>
          <input
            type="number"
            placeholder="Reported user ID"
            value={reportForm.reportedUserId}
            onChange={(e) => setReportForm((prev) => ({ ...prev, reportedUserId: e.target.value }))}
            required
          />
          <select
            value={reportForm.targetType}
            onChange={(e) => setReportForm((prev) => ({ ...prev, targetType: e.target.value }))}
          >
            <option value="CHAT">Chat</option>
            <option value="REVIEW">Review</option>
            <option value="PROFILE">Profile</option>
          </select>
          <input
            type="number"
            placeholder="Target ID (optional)"
            value={reportForm.targetId}
            onChange={(e) => setReportForm((prev) => ({ ...prev, targetId: e.target.value }))}
          />
          <input
            placeholder="Reason"
            value={reportForm.reason}
            onChange={(e) => setReportForm((prev) => ({ ...prev, reason: e.target.value }))}
            required
          />
          <textarea
            placeholder="Details"
            rows={3}
            value={reportForm.details}
            onChange={(e) => setReportForm((prev) => ({ ...prev, details: e.target.value }))}
          />
          <button type="submit">Submit report</button>
        </form>
        {safetyMessage && <p className="muted">{safetyMessage}</p>}

        <p><strong>Blocked users:</strong></p>
        {blockedUsers.length === 0 ? (
          <p className="muted">No blocked users.</p>
        ) : (
          <ul>
            {blockedUsers.map((block) => (
              <li key={block.id}>
                {block.blocked?.fullName || `User #${block.blocked?.id}`}
              </li>
            ))}
          </ul>
        )}
        <div className="inline-form">
          <input
            type="number"
            placeholder="User ID to block"
            onBlur={(e) => {
              const userId = Number(e.target.value);
              if (userId) {
                handleBlockUser(userId);
                e.target.value = '';
              }
            }}
          />
          <span className="muted">Enter user id and tab out to block.</span>
        </div>

        <p><strong>Your report status timeline:</strong></p>
        {myReports.length === 0 ? (
          <p className="muted">No reports filed yet.</p>
        ) : (
          <ul>
            {myReports.map((report) => (
              <li key={report.id}>
                Report #{report.id} | Target {report.targetType} #{report.targetId || '-'} | <strong>{report.status}</strong>
                {report.escalated && (
                  <div className="muted">Escalated level {report.escalationLevel || 1}: {report.escalationReason || 'No reason provided'}</div>
                )}
              </li>
            ))}
          </ul>
        )}

        {profile?.role === 'ADMIN' && (
          <>
            <p><strong>Moderation queue (open reports):</strong></p>
            {moderationReports.length === 0 ? (
              <p className="muted">No open reports in moderation queue.</p>
            ) : (
              <ul>
                {moderationReports.map((report) => (
                  <li key={`moderation-${report.id}`}>
                    Report #{report.id} by {report.reporter?.fullName} on user #{report.reported?.id} | {report.status}
                    <div className="inline-actions">
                      <button type="button" onClick={() => handleEscalateReport(report.id)}>Escalate</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p><strong>Mentor verification moderation queue:</strong></p>
            {mentorVerificationQueue.length === 0 ? (
              <p className="muted">No pending mentor verification requests.</p>
            ) : (
              <ul>
                {mentorVerificationQueue.map((request) => (
                  <li key={`verify-${request.id}`}>
                    Request #{request.id} by {request.mentor?.fullName} | {request.documentType}
                    <a className="meeting-link" href={request.documentUrl} target="_blank" rel="noreferrer">View document</a>
                    <div className="inline-actions">
                      <button type="button" onClick={() => handleReviewMentorVerification(request.id, 'APPROVED')}>Approve</button>
                      <button type="button" onClick={() => handleReviewMentorVerification(request.id, 'REJECTED')}>Reject</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      )}

      {isMentorsPage && (
      <section className="dashboard-card mentors-search-surface">
        <div className="mentor-search-hero">
          <div>
            <p className="mentor-search-kicker">Mentor discovery</p>
            <h3>Search mentors the same way you browse the learning hub.</h3>
            <p className="muted">Query, sort, and score filters stay in the URL so the view is shareable and persistent.</p>
          </div>
          <div className="mentor-search-stats">
            <div>
              <strong>{displayedMentorResults.length}</strong>
              <span>matches</span>
            </div>
            <div>
              <strong>{mentorSearchResults.length}</strong>
              <span>raw results</span>
            </div>
            <div>
              <strong>{mentorSearchLoading ? '...' : mentorSortBy}</strong>
              <span>active sort</span>
            </div>
          </div>
        </div>

        <SearchFilters
          value={searchQuery}
          onSearch={(value) => {
            setSearchQuery(value);
            if (value.trim()) {
              runMentorSearch(value);
            } else {
              setMentorSearchResults([]);
              setMentorSearchMessage(getInfoFeedback('mentorSearchEnterKeyword').message);
            }
          }}
          onFilterChange={(filter) => {
            const nextRating = Number(filter.rating || 0);
            setMentorMinScore(nextRating > 0 ? Math.max(0, nextRating * 20) : 0);
            setMentorSortBy(nextRating > 0 ? 'rating' : mentorSortBy);
          }}
        />

        <div className="mentor-search-toolbar">
          <div className="inline-form mentor-search-inline-form">
            <select value={mentorSortBy} onChange={(e) => setMentorSortBy(e.target.value)}>
              <option value="score">Sort: Best overall</option>
              <option value="skillMatch">Sort: Skill match</option>
              <option value="rating">Sort: Rating score</option>
              <option value="completion">Sort: Completion score</option>
            </select>
            <input
              type="number"
              min="0"
              max="100"
              value={mentorMinScore}
              onChange={(e) => setMentorMinScore(e.target.value)}
              placeholder="Min score"
            />
            <button type="button" onClick={handleSaveCurrentFilter}>Save current filter</button>
          </div>

          <div className="mentor-search-helper-row">
            <div className="quick-search-chips">
              {discoverQuickSearchSkills.slice(0, 6).map((skill) => (
                <button
                  key={`mentor-chip-${skill}`}
                  type="button"
                  className="quick-chip"
                  onClick={() => {
                    setSearchQuery(skill);
                    runMentorSearch(skill);
                  }}
                >
                  {skill}
                </button>
              ))}
            </div>

            <div className="mentor-search-links">
              <Link className="meeting-link" to="/sessions">Compare learning hub</Link>
              <button type="button" className="meeting-link-button" onClick={() => setSearchQuery('')}>Clear query</button>
            </div>
          </div>
        </div>

        {recentSearches.length > 0 && (
          <div className="mentor-search-history-block">
            <p className="muted">Recent searches</p>
            <div className="quick-search-chips">
              {recentSearches.map((item) => (
                <button
                  key={`recent-${item}`}
                  type="button"
                  className="quick-chip"
                  onClick={() => {
                    setSearchQuery(item);
                    runMentorSearch(item, { skipRecent: true });
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {savedSearchFilters.length > 0 && (
          <div className="mentor-search-history-block">
            <p className="muted">Saved filters</p>
            <ul className="saved-filters-list">
              {savedSearchFilters.map((filter) => (
                <li key={filter.id}>
                  <span>
                    Query: {filter.query || 'All'} | Sort: {filter.sortBy} | Min score: {filter.minScore}
                  </span>
                  <div className="inline-actions">
                    <button type="button" onClick={() => handleApplySavedFilter(filter)}>Apply</button>
                    <button type="button" onClick={() => handleDeleteSavedFilter(filter.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mentorSearchLoading && (
          <div className="mentor-results-loading">
            <SkeletonMentorGrid cards={3} />
          </div>
        )}

        {mentorSearchMessage && <p className="muted">{mentorSearchMessage}</p>}

        {!mentorSearchLoading && displayedMentorResults.length === 0 ? (
          <div className="mentor-empty-state">
            <p className="muted">No search results yet. Try a query like Java, React, DSA.</p>
            <div className="quick-search-chips">
              {discoverQuickSearchSkills.slice(0, 4).map((skill) => (
                <button
                  key={`empty-${skill}`}
                  type="button"
                  className="quick-chip"
                  onClick={() => {
                    setSearchQuery(skill);
                    runMentorSearch(skill);
                  }}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        ) : (
           <div className="mentor-result-grid grid-auto-responsive">
            {paginatedMentorResults.map((result) => (
              <article key={result.mentorId} className="mentor-result-card">
                <div className="mentor-result-card-head">
                  <div>
                    <p className="mentor-result-label">Mentor</p>
                    <h4>{result.mentorName}</h4>
                  </div>
                  <div className="mentor-result-score">
                    <strong>{result.score}</strong>
                    <span>score</span>
                  </div>
                </div>

                <div className="mentor-result-meta-grid">
                  <div><span>Skill match</span><strong>{result.skillMatch}</strong></div>
                  <div><span>Rating</span><strong>{result.ratingScore}</strong></div>
                  <div><span>Response</span><strong>{result.responseTimeScore}</strong></div>
                  <div><span>Completion</span><strong>{result.completionRateScore}</strong></div>
                </div>

                <div className="mentor-result-card-actions">
                  <a className="meeting-link" href={`/mentors/${result.mentorId}`} onClick={(e) => { e.preventDefault(); requireLoginAndGo(`/mentors/${result.mentorId}`); }}>Open public profile</a>
                  <button type="button" onClick={() => handleBookNearestSession(result.mentorId)}>Book now</button>
                  <button
                    type="button"
                    onClick={() => {
                      const bestSkill = String(result?.skills || '').split(',')[0]?.trim() || searchQuery;
                      if (!bestSkill) {
                        return;
                      }
                      setSearchQuery(bestSkill);
                      runMentorSearch(bestSkill);
                    }}
                  >
                    Find similar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {hasMoreMentorResults && (
          <div ref={mentorLoadMoreRef} className="discover-load-more-anchor">
            <button
              type="button"
              onClick={() => setVisibleMentorResultsCount((prev) => prev + 8)}
            >
              Load more
            </button>
          </div>
        )}
      </section>
      )}

      {isMentor && isDiscoverPage && (
        <section className="dashboard-card">
          <h3>{t(language, 'revenueTitle')}</h3>
          <ul>
            <li>{t(language, 'weeklyEarnings')}: INR {mentorAnalytics.weeklyEarnings.toFixed(2)}</li>
            <li>{t(language, 'conversionFunnel')}: {mentorAnalytics.sessionsPosted} sessions {'->'} {mentorAnalytics.bookingsReceived} bookings {'->'} {mentorAnalytics.completedBookings} completed</li>
            <li>{t(language, 'repeatLearners')}: {mentorAnalytics.repeatLearners}</li>
            <li>{t(language, 'topSkillDemand')}: {mentorAnalytics.topSkillDemand}</li>
          </ul>
        </section>
      )}

      {(isMentorsPage || isDiscoverPage) && (
      <section className="dashboard-card">
        <h3>Mentor Portfolio</h3>
        {isMentor ? (
          <form onSubmit={handlePortfolioSave}>
            <textarea
              placeholder="Projects (one line each or bullet style)"
              value={portfolioForm.projects}
              onChange={(e) => setPortfolioForm((prev) => ({ ...prev, projects: e.target.value }))}
              rows={3}
            />
            <textarea
              placeholder="Certificates"
              value={portfolioForm.certificates}
              onChange={(e) => setPortfolioForm((prev) => ({ ...prev, certificates: e.target.value }))}
              rows={3}
            />
            <textarea
              placeholder="Past teaching sessions summary"
              value={portfolioForm.pastTeachingSessions}
              onChange={(e) => setPortfolioForm((prev) => ({ ...prev, pastTeachingSessions: e.target.value }))}
              rows={3}
            />
            <button type="submit">Save Portfolio</button>
          </form>
        ) : (
          <p className="muted">Portfolio editing is available on mentor accounts.</p>
        )}
        {portfolioMessage && <p className="muted">{portfolioMessage}</p>}
      </section>
      )}

      {(isMentorsPage || isDiscoverPage) && (
      <section className="dashboard-card">
        <h3>Session Packages</h3>
        {isMentor && (
          <form onSubmit={handlePackageCreate}>
            <input
              placeholder="Package title (e.g. React Bootcamp Bundle)"
              value={packageForm.title}
              onChange={(e) => setPackageForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
            <input
              placeholder="Description"
              value={packageForm.description}
              onChange={(e) => setPackageForm((prev) => ({ ...prev, description: e.target.value }))}
              required
            />
            <input
              type="number"
              placeholder="Session count"
              min="1"
              value={packageForm.sessionCount}
              onChange={(e) => setPackageForm((prev) => ({ ...prev, sessionCount: e.target.value }))}
              required
            />
            <input
              type="number"
              placeholder="Discount %"
              min="0"
              max="90"
              value={packageForm.discountPercent}
              onChange={(e) => setPackageForm((prev) => ({ ...prev, discountPercent: e.target.value }))}
              required
            />
            <input
              type="number"
              step="0.01"
              min="1"
              placeholder="Total package price"
              value={packageForm.totalPrice}
              onChange={(e) => setPackageForm((prev) => ({ ...prev, totalPrice: e.target.value }))}
              required
            />
            <button type="submit">Create Package</button>
          </form>
        )}
        {packageMessage && <p className="muted">{packageMessage}</p>}
        <ul>
          {sessionPackages.map((pkg) => (
            <li key={pkg.id}>
              <strong>{pkg.title}</strong> - {pkg.sessionCount} sessions - {pkg.discountPercent}% off - INR {pkg.totalPrice}
            </li>
          ))}
        </ul>
      </section>
      )}

      {isSessionsPage && (
      <section className="dashboard-card">
        <h3>Learning Roadmaps</h3>
        {roadmaps.length === 0 ? (
          <p className="muted">No roadmaps yet. A roadmap is auto-created when a learner books a session.</p>
        ) : (
          <ul>
            {roadmaps.map((roadmap) => (
              <li key={roadmap.id}>
                <div><strong>{roadmap.title}</strong></div>
                <div className="muted">Booking #{roadmap.booking?.id} | Progress: {roadmap.progressPercent}%</div>
                <textarea value={roadmap.milestones || ''} readOnly rows={4} />
                <div className="inline-form">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={roadmap.progressPercent || 0}
                    onBlur={(e) => handleRoadmapUpdate(roadmap.id, e.target.value)}
                  />
                  <span className="muted">Update on blur</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {isSessionsPage && (
      <section className="dashboard-card">
        <h3>Skill Verification Tasks</h3>
        {isMentor && (
          <form onSubmit={handleTaskCreate}>
            <input
              placeholder="Skill name (e.g. Java)"
              value={taskForm.skillName}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, skillName: e.target.value }))}
              required
            />
            <input
              placeholder="Task title"
              value={taskForm.title}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
            <textarea
              placeholder="Task instructions"
              rows={3}
              value={taskForm.instructions}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, instructions: e.target.value }))}
              required
            />
            <button type="submit">Publish Task</button>
          </form>
        )}

        {taskMessage && <p className="muted">{taskMessage}</p>}
        {verificationMessage && <p className="muted">{verificationMessage}</p>}

        <ul>
          {verificationTasks.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong> ({task.skillName})
              <p className="muted">{task.instructions}</p>
              {!isMentor && (
                <div className="inline-form">
                  <input
                    placeholder="Submit your solution link/text"
                    value={verificationAnswers[task.id] || ''}
                    onChange={(e) => setVerificationAnswers((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  />
                  <button type="button" onClick={() => handleVerificationSubmit(task.id)}>Submit</button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {isMentor && (
          <>
            <h4>Submissions to review</h4>
            <ul>
              {verificationSubmissions.map((submission) => (
                <li key={submission.id}>
                  <div>
                    <strong>{submission.task?.title}</strong> by {submission.learner?.fullName} - {submission.status}
                  </div>
                  <p className="muted">{submission.submissionText}</p>
                  {submission.status === 'PENDING' && (
                    <div className="inline-actions">
                      <button type="button" onClick={() => handleReviewSubmission(submission.id, 'APPROVED')}>Approve</button>
                      <button type="button" onClick={() => handleReviewSubmission(submission.id, 'REJECTED')}>Reject</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      )}

      {(isSessionsPage || isDiscoverPage) && (
      <section className="dashboard-card">
        <h3>Available sessions</h3>
        <div className="inline-form">
          <DateTimePicker
            label="Choose session date"
            onSelect={(date) => setSelectedSessionDate(date ? new Date(date).toISOString().slice(0, 10) : '')}
          />
          <button type="button" onClick={() => setSelectedSessionDate('')}>Clear date</button>
        </div>
        <div className="session-calendar-row">
          {sessionCalendarDays.slice(0, 14).map((item) => (
            <button
              key={item.dateKey}
              type="button"
              className={selectedSessionDate === item.dateKey ? 'session-day-pill active' : 'session-day-pill'}
              onClick={() => setSelectedSessionDate(item.dateKey)}
            >
              {item.dateKey} ({item.count})
            </button>
          ))}
        </div>
        <ul>
          {filteredSessions.map((s) => (
            <li key={s.id}>
              <div><strong>{s.title}</strong> | {s.sessionType} | INR {s.priceAmount}</div>
              <div className="muted">
                {formatSessionDateTime(s.startTime)} to {formatSessionDateTime(s.endTime)} ({userTimezone})
              </div>
              {s.meetingLink ? (
                <a className="meeting-link" href={s.meetingLink} target="_blank" rel="noreferrer">
                  Join meeting
                </a>
              ) : (
                <span className="muted">Meeting link not set</span>
              )}
              {profile?.id === s.mentor?.id && (
                <div className="inline-form">
                  <input
                    type="url"
                    placeholder="https://meet.google.com/... or https://zoom.us/..."
                    value={meetingLinks[s.id] || ''}
                    onChange={(e) => setMeetingLinks((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  />
                  <button type="button" onClick={() => handleMeetingLinkSave(s.id)}>Save Link</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      )}

      {(isSessionsPage || isDiscoverPage) && (
      <section className="dashboard-card">
        <h3>Bookings and reschedule flow</h3>
        {bookingActionMessage && <p className="muted">{bookingActionMessage}</p>}
        {relatedBookings.length === 0 ? (
          <p className="muted">No bookings yet.</p>
        ) : (
          <ul>
            {relatedBookings.map((booking) => {
              const isLearnerBooking = booking?.learner?.id === profile?.id;
              const isMentorBooking = booking?.session?.mentor?.id === profile?.id;
              return (
                <li key={booking.id}>
                  <div>
                    <strong>Booking #{booking.id}</strong> - {booking.session?.title}
                  </div>
                  <div className="muted">Status: {booking.bookingStatus}</div>
                  <div className="muted">
                    {formatSessionDateTime(booking.session?.startTime)} to {formatSessionDateTime(booking.session?.endTime)} ({userTimezone})
                  </div>
                  <div className="inline-actions">
                    {isLearnerBooking && ['ACCEPTED', 'PENDING'].includes(String(booking.bookingStatus || '')) && (
                      <button
                        type="button"
                        onClick={() => handleBookingStatusUpdate(booking.id, 'RESCHEDULE_REQUESTED', 'Reschedule request sent.')}
                      >
                        Request reschedule
                      </button>
                    )}
                    {isMentorBooking && String(booking.bookingStatus || '') === 'RESCHEDULE_REQUESTED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleBookingStatusUpdate(booking.id, 'ACCEPTED', 'Reschedule request approved.')}
                        >
                          Approve request
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBookingStatusUpdate(booking.id, 'CANCELLED', 'Reschedule request rejected and booking cancelled.')}
                        >
                          Reject request
                        </button>
                      </>
                    )}
                    {['PENDING', 'ACCEPTED', 'RESCHEDULE_REQUESTED'].includes(String(booking.bookingStatus || '')) && (
                      <button
                        type="button"
                        onClick={() => handleBookingStatusUpdate(booking.id, 'CANCELLED', 'Booking cancelled.')}
                      >
                        Cancel booking
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}

      {(isWalletPage || isDiscoverPage) && (
      <section className="dashboard-card">
        <h3>Payments</h3>
        <form onSubmit={handleCreatePayment}>
          <select name="bookingId" value={paymentForm.bookingId} onChange={handlePaymentChange} required>
            <option value="">Select booking</option>
            {paymentEligibleBookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                Booking #{booking.id} - {booking.session?.title} - {booking.bookingStatus} - INR {booking.session?.priceAmount}
              </option>
            ))}
          </select>
          {paymentEligibleBookings.length === 0 && (
            <p className="muted">No payable bookings available. Accept a booking first or complete a session without existing payment.</p>
          )}
          <input
            name="amount"
            type="number"
            step="0.01"
            min="1"
            value={paymentForm.amount}
            onChange={handlePaymentChange}
            placeholder="Amount (auto-filled from selected booking)"
            required
          />
          <select name="mode" value={paymentForm.mode} onChange={handlePaymentChange}>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="CRYPTO">Crypto</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
          <button type="submit">Create Payment Intent</button>
        </form>
        {paymentError && <p className="error">{paymentError}</p>}
        <ul>
          {payments.map((payment) => (
            <li key={payment.id}>
              <div>
                Booking #{payment.booking?.id} | INR {payment.amount} | {payment.mode} | <strong>{payment.status}</strong>
              </div>
              <div className="inline-actions">
                <button type="button" onClick={() => handleUpdatePaymentStatus(payment.id, 'ESCROWED')}>Escrowed</button>
                <button type="button" onClick={() => handleUpdatePaymentStatus(payment.id, 'RELEASED')}>Released</button>
                <button type="button" onClick={() => handleUpdatePaymentStatus(payment.id, 'REFUNDED')}>Refunded</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      )}

      {(isSessionsPage || isDiscoverPage) && (
      <section className="dashboard-card">
        <h3>Realtime Chat</h3>
        <select value={selectedBookingId} onChange={(e) => setSelectedBookingId(e.target.value)}>
          <option value="">Choose booking chat</option>
          {bookings.map((booking) => (
            <option key={booking.id} value={booking.id}>
              Booking #{booking.id} - {booking.session?.title}
            </option>
          ))}
        </select>
        {selectedBooking && (
          <p className="muted">Chat for booking #{selectedBooking.id}: {selectedBooking.session?.title}</p>
        )}
        <div className="chat-box">
          {chatMessages.length === 0 ? (
            <p className="muted">No messages yet.</p>
          ) : (
            chatMessages.map((msg) => (
              <div key={msg.id} className="chat-message">
                <strong>{msg.senderName}:</strong> {msg.content}
              </div>
            ))
          )}
        </div>
        <form className="chat-form" onSubmit={sendChatMessage}>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type your message"
            disabled={!selectedBookingId}
          />
          <button type="submit" disabled={!selectedBookingId}>Send</button>
        </form>
        {chatError && <p className="error">{chatError}</p>}
      </section>
      )}

      {isDiscoverPage && (
      <section className="dashboard-card">
        <h3>Learning Roadmaps</h3>
        {roadmaps.length === 0 ? (
          <p className="muted">No roadmaps yet. A roadmap is auto-created when a learner books a session.</p>
        ) : (
          <ul>
            {roadmaps.map((roadmap) => (
              <li key={roadmap.id}>
                <div><strong>{roadmap.title}</strong></div>
                <div className="muted">Booking #{roadmap.booking?.id} | Progress: {roadmap.progressPercent}%</div>
                <textarea value={roadmap.milestones || ''} readOnly rows={4} />
                <div className="inline-form">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={roadmap.progressPercent || 0}
                    onBlur={(e) => handleRoadmapUpdate(roadmap.id, e.target.value)}
                  />
                  <span className="muted">Update on blur</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {isDiscoverPage && (
      <section className="dashboard-card">
        <h3>Skill Verification Tasks</h3>
        {isMentor && (
          <form onSubmit={handleTaskCreate}>
            <input
              placeholder="Skill name (e.g. Java)"
              value={taskForm.skillName}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, skillName: e.target.value }))}
              required
            />
            <input
              placeholder="Task title"
              value={taskForm.title}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
            <textarea
              placeholder="Task instructions"
              rows={3}
              value={taskForm.instructions}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, instructions: e.target.value }))}
              required
            />
            <button type="submit">Publish Task</button>
          </form>
        )}

        {taskMessage && <p className="muted">{taskMessage}</p>}
        {verificationMessage && <p className="muted">{verificationMessage}</p>}

        <ul>
          {verificationTasks.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong> ({task.skillName})
              <p className="muted">{task.instructions}</p>
              {!isMentor && (
                <div className="inline-form">
                  <input
                    placeholder="Submit your solution link/text"
                    value={verificationAnswers[task.id] || ''}
                    onChange={(e) => setVerificationAnswers((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  />
                  <button type="button" onClick={() => handleVerificationSubmit(task.id)}>Submit</button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {isMentor && (
          <>
            <h4>Submissions to review</h4>
            <ul>
              {verificationSubmissions.map((submission) => (
                <li key={submission.id}>
                  <div>
                    <strong>{submission.task?.title}</strong> by {submission.learner?.fullName} - {submission.status}
                  </div>
                  <p className="muted">{submission.submissionText}</p>
                  {submission.status === 'PENDING' && (
                    <div className="inline-actions">
                      <button type="button" onClick={() => handleReviewSubmission(submission.id, 'APPROVED')}>Approve</button>
                      <button type="button" onClick={() => handleReviewSubmission(submission.id, 'REJECTED')}>Reject</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      )}

      <button className="mobile-logout submit-btn" onClick={onLogout}>Logout</button>
      </>
      )}
    </div>
  );
}
