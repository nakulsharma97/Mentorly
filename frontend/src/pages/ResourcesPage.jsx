import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import client from '../api/client';
import { RESOURCE_CATALOG } from '../modules/learner/components/learningPath/data';
import MobileBottomNav from '../components/MobileBottomNav';

const formatDuration = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return null;
  }
  const mins = Math.max(1, Math.round((e.getTime() - s.getTime()) / 60000));
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
};

export default function ResourcesPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [sessionPackages, setSessionPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      const responses = await Promise.allSettled([
        client.get('/api/v1/sessions'),
        client.get('/api/v1/session-packages')
      ]);

      if (!isMounted) {
        return;
      }

      const getData = (index, fallback) => {
        const result = responses[index];
        if (result.status === 'fulfilled') {
          const value = result.value?.data?.data ?? fallback;
          // Paginated endpoint — unwrap .content from the Page object.
          return Array.isArray(value) ? value : (value?.content ?? fallback);
        }
        return fallback;
      };

      setSessions(getData(0, []));
      setSessionPackages(getData(1, []));
      setLoading(false);
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const q = searchText.trim().toLowerCase();

  /** Catalog categories that survive the active search. */
  const catalog = useMemo(() => {
    return RESOURCE_CATALOG
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) => !q || item.title.toLowerCase().includes(q) || item.url.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [q]);

  const liveSessions = useMemo(() => {
    const base = sessions.filter((session) => {
      if (!q) return true;
      return String(session?.title || '').toLowerCase().includes(q)
        || String(session?.sessionType || '').toLowerCase().includes(q)
        || String(session?.mentor?.fullName || '').toLowerCase().includes(q);
    });
    return base.slice(0, 6);
  }, [q, sessions]);

  const packages = useMemo(() => {
    const base = sessionPackages.filter((pkg) => {
      if (!q) return true;
      return String(pkg?.title || '').toLowerCase().includes(q);
    });
    return base.slice(0, 3);
  }, [q, sessionPackages]);

  const hasAnything = catalog.length > 0 || liveSessions.length > 0 || packages.length > 0;

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24 md:pb-0">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-10 space-y-12">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-tertiary-fixed-variant">Learning Resources</p>
            <h1 className="mb-4 text-4xl font-extrabold tracking-tighter text-on-surface sm:text-5xl lg:text-7xl">The Curated<br />Library</h1>
            <p className="max-w-xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
              Real, working resources — official documentation, YouTube courses, public cheat sheets and live sessions. Every external link opens in a new tab.
            </p>
          </div>

          <div className="lg:col-span-4">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                className="w-full rounded-xl border-none bg-surface-container-low py-4 pl-12 pr-10 text-sm transition-all placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                placeholder="Search resources, docs, videos, sessions..."
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container-lowest"
                  onClick={() => setSearchText('')}
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
          </div>
        ) : !hasAnything ? (
          <section className="rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low px-6 py-20 text-center">
            <span className="material-symbols-outlined mb-4 text-5xl text-on-surface-variant/50">library_books</span>
            <h2 className="mb-2 text-xl font-bold">No learning resources are available yet.</h2>
            <p className="mx-auto max-w-md text-sm text-on-surface-variant">
              Resources will appear here as soon as real content is published. Try a different search term.
            </p>
          </section>
        ) : (
          <>
            {catalog.length > 0 && (
              <section className="space-y-8">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="flex items-center gap-3 text-2xl font-bold">
                    <span className="h-2 w-2 rounded-full bg-primary" />Resource Library
                  </h2>
                  <span className="text-xs text-on-surface-variant">All external links open in a new tab</span>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {catalog.map((cat) => (
                    <article key={cat.title} className="flex flex-col rounded-2xl bg-surface-container-low p-6 transition-shadow hover:shadow-md">
                      <div className="mb-4 flex items-center gap-3">
                        <span
                          className="flex h-11 w-11 items-center justify-center rounded-xl"
                          style={{ background: `${cat.color}1f`, color: cat.color }}
                        >
                          <span className="material-symbols-outlined">{cat.icon}</span>
                        </span>
                        <div>
                          <h3 className="text-lg font-bold">{cat.title}</h3>
                          {cat.blurb ? <p className="text-xs text-on-surface-variant">{cat.blurb}</p> : null}
                        </div>
                      </div>
                      <ul className="mb-5 flex flex-col gap-2.5">
                        {cat.items.map((item) => (
                          <li key={item.title}>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-start gap-2 rounded-lg p-1.5 -m-1.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-lowest hover:text-primary"
                            >
                              <span className="material-symbols-outlined mt-0.5 text-base text-on-surface-variant/40 transition-colors group-hover:text-primary">open_in_new</span>
                              <span className="min-w-0 flex-1 leading-snug">{item.title}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto border-t border-outline-variant/30 pt-4 text-xs font-semibold text-primary">
                        {cat.items.length} resource{cat.items.length === 1 ? '' : 's'} available
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {liveSessions.length > 0 && (
              <section className="space-y-8">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="flex items-center gap-3 text-2xl font-bold">
                    <span className="h-2 w-2 rounded-full bg-tertiary" />Live Sessions
                  </h2>
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary hover:underline"
                    onClick={() => navigate('/sessions')}
                  >
                    View all sessions
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {liveSessions.map((session) => {
                    const duration = formatDuration(session?.startTime, session?.endTime);
                    return (
                      <button
                        key={session.id}
                        type="button"
                        className="group flex flex-col rounded-2xl bg-surface-container-low p-6 text-left transition-all hover:shadow-md active:scale-95"
                        onClick={() => navigate('/sessions')}
                      >
                        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-tertiary-fixed text-on-tertiary-fixed">
                          <span className="material-symbols-outlined">play_circle</span>
                        </span>
                        <h3 className="mb-1 font-bold leading-snug transition-colors group-hover:text-primary">
                          {String(session?.title || 'Masterclass').trim()}
                        </h3>
                        <p className="text-xs text-on-surface-variant">
                          {String(session?.mentor?.fullName || 'SkillSwap Mentor').trim()}
                          {duration ? ` · ${duration}` : ''}
                        </p>
                        <span className="mt-4 text-xs font-semibold uppercase tracking-wide text-tertiary">
                          {String(session?.sessionType || 'Workshop').trim()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {packages.length > 0 && (
              <section className="space-y-6">
                <h2 className="flex items-center gap-3 text-2xl font-bold">
                  <span className="h-2 w-2 rounded-full bg-primary" />Session Packages
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      className="flex items-center gap-4 rounded-2xl bg-surface-container-low p-5 text-left transition-all hover:shadow-md active:scale-95"
                      onClick={() => navigate('/sessions')}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
                        <span className="material-symbols-outlined">folder_open</span>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold">{String(pkg?.title || 'Package').trim()}</p>
                        <p className="text-xs text-on-surface-variant">
                          {pkg?.sessionCount || 0} sessions{pkg?.discountPercent ? ` · ${pkg.discountPercent}% off` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
}
