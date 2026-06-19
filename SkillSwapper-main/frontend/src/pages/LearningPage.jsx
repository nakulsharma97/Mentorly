import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import OptimizedImage from '../components/OptimizedImage';
import { SkeletonDashboard, SkeletonMentorGrid } from '../components/SkeletonLoaders';
import { getErrorFeedback, showInfoFeedback } from '../utils/comingSoon';

const fallbackMentors = [
  {
    name: 'Sarah Jenkins',
    role: 'React Architecture',
    rating: '5.0',
    sessions: '24 sessions',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBjNTG3sngoPr9AvpAKNJYQLwqUkWcFiLgQeUuPmo60qYPldgtKlj4UOX1b3UBPHs1l5VNyamL5MFM95PG0YkWmW2GSjeRcv5TRrJyFCMuHoyUCtZn99hDyXKSaJuiZ7xjLzS8NI-FwacJICaXSF0QC0Kbfs7odX6dAh-DQq3RIbmUKW0G4E-DJ6Guce0dGpJle0CGVI6IcWyU2rYc3xJuHymt0DOudVa8waYkIZxykKIWfc9yBqx3Kp1geG6U8K6Zau_gC4NlONnjp'
  },
  {
    name: 'Marcus Thorne',
    role: 'Finance & Strategy',
    rating: '4.8',
    sessions: '18 sessions',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuByxi1qjuNkRSjaPsBjBdo3GEP4qdc2F_oiysPTK3dqCwnQ-aY_rJSCRsjBHxW2-8veQm41qXq3x4hvKCgvBk8_sdO9n0C4wPe2TwQrN2OblNC7zSv2SQNwDVwFlmLMLTdLQYr_FhwLJJ7veTMO5YVf6ieO7MbjVKSfDocKS14HEZScdwHvLfM1_57JjNsA6QWF6O65Neq1mf6HXTfZF4UUF1uNUGvOSsORDYWQqf82FX_1GwjN4EeEUYGijXYi0SVKWxrTqISRvwRk'
  },
  {
    name: 'Elena Rossi',
    role: 'Brand Storytelling',
    rating: '4.9',
    sessions: '31 sessions',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCKk7cr0iV4dYV9t0Cp27asTWDd24iJDsmbX4UcevTIaotprzQUiZnPAdyD9-VnafrvUpzX5KbtMiEz1wWHPD2p_uhCqUQmgHawlWh2xO_yaex0WvqTHcGa5gmFO6XSzW3FpfCR4BiT9jqnMNn6XwmYOpA6JqigX7M8rKsS8yISEWAqxDmFMKbQpvmV0W-GPWQ51oipLXKBwtj2eE9x9IRoAOAH4wZBscjk7b2PZdNcNi52rpo8b2VpqSVHeicXgxqeTpZr43OGRHJ5'
  }
];

const fallbackSchedule = [
  {
    time: '09:30',
    title: 'Design System Review',
    type: 'Live mentoring',
    color: 'bg-emerald-500'
  },
  {
    time: '13:00',
    title: 'Practical UI Lab',
    type: 'Hands-on exercise',
    color: 'bg-sky-500'
  },
  {
    time: '18:30',
    title: 'Reflection and feedback',
    type: 'Progress check-in',
    color: 'bg-amber-500'
  }
];

const navigationItems = [
  { label: 'Overview', icon: 'dashboard', href: '#overview', sectionId: 'overview' },
  { label: 'Learning Path', icon: 'school', href: '#path', sectionId: 'path' },
  { label: 'Schedule', icon: 'event_available', href: '#schedule', sectionId: 'schedule' },
  { label: 'Mentor Hub', icon: 'group', href: '#mentors', sectionId: 'mentors' },
  { label: 'Certificates', icon: 'verified', href: '#certificates', sectionId: 'certificates' }
];

const parseMilestones = (milestones) => {
  const value = String(milestones || '').trim();
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n|•|\u2022|-/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
};

const formatSessionDateTime = (value) => {
  if (!value) {
    return 'TBD';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const buildFallbackCard = (index) => ({
  id: `sample-${index + 1}`,
  title: ['Editorial UI Foundations', 'Live React Architecture', 'Growth Design Systems'][index] || 'Learning roadmap',
  mentorName: fallbackMentors[index % fallbackMentors.length].name,
  learnerName: 'Learner',
  progressPercent: [84, 65, 42][index] || 0,
  milestones: [
    'Clarify the learning goal',
    'Review the mentor’s session outline',
    'Complete the practice assignment',
    'Book the next feedback session'
  ].join('\n'),
  sessionTitle: 'Guided lesson',
  sessionStartTime: null,
  sessionEndTime: null,
  bookingId: null
});

export default function LearningPage({ notify }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [roadmaps, setRoadmaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [roadmapReloadKey, setRoadmapReloadKey] = useState(0);
  const [activeSection, setActiveSection] = useState('overview');
  const [liveMentors, setLiveMentors] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [mentorSkillFilter, setMentorSkillFilter] = useState(() => searchParams.get('skill') || '');
  const [mentorsLoading, setMentorsLoading] = useState(true);
  const [availableSkills, setAvailableSkills] = useState([]);
  const navigate = useNavigate();
  const { roadmapId } = useParams();

  const currentDateLabel = useMemo(
    () => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: '2-digit' }).format(new Date()).toUpperCase(),
    []
  );

  useEffect(() => {
    let isMounted = true;

    const loadRoadmaps = async () => {
      setLoading(true);
      try {
        const response = await client.get('/api/v1/roadmaps');
        if (!isMounted) {
          return;
        }
        setRoadmaps(response?.data?.data || []);
        setErrorMessage('');
      } catch {
        if (!isMounted) {
          return;
        }
        setRoadmaps([]);
        setErrorMessage(getErrorFeedback('roadmapLoadFailed').message);
        notify?.({
          type: 'warning',
          title: 'Roadmap sync failed',
          message: getErrorFeedback('roadmapLoadHint').message
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRoadmaps();
    return () => {
      isMounted = false;
    };
  }, [notify, roadmapReloadKey]);

  useEffect(() => {
    let mounted = true;

    const loadLiveMentors = async () => {
      setMentorsLoading(true);
      try {
        const response = await client.get('/api/v1/users/mentors', {
          params: {
            skill: mentorSkillFilter || undefined
          }
        });
        if (!mounted) {
          return;
        }
        setLiveMentors(response?.data?.data || []);
      } catch {
        if (!mounted) {
          return;
        }
        setLiveMentors([]);
      } finally {
        if (mounted) {
          setMentorsLoading(false);
        }
      }
    };

    loadLiveMentors();
    const interval = setInterval(loadLiveMentors, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [mentorSkillFilter]);

  useEffect(() => {
    const urlSkill = searchParams.get('skill') || '';
    if (urlSkill !== mentorSkillFilter) {
      setMentorSkillFilter(urlSkill);
    }
  }, [mentorSkillFilter, searchParams]);

  useEffect(() => {
    const currentSkill = searchParams.get('skill') || '';
    const nextSkill = String(mentorSkillFilter || '').trim();
    if (currentSkill === nextSkill) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (nextSkill) {
      nextParams.set('skill', nextSkill);
    } else {
      nextParams.delete('skill');
    }
    setSearchParams(nextParams, { replace: true });
  }, [mentorSkillFilter, searchParams, setSearchParams]);

  useEffect(() => {
    let mounted = true;

    const loadSkills = async () => {
      try {
        const response = await client.get('/api/v1/users/mentors/skills');
        if (!mounted) {
          return;
        }
        setAvailableSkills(Array.isArray(response?.data?.data) ? response.data.data : []);
      } catch {
        if (!mounted) {
          return;
        }
        setAvailableSkills([]);
      }
    };

    loadSkills();
    return () => {
      mounted = false;
    };
  }, []);

  const normalizedRoadmaps = useMemo(() => {
    const mapped = roadmaps.map((roadmap, index) => ({
      id: roadmap.id,
      title: String(roadmap?.title || roadmap?.booking?.session?.title || 'Learning roadmap').trim(),
      mentorName: String(roadmap?.booking?.session?.mentor?.fullName || 'Mentor').trim(),
      learnerName: String(roadmap?.booking?.learner?.fullName || 'Learner').trim(),
      progressPercent: Math.min(100, Math.max(0, Number(roadmap?.progressPercent || 0))),
      milestones: parseMilestones(roadmap?.milestones),
      milestoneText: String(roadmap?.milestones || '').trim(),
      sessionTitle: String(roadmap?.booking?.session?.title || 'Session').trim(),
      sessionStartTime: roadmap?.booking?.session?.startTime || null,
      sessionEndTime: roadmap?.booking?.session?.endTime || null,
      bookingId: roadmap?.booking?.id || null,
      active: Number(roadmap?.progressPercent || 0) < 100,
      fallbackColor: ['from-emerald-500 to-teal-400', 'from-sky-500 to-cyan-400', 'from-amber-500 to-orange-400'][index % 3]
    }));

    if (mapped.length > 0) {
      return mapped;
    }

    return [buildFallbackCard(0), buildFallbackCard(1), buildFallbackCard(2)];
  }, [roadmaps]);

  const selectedRoadmap = useMemo(
    () => normalizedRoadmaps.find((item) => String(item.id) === String(roadmapId)) || null,
    [normalizedRoadmaps, roadmapId]
  );

  const lessonMilestones = useMemo(
    () => parseMilestones(selectedRoadmap?.milestoneText || selectedRoadmap?.milestones?.join('\n') || ''),
    [selectedRoadmap]
  );

  const averageProgress = useMemo(() => {
    if (normalizedRoadmaps.length === 0) {
      return 0;
    }
    return Math.round(normalizedRoadmaps.reduce((sum, roadmap) => sum + Number(roadmap.progressPercent || 0), 0) / normalizedRoadmaps.length);
  }, [normalizedRoadmaps]);

  const completedCount = useMemo(() => normalizedRoadmaps.filter((roadmap) => roadmap.progressPercent >= 100).length, [normalizedRoadmaps]);
  const activeCount = useMemo(() => normalizedRoadmaps.filter((roadmap) => roadmap.progressPercent > 0 && roadmap.progressPercent < 100).length, [normalizedRoadmaps]);
  const totalCount = normalizedRoadmaps.length;

  function formatMentorSkills(rawSkills) {
    const value = String(rawSkills || '').trim();
    if (!value) {
      return 'Mentor';
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          const names = parsed
            .map((item) => {
              if (typeof item === 'string') {
                return item.trim();
              }
              return String(item?.name || item?.skill || '').trim();
            })
            .filter(Boolean);
          if (names.length > 0) {
            return names.slice(0, 2).join(', ');
          }
        }
      } catch {
        return value;
      }
    }
    return value;
  }

  const mentorHighlights = useMemo(() => {
    const fromLiveMentors = (liveMentors || []).map((mentor) => ({
      id: mentor.id,
      name: mentor.fullName,
      role: formatMentorSkills(mentor.skills),
      rating: Number(mentor.averageRating || 0).toFixed(1),
      sessions: `${mentor.totalReviews || 0} reviews`,
      image: mentor.profileImageUrl || '',
      liveNow: Boolean(mentor.liveNow),
      lastActiveAt: mentor.lastActiveAt
    }));

    return fromLiveMentors;
  }, [liveMentors]);

  const formatMentorPresence = (mentor) => {
    if (mentor.liveNow) {
      return 'Live now';
    }
    if (!mentor.lastActiveAt) {
      return 'Recently active';
    }
    const time = new Date(mentor.lastActiveAt).getTime();
    if (Number.isNaN(time)) {
      return 'Recently active';
    }
    const diffMs = Date.now() - time;
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMinutes < 60) {
      return `Active ${diffMinutes}m ago`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    return `Active ${diffHours}h ago`;
  };

  const upcomingSchedule = useMemo(() => {
    const fromRoadmaps = normalizedRoadmaps
      .filter((roadmap) => roadmap.sessionStartTime)
      .sort((a, b) => new Date(a.sessionStartTime).getTime() - new Date(b.sessionStartTime).getTime())
      .slice(0, 3)
      .map((roadmap, index) => ({
        time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(roadmap.sessionStartTime)),
        title: roadmap.sessionTitle || roadmap.title,
        type: `${roadmap.mentorName} • ${roadmap.progressPercent}% complete`,
        color: ['bg-emerald-500', 'bg-sky-500', 'bg-amber-500'][index % 3]
      }));

    return fromRoadmaps.length > 0 ? fromRoadmaps : fallbackSchedule;
  }, [normalizedRoadmaps]);

  useEffect(() => {
    const sectionIds = ['overview', 'path', 'schedule', 'mentors', 'certificates'];
    if (selectedRoadmap) {
      sectionIds.push('lesson-detail');
    }

    const updateActiveSection = () => {
      const current = sectionIds.findLast((sectionId) => {
        const element = document.getElementById(sectionId);
        if (!element) {
          return false;
        }
        return element.getBoundingClientRect().top <= 150;
      });

      if (current) {
        setActiveSection(current);
      }
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, [selectedRoadmap]);

  const sidebarLinkClass = (sectionId) => {
    const isActive = activeSection === sectionId;
    return isActive
      ? 'flex items-center gap-3 rounded-r-full bg-white px-5 py-3 text-sm font-bold text-emerald-800 shadow-sm'
      : 'flex items-center gap-3 px-5 py-3 text-sm font-medium text-slate-600 transition-transform hover:translate-x-1';
  };

  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  const roadmapCards = normalizedRoadmaps;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <aside className="fixed left-0 top-20 z-20 hidden h-[calc(100vh-5rem)] w-72 flex-col border-r border-slate-200/60 bg-slate-50/95 pt-7 backdrop-blur-xl lg:flex">
        <div className="mb-8 px-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-900 text-white shadow-sm">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
            </span>
            <div>
              <p className="text-lg font-black leading-tight text-emerald-900">The Curator</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-700">Expert Level</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            Stay focused on the path you’ve chosen. Follow modules, track your growth, and open each lesson in a detailed view.
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navigationItems.map((item) => (
            <a
              key={item.label}
              className={sidebarLinkClass(item.sectionId)}
              href={item.href}
            >
              <span className="material-symbols-outlined" style={activeSection === item.sectionId ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              {item.label}
            </a>
          ))}
          {selectedRoadmap && (
            <a
              className={sidebarLinkClass('lesson-detail')}
              href="#lesson-detail"
            >
              <span className="material-symbols-outlined" style={activeSection === 'lesson-detail' ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                docs
              </span>
              Lesson Detail
            </a>
          )}
        </nav>

        <div className="px-5 pb-5">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/10 transition-all hover:opacity-90 active:scale-95"
            type="button"
            onClick={() => navigate('/mentors')}
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Schedule Session
          </button>
        </div>

        <div className="border-t border-slate-200/60 px-3 pt-4">
          <Link className="flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-800" to="/messages">
            <span className="material-symbols-outlined">help_outline</span>
            Support
          </Link>
          <Link className="flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-800" to="/home">
            <span className="material-symbols-outlined">logout</span>
            Sign Out
          </Link>
        </div>
      </aside>

      <main className="min-h-screen bg-surface px-4 pb-12 pt-6 sm:px-6 lg:ml-72 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          <section id="overview" className="overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white shadow-[0_24px_60px_rgba(2,10,22,0.22)]">
            <div className="relative grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="relative p-6 sm:p-8 lg:p-12">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">Current Module</span>
                </div>
                <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Build skills with a structured learning path, clear milestones, and live mentorship.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  Skill Swapper keeps your learning journey in one place. Real roadmap progress loads from the backend, each card opens a dedicated lesson view, and the sidebar now follows the section you are reading.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">Today</p>
                    <p className="mt-2 text-lg font-bold text-white">{currentDateLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">Average Progress</p>
                    <p className="mt-2 text-lg font-bold text-white">{averageProgress}%</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">Active Roadmaps</p>
                    <p className="mt-2 text-lg font-bold text-white">{activeCount} / {totalCount}</p>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-950 shadow-lg transition-transform active:scale-95 hover:bg-emerald-50" type="button" onClick={() => document.getElementById('path')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                    View learning path
                  </button>
                  <button className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-transform active:scale-95 hover:bg-white/10" type="button" onClick={() => document.getElementById('schedule')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                    Today’s schedule
                  </button>
                </div>
              </div>

              <div className="relative p-6 sm:p-8 lg:p-12">
                <div className="rounded-[24px] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Roadmap Summary</p>
                      <p className="mt-2 text-2xl font-black tracking-tight text-white">{selectedRoadmap ? selectedRoadmap.title : 'Your active learning path'}</p>
                    </div>
                    <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300">{loading ? 'SYNC' : 'LIVE'}</span>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Mentor</p>
                      <p className="mt-1 text-base font-bold text-white">{selectedRoadmap?.mentorName || mentorHighlights[0]?.name || 'Mentor'}</p>
                    </div>
                    <div className="rounded-2xl bg-white/8 p-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Current lesson</p>
                      <p className="mt-1 text-base font-bold text-white">{selectedRoadmap?.sessionTitle || 'Open a lesson card below to view details'}</p>
                    </div>
                    <div className="rounded-2xl bg-white/8 p-4">
                      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-300">
                        <span>Overall completion</span>
                        <span>{selectedRoadmap ? `${selectedRoadmap.progressPercent}%` : `${averageProgress}%`}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${selectedRoadmap ? selectedRoadmap.progressPercent : averageProgress}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {errorMessage && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                  onClick={() => setRoadmapReloadKey((prev) => prev + 1)}
                >
                  Retry sync
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700">
              <SkeletonDashboard />
            </div>
          )}

          {selectedRoadmap && (
            <section id="lesson-detail" className="grid gap-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Lesson Detail</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-on-surface sm:text-3xl">{selectedRoadmap.title}</h2>
                <p className="mt-4 text-sm leading-7 text-on-surface-variant">
                  Opened from the learning path cards. This page shows the live roadmap pulled from the backend for booking #{selectedRoadmap.bookingId || selectedRoadmap.id}.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 hover:opacity-90" type="button" onClick={() => navigate('/sessions')}>
                    Back to path
                  </button>
                  <button className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-transform active:scale-95 hover:bg-slate-50" type="button" onClick={() => document.getElementById('path')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                    Go to modules
                  </button>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl bg-slate-50 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Learner</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">{selectedRoadmap.learnerName}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Mentor</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">{selectedRoadmap.mentorName}</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Session</p>
                  <p className="mt-1 text-sm font-bold text-on-surface">{selectedRoadmap.sessionTitle}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">{formatSessionDateTime(selectedRoadmap.sessionStartTime)}{selectedRoadmap.sessionEndTime ? ` - ${formatSessionDateTime(selectedRoadmap.sessionEndTime)}` : ''}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
                    <span>Progress</span>
                    <span>{selectedRoadmap.progressPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" style={{ width: `${selectedRoadmap.progressPercent}%` }} />
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Milestones</p>
                  <ul className="mt-3 space-y-2 text-sm text-on-surface-variant">
                    {(lessonMilestones.length > 0 ? lessonMilestones : ['No milestones saved yet.']).map((item, index) => (
                      <li key={`${item}-${index}`} className="flex gap-3">
                        <span className="mt-1 h-2 w-2 flex-none rounded-full bg-emerald-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          <section id="path" className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Learning Path</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-on-surface sm:text-3xl">Your roadmap cards open full lesson views.</h2>
              </div>
              <span className="hidden text-sm font-bold text-slate-500 sm:inline-flex">{completedCount} completed</span>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {roadmapCards.map((roadmap, index) => {
                const isSelected = String(roadmap.id) === String(roadmapId);
                const progressColor = ['from-emerald-500 to-teal-400', 'from-sky-500 to-cyan-400', 'from-amber-500 to-orange-400'][index % 3];
                return (
                  <Link
                    key={roadmap.id}
                    to={`/sessions/${roadmap.id}`}
                    className={`group rounded-2xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${isSelected ? 'border-emerald-300 ring-2 ring-emerald-200' : 'border-slate-200'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-black text-white shadow-sm ${roadmap.fallbackColor || progressColor}`}>
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${roadmap.progressPercent >= 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {roadmap.progressPercent >= 100 ? 'Completed' : roadmap.progressPercent > 0 ? 'In progress' : 'Not started'}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-extrabold tracking-tight text-on-surface">{roadmap.title}</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">Mentor: {roadmap.mentorName}</p>
                    <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                      Learner progress is loaded from the backend and reflected here in real time.
                    </p>
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>{roadmap.progressPercent}% complete</span>
                        <span>{roadmap.bookingId ? `Booking #${roadmap.bookingId}` : 'Demo roadmap'}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full bg-gradient-to-r ${progressColor}`} style={{ width: `${roadmap.progressPercent}%` }} />
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Open lesson</span>
                      <span className="material-symbols-outlined text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-primary">arrow_forward</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section id="schedule" className="grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-6">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Today’s Schedule</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-on-surface sm:text-3xl">Live sessions and practice blocks.</h2>
                </div>
                <button className="text-sm font-bold text-primary hover:underline" type="button" onClick={() => document.getElementById('overview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  Back to top
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <div className="divide-y divide-slate-100 rounded-xl bg-white">
                  {upcomingSchedule.map((item, index) => (
                    <div key={`${item.title}-${index}`} className="flex flex-col gap-4 p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 flex-none flex-col items-center justify-center rounded-xl bg-slate-100">
                          <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">
                            {currentDateLabel.split(' ')[1] || 'Today'}
                          </span>
                          <span className="text-sm font-black text-on-surface">{item.time}</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-on-surface">{item.title}</h3>
                          <p className="text-sm text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">event_available</span>
                            {item.type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:justify-end">
                        <span className={`h-3 w-3 rounded-full ${item.color}`} />
                        <button
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                          type="button"
                          onClick={() => showInfoFeedback({ key: 'sessionOpened', params: { name: item.title }, notify })}
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Progress snapshot</p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-on-surface">What the backend says</h3>
                <div className="mt-6 space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
                      <span>Average completion</span>
                      <span>{averageProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${averageProgress}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
                      <span>Completed roadmaps</span>
                      <span>{completedCount}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400" style={{ width: `${totalCount ? Math.round((completedCount / totalCount) * 100) : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-6">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Next Milestone</p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-on-surface">Finish the next module and unlock your badge.</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Complete the roadmap, review the milestones, and open the detailed lesson view to move step by step.
                </p>
              </div>
            </aside>
          </section>

          <section id="mentors" className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Mentor Hub</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-on-surface sm:text-3xl">People guiding the learning path.</h2>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={mentorSkillFilter}
                  onChange={(event) => setMentorSkillFilter(event.target.value)}
                  className="w-full sm:w-72 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-emerald-300 focus:outline-none"
                >
                  <option value="">All skills</option>
                  {availableSkills.map((skill) => (
                    <option key={skill} value={skill}>{skill}</option>
                  ))}
                </select>
                <Link className="hidden text-sm font-bold text-primary hover:underline sm:inline-flex" to="/mentors">
                  Browse all mentors
                </Link>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {mentorsLoading ? (
                <div className="md:col-span-3">
                  <SkeletonMentorGrid cards={3} />
                </div>
              ) : mentorHighlights.length === 0 ? (
                <div className="md:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>No mentors found for this filter. Try another skill or clear the filter.</span>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      onClick={() => setMentorSkillFilter('')}
                    >
                      Clear filter
                    </button>
                  </div>
                </div>
              ) : mentorHighlights.map((mentor) => (
                <article key={`${mentor.name}-${mentor.role}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                  <div className="h-44 overflow-hidden bg-slate-100">
                    {mentor.image ? (
                      <OptimizedImage className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" alt={mentor.name} src={mentor.image} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500 to-cyan-500 text-4xl font-black text-white">
                        {String(mentor.name).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-extrabold tracking-tight text-on-surface">{mentor.name}</h3>
                        <p className="text-sm text-on-surface-variant">{mentor.role}</p>
                        <p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${mentor.liveNow ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          <span className={`h-2 w-2 rounded-full ${mentor.liveNow ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {formatMentorPresence(mentor)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right">
                        <p className="text-xs font-bold text-emerald-700">{mentor.rating}</p>
                        <p className="text-[10px] uppercase tracking-widest text-emerald-600">Rating</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-600">
                      <span>{mentor.sessions}</span>
                      <a href={`/mentors/${mentor.id}`} className="font-bold text-primary hover:underline" onClick={(e) => { e.preventDefault();
                        navigate(`/mentors/${mentor.id}`);
                      }}>
                        View profile
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="certificates" className="grid gap-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Certificates</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-on-surface sm:text-3xl">Proof of progress that can follow you anywhere.</h2>
              <p className="mt-4 text-sm leading-7 text-on-surface-variant">
                Track completed lessons, export credentials, and keep your learning progress visible as you move through the platform.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Aug 2023</p>
                <h3 className="mt-2 text-base font-bold text-on-surface">Mastering Micro-interactions</h3>
                <p className="mt-2 text-sm text-on-surface-variant">Completed with distinction.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">May 2023</p>
                <h3 className="mt-2 text-base font-bold text-on-surface">User-Centered Architecture</h3>
                <p className="mt-2 text-sm text-on-surface-variant">Mentor-reviewed project and portfolio badge.</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity lg:hidden ${mobileSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={closeMobileSidebar}
      />

      <aside className={`fixed left-0 top-20 z-50 flex h-[calc(100vh-5rem)] w-72 max-w-[85vw] flex-col border-r border-slate-200/60 bg-slate-50/95 pt-7 backdrop-blur-xl transition-transform duration-300 lg:hidden ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-900 text-white shadow-sm">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
            </span>
            <div>
              <p className="text-lg font-black leading-tight text-emerald-900">Skill Swapper</p>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-600">Learning Path</p>
            </div>
          </div>
          <button type="button" className="p-2 text-slate-500" onClick={closeMobileSidebar}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navigationItems.map((item) => (
            <a
              key={item.label}
              className={sidebarLinkClass(item.sectionId)}
              href={item.href}
              onClick={closeMobileSidebar}
            >
              <span className="material-symbols-outlined" style={activeSection === item.sectionId ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              {item.label}
            </a>
          ))}
          {selectedRoadmap && (
            <a
              className={sidebarLinkClass('lesson-detail')}
              href="#lesson-detail"
              onClick={closeMobileSidebar}
            >
              <span className="material-symbols-outlined" style={activeSection === 'lesson-detail' ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                docs
              </span>
              Lesson Detail
            </a>
          )}
        </nav>

        <div className="px-5 pb-5">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/10 transition-all hover:opacity-90 active:scale-95"
            type="button"
            onClick={() => navigate('/mentors')}
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Schedule Session
          </button>
        </div>
      </aside>
    </div>
  );
}
