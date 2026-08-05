const fs = require("fs");

const markup = `
<div class="ss-crm">
  <div class="ss-crm__inner">
    <section class="ss-hero">
      <div class="ss-hero__content">
        <span class="ss-hero__badge">👨‍🎓 My Students</span>
        <h1 class="ss-hero__title">My Students</h1>
        <p class="ss-hero__sub">Track learner progress, manage mentoring sessions and monitor achievements.</p>
        <div class="ss-hero__actions">
          <button type="button" class="ss-hero__btn ss-hero__btn--ghost"><span class="material-symbols-outlined">refresh</span>Refresh</button>
          <button type="button" class="ss-hero__btn ss-hero__btn--solid"><span class="material-symbols-outlined">add</span>New Session</button>
        </div>
      </div>
      <div class="ss-hero__art" aria-hidden="true">
        <div class="ss-hero__blob ss-hero__blob--1"></div>
        <div class="ss-hero__blob ss-hero__blob--2"></div>
        <div class="ss-hero__card ss-hero__card--stat"><div class="ss-hero__stat-num">12</div><div class="ss-hero__stat-label">Active learners</div></div>
        <div class="ss-hero__card ss-hero__card--main">
          <div class="ss-hero__card-head">
            <span class="ss-hero__card-icon"><span class="material-symbols-outlined">school</span></span>
            <div><div class="ss-hero__card-title">Mentorship Hub</div><div class="ss-hero__card-sub">Weekly progress</div></div>
          </div>
          <div class="ss-hero__avatars"><span class="ss-hero__mini-avatar">AR</span><span class="ss-hero__mini-avatar">PK</span><span class="ss-hero__mini-avatar">RS</span><span class="ss-hero__mini-avatar">+2</span></div>
        </div>
        <div class="ss-hero__card ss-hero__card--chart">
          <div class="ss-hero__card-sub" style="margin-bottom:8px">Sessions this month</div>
          <div class="ss-hero__chart-bars"><span class="ss-hero__chart-bar" style="height:38%"></span><span class="ss-hero__chart-bar" style="height:62%"></span><span class="ss-hero__chart-bar" style="height:46%"></span><span class="ss-hero__chart-bar" style="height:80%"></span><span class="ss-hero__chart-bar" style="height:58%"></span></div>
        </div>
      </div>
    </section>

    <div class="ss-stats">
      <div class="ss-stat"><span class="ss-stat__icon ss-stat__icon--teal"><span class="material-symbols-outlined">groups</span></span><div><div class="ss-stat__value">14</div><div class="ss-stat__label">Total Students</div></div></div>
      <div class="ss-stat"><span class="ss-stat__icon ss-stat__icon--blue"><span class="material-symbols-outlined">bolt</span></span><div><div class="ss-stat__value">12</div><div class="ss-stat__label">Active Students</div></div></div>
      <div class="ss-stat"><span class="ss-stat__icon ss-stat__icon--green"><span class="material-symbols-outlined">task_alt</span></span><div><div class="ss-stat__value">48</div><div class="ss-stat__label">Completed Sessions</div></div></div>
      <div class="ss-stat"><span class="ss-stat__icon ss-stat__icon--orange"><span class="material-symbols-outlined">star</span></span><div><div class="ss-stat__value">4.8</div><div class="ss-stat__label">Average Rating</div></div></div>
    </div>

    <div class="ss-crm__grid">
      <main class="ss-crm__main">
        <div class="ss-toolbar">
          <label class="ss-toolbar__search"><span class="material-symbols-outlined">search</span><input type="search" placeholder="Search student by name, email, skill or roadmap..."/></label>
          <select class="ss-toolbar__select"><option>All skills</option></select>
          <select class="ss-toolbar__select"><option>All statuses</option></select>
          <select class="ss-toolbar__select"><option>Upcoming session</option></select>
          <select class="ss-toolbar__select"><option>Newest</option></select>
          <button type="button" class="ss-toolbar__filter"><span class="material-symbols-outlined">tune</span></button>
        </div>
        <div class="ss-list">
          <article class="ss-card is-selected">
            <div class="ss-card__row">
              <span class="ss-card__avatar">TD<span class="ss-card__avatar-dot is-online"></span></span>
              <div class="ss-card__info"><h3 class="ss-card__name">Tushar Dhiman</h3><p class="ss-card__email">tushar.dhiman@example.com</p><span class="ss-card__skill">Java · Spring Boot</span></div>
              <div class="ss-card__progress">
                <div class="ss-card__progress-head"><span class="ss-card__progress-label">Progress</span><span class="ss-card__progress-value">72%</span></div>
                <div class="ss-track"><span class="ss-track__fill" style="width:72%"></span></div>
                <span class="ss-card__progress-topics">8 completed · 3 remaining</span>
              </div>
              <div class="ss-card__next">
                <span class="ss-card__next-icon"><span class="material-symbols-outlined">calendar_month</span></span>
                <div style="min-width:0"><div class="ss-card__next-day">12 Aug</div><div class="ss-card__next-meta">10:30 · Google Meet</div></div>
              </div>
            </div>
            <div class="ss-card__actions">
              <button type="button" class="ss-card__action ss-card__action--primary"><span class="material-symbols-outlined">chat_bubble</span>Message</button>
              <button type="button" class="ss-card__action ss-card__action--outline"><span class="material-symbols-outlined">map</span>View Roadmap</button>
              <button type="button" class="ss-card__action ss-card__action--ghost"><span class="material-symbols-outlined">event</span>Schedule</button>
            </div>
          </article>
          <article class="ss-card">
            <div class="ss-card__row">
              <span class="ss-card__avatar">PK<span class="ss-card__avatar-dot"></span></span>
              <div class="ss-card__info"><h3 class="ss-card__name">Priya Kapoor</h3><p class="ss-card__email">priya.k@example.com</p><span class="ss-card__skill">React · TypeScript</span></div>
              <div class="ss-card__progress">
                <div class="ss-card__progress-head"><span class="ss-card__progress-label">Progress</span><span class="ss-card__progress-value">45%</span></div>
                <div class="ss-track"><span class="ss-track__fill" style="width:45%"></span></div>
                <span class="ss-card__progress-topics">5 completed · 6 remaining</span>
              </div>
              <div class="ss-card__next">
                <span class="ss-card__next-icon"><span class="material-symbols-outlined">event_busy</span></span>
                <div style="min-width:0"><div class="ss-card__next-day">No session</div><div class="ss-card__next-meta">Nothing booked yet</div></div>
              </div>
            </div>
            <div class="ss-card__actions">
              <button type="button" class="ss-card__action ss-card__action--primary"><span class="material-symbols-outlined">chat_bubble</span>Message</button>
              <button type="button" class="ss-card__action ss-card__action--outline"><span class="material-symbols-outlined">map</span>View Roadmap</button>
              <button type="button" class="ss-card__action ss-card__action--ghost"><span class="material-symbols-outlined">event</span>Schedule</button>
            </div>
          </article>
        </div>
      </main>

      <div>
        <aside class="ss-panel">
          <div class="ss-panel__profile">
            <span class="ss-panel__avatar">TD</span>
            <h3 class="ss-panel__name">Tushar Dhiman</h3>
            <p class="ss-panel__email">tushar.dhiman@example.com</p>
            <span class="ss-panel__role"><span class="material-symbols-outlined">verified</span>Active Learner</span>
            <div class="ss-panel__rating"><span class="ss-panel__stars"><span class="material-symbols-outlined">star</span><span class="material-symbols-outlined">star</span><span class="material-symbols-outlined">star</span><span class="material-symbols-outlined">star</span><span class="material-symbols-outlined i
