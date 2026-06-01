import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useOptionalTheme } from '../context/ThemeContext';
import OptimizedImage from '../components/OptimizedImage';
import MobileBottomNav from '../components/MobileBottomNav';

const fallbackImages = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCHvCXL8kl0mgBSilrs6KvOUAWpOiG56NBUKdRnVEg9CkK5cj4kFo4xBODrWUVCTdVVx9ViZ5M_OA__ltQBuukT_ko5IXV3lNh08DibJwL3SD2jCxD16pXtFtFlDRIGBPK5ElDHWOrQaeV_dpFkn3GCrhzW_Lel-zKvGYFKAmseiLw68XAylHwHFjUB_sns00uv03FYkDcy-F6ifqxGzJNWHKbfOFhGFGqhc2TFjc7KDFc6wW4tFHr08zRqGtKxh0D6LgSnQkInmxRX',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDwQPPevs_m1GPSRMK_8hsxdmw331eV28YDVpGQQw8Fd3FX1lQDOsMwrRopJcfNbWSsDBAi1E_ZalGxMqsBItjFiy4IBDVfbIW0GEjXdu7ZhXG_b4YoiHzYCSugtDnW_A5E7fGalkDc7JYhJhADoxLT2qUy0u4h4ToH2oFdfONJt0OnaCWZSuEtpcsVYDjZiy29dzF9yUx9JM_0N5SYcK66exwYL-107getZ9_6hFkEB3ROZLXJjdZoKuD_Hgi-4a1ZgFj2xeVL-nOP',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAGLRE-gqb2kLiIu6udPe8aiDSKd6gHHt82jx7K8Dgtk7PgxMg2qr2m4lmcxhM6Ma8vb5cPpB3bxKlUVGAR4ztipCcEWr8ZA7TIkyxJu8ErLa6FNwEX36mhKT6aDpZYeg-EAKGVRpWKdiX0z6pjvhOGDJWA3F_1iQ2iZOYbKzH3c_S15XyL1kMHfCXLDdExwWCwn5D0doFjedDERYTO1RE-fIdyEbdoxrPCzwz-HvXzXarjHo1eRzio4ua86PfZmkUCydKN-PTvaotb',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBnEAADwedYLweg0XfOCryN42iKOA91y5jWcxPi8ZPFcm66JNapBih1XzaCuS1zW16sLrwNgzu7U-cb87n5bvMSBJ0xji5Nw-Ql-TZq-EwYTFSzBofM1D5SiOtl88TgEdq9qRqqPR3zsIfeYo9UQ1dejnlB2xsBOKMXa0DhmoCbG2mxb8RjGOMK8HDHioiy6GyoE-oEG9z6AhhLzByap97_22OWPJd5eqf12OPOxo6HF_qgIyaB_iA1tiQDx4pIs7jvs0KRVBjexyVV'
];

const formatDuration = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return '20:00';
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
        client.get('/api/v1/users/me'),
        client.get('/api/v1/sessions'),
        client.get('/api/v1/session-packages')
      ]);

      if (!isMounted) {
        return;
      }

      const getData = (index, fallback) => {
        const result = responses[index];
        if (result.status === 'fulfilled') {
          return result.value?.data?.data ?? fallback;
        }
        return fallback;
      };

      setSessions(getData(1, []));
      setSessionPackages(getData(2, []));
      setLoading(false);
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const videos = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const base = sessions
      .filter((session) => {
        if (!q) {
          return true;
        }
        return String(session?.title || '').toLowerCase().includes(q)
          || String(session?.sessionType || '').toLowerCase().includes(q)
          || String(session?.mentor?.fullName || '').toLowerCase().includes(q);
      })
      .slice(0, 8)
      .map((session, idx) => ({
        id: session.id,
        title: String(session?.title || 'Masterclass').trim(),
        author: String(session?.mentor?.fullName || 'SkillSwap Mentor').trim(),
        role: String(session?.sessionType || 'Workshop').trim(),
        duration: formatDuration(session?.startTime, session?.endTime),
        image: fallbackImages[idx % fallbackImages.length]
      }));

    if (base.length > 0) {
      return base;
    }

    return fallbackImages.map((image, idx) => ({
      id: `fallback-${idx}`,
      title: `Curated Masterclass ${idx + 1}`,
      author: 'SkillSwap Mentor',
      role: 'Workshop',
      duration: '20:00',
      image
    }));
  }, [searchText, sessions]);

  const featured = videos[0];

  const downloads = useMemo(() => (
    sessionPackages.slice(0, 3).map((pkg, idx) => ({
      id: pkg.id,
      title: String(pkg?.title || `Package ${idx + 1}`).trim(),
      meta: `${pkg?.sessionCount || 0} sessions - ${pkg?.discountPercent || 0}% off`,
      icon: idx % 2 === 0 ? 'folder_open' : 'description'
    }))
  ), [sessionPackages]);

  const guides = useMemo(() => (
    sessionPackages.slice(0, 2).map((pkg) => ({
      id: pkg.id,
      title: String(pkg?.title || 'Guide').trim(),
      meta: `${pkg?.description ? 'Package Guide' : 'Learning Guide'} - ${pkg?.sessionCount || 0} Modules`
    }))
  ), [sessionPackages]);

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24 md:pb-0">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-10 space-y-12">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-tertiary-fixed-variant">Instructor Overview</p>
            <h1 className="mb-4 text-4xl font-extrabold tracking-tighter text-on-surface sm:text-5xl lg:text-7xl">The Curated<br />Library</h1>
            <p className="max-w-xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
              {loading ? 'Fetching your latest resources from backend...' : 'A live catalog of sessions and teaching packages synced from your backend data.'}
            </p>
          </div>

          <div className="lg:col-span-4">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                className="w-full rounded-xl border-none bg-surface-container-low py-4 pl-12 pr-4 text-sm transition-all placeholder:text-on-surface-variant/50 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                placeholder="Search resources..."
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="relative h-[340px] overflow-hidden rounded-2xl bg-surface-container-low lg:col-span-2 sm:h-[380px] lg:h-[420px]">
            <OptimizedImage alt={featured?.title || 'Featured session'} className="absolute inset-0 h-full w-full object-cover opacity-80" src={featured?.image || fallbackImages[0]} priority />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <div className="absolute bottom-0 p-6 sm:p-8 lg:p-10">
              <span className="mb-4 inline-block rounded-full bg-tertiary-fixed px-3 py-1 text-xs font-bold uppercase tracking-widest text-on-tertiary-fixed">Featured Masterclass</span>
              <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl lg:text-4xl">{featured?.title || 'Masterclass'}</h2>
              <p className="mb-6 max-w-md text-sm text-white/80 sm:text-base">Led by {featured?.author || 'SkillSwap Mentor'} - {featured?.role || 'Workshop'} - {featured?.duration || '20:00'}</p>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-on-primary transition-all active:scale-95 hover:opacity-90"
                type="button"
                onClick={() => navigate('/sessions')}
              >
                Start Learning
                <span className="material-symbols-outlined">play_circle</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl bg-surface-container-low p-5 sm:p-6 lg:p-8">
            <div className="mb-6 flex items-center justify-between sm:mb-8">
              <h3 className="text-xl font-bold">My Downloads</h3>
              <span className="material-symbols-outlined text-primary">folder_open</span>
            </div>
            <div className="space-y-4 sm:space-y-6">
              {downloads.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No downloadable packages yet.</p>
              ) : downloads.map((item) => (
                <div key={item.id} className="group flex items-center gap-4 rounded-xl p-2 transition-colors hover:bg-surface-container-lowest/60">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-lowest text-primary shadow-sm">
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-on-surface">{item.title}</p>
                    <p className="text-xs text-on-surface-variant">{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="mt-6 rounded-xl border border-outline-variant/30 py-4 text-sm font-bold text-primary transition-colors hover:bg-surface-container-lowest"
              type="button"
              onClick={() => document.getElementById('videos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              View All Assets
            </button>
          </div>
        </section>

        <section className="space-y-10 sm:space-y-12 lg:space-y-16">
          <div>
            <div className="mb-8 flex items-center justify-between gap-4">
              <h3 className="flex items-center gap-3 text-2xl font-bold"><span className="h-2 w-2 rounded-full bg-primary" />Video Masterclasses</h3>
              <a className="text-sm font-semibold text-primary hover:underline" href="#videos">Explore Videos</a>
            </div>
            <div id="videos" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {videos.map((video) => (
                <article key={video.id} className="group cursor-pointer">
                  <div className="relative mb-4 aspect-video overflow-hidden rounded-xl bg-surface-container">
                    <OptimizedImage className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" alt={video.title} src={video.image} />
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="material-symbols-outlined text-5xl text-white">play_arrow</span>
                    </div>
                    <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-[10px] font-bold text-white">{video.duration}</span>
                  </div>
                  <h4 className="mb-1 leading-tight font-bold text-on-surface transition-colors group-hover:text-primary">{video.title}</h4>
                  <p className="text-xs text-on-surface-variant">by {video.author} � {video.role}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <section className="relative pl-0 lg:pl-10 lg:border-l-2 lg:border-surface-dim">
              <div className="mb-8 flex items-center justify-between">
                <h3 className="text-xl font-bold">Package Guides</h3>
                <span className="material-symbols-outlined text-on-surface-variant/30">auto_stories</span>
              </div>
              <div className="space-y-4">
                {guides.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">No package guides yet.</p>
                ) : guides.map((guide) => (
                  <div key={guide.id} className="flex items-center justify-between rounded-xl border border-transparent bg-surface-container-lowest p-5">
                    <div className="flex items-center gap-4">
                      <span className="material-symbols-outlined text-tertiary">description</span>
                      <div>
                        <p className="font-bold text-on-surface">{guide.title}</p>
                        <p className="text-xs text-on-surface-variant">{guide.meta}</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-primary">chevron_right</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="relative pl-0 lg:pl-10 lg:border-l-2 lg:border-surface-dim">
              <div className="mb-8 flex items-center justify-between">
                <h3 className="text-xl font-bold">Design Assets</h3>
                <span className="material-symbols-outlined text-on-surface-variant/30">brush</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[{ title: 'Icon System V1', meta: '120+ SVG Icons', icon: 'inventory_2' }, { title: 'Grain Textures', meta: '4K High Res', icon: 'palette' }].map((asset) => (
                  <div key={asset.title} className="group cursor-pointer overflow-hidden rounded-xl bg-surface-container-low p-4 transition-all hover:shadow-md">
                    <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-surface-container-lowest text-primary-container transition-transform group-hover:scale-105">
                      <span className="material-symbols-outlined text-4xl">{asset.icon}</span>
                    </div>
                    <p className="font-bold text-sm text-on-surface">{asset.title}</p>
                    <p className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant">{asset.meta}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>

      <MobileBottomNav />
    </div>
  );
}
