import { useNavigate } from 'react-router-dom';

export default function RoleGuide() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-gradient-to-br from-surface to-surface-container-lowest">
      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="onboarding-stepper onboarding-stepper-compact">
            <div className="onboarding-stepper-header">
              <span className="onboarding-stepper-pill">Step 1 of 3</span>
              <div>
                <p className="onboarding-stepper-title">Choose your role</p>
                <p className="onboarding-stepper-subtitle">Pick the experience you want first. You can switch later.</p>
              </div>
            </div>
            <div className="onboarding-stepper-track">
              <div className="onboarding-stepper-progress" style={{ width: '33%' }} />
            </div>
            <div className="onboarding-stepper-steps">
              <span className="onboarding-stepper-step is-active">Select role</span>
              <span className="onboarding-stepper-step">Profile details</span>
              <span className="onboarding-stepper-step">Start matching</span>
            </div>
          </div>
          <h1 className="text-5xl font-bold text-on-surface mb-4">
            Welcome to <span className="text-primary">SkillSwap</span>
          </h1>
          <p className="text-xl text-on-surface-variant mb-8">
            Two different worlds. One platform. Choose your role and start your journey.
          </p>
        </div>

        {/* Role Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Learner Card */}
          <div className="rounded-2xl border-2 border-secondary/30 bg-surface-container-lowest overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
            <div className="bg-gradient-to-r from-secondary/20 to-secondary-container/20 px-8 py-6 border-b border-secondary/20">
              <div className="text-5xl mb-3">👨‍🎓</div>
              <h2 className="text-3xl font-bold text-on-surface mb-2">Learner</h2>
              <p className="text-on-surface-variant">Grow by learning from experienced mentors</p>
            </div>

            <div className="p-8">
              <div className="space-y-6">
                {/* Features */}
                <div>
                  <h3 className="font-bold text-lg text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">check_circle</span>
                    Key Features
                  </h3>
                  <ul className="space-y-3 text-on-surface-variant text-sm">
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-secondary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Browse hundreds of verified mentors with ratings</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-secondary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Book 1-on-1 sessions in your preferred time slot</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-secondary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Track your learning progress with structured roadmaps</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-secondary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Access learning materials and resources</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-secondary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Review mentors and share feedback</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-secondary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Manage payments and wallet</span>
                    </li>
                  </ul>
                </div>

                {/* Dashboard */}
                <div>
                  <h3 className="font-bold text-lg text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">dashboard</span>
                    Your Dashboard Includes
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-surface-container-high p-3 text-center">
                      <div className="text-xs text-on-surface-variant mb-1">Bookings</div>
                      <div className="text-xl font-bold text-secondary">📅</div>
                    </div>
                    <div className="rounded-lg bg-surface-container-high p-3 text-center">
                      <div className="text-xs text-on-surface-variant mb-1">Learning Paths</div>
                      <div className="text-xl font-bold text-secondary">📚</div>
                    </div>
                    <div className="rounded-lg bg-surface-container-high p-3 text-center">
                      <div className="text-xs text-on-surface-variant mb-1">Watched Skills</div>
                      <div className="text-xl font-bold text-secondary">⭐</div>
                    </div>
                    <div className="rounded-lg bg-surface-container-high p-3 text-center">
                      <div className="text-xs text-on-surface-variant mb-1">Statistics</div>
                      <div className="text-xl font-bold text-secondary">📊</div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => navigate('/sessions')}
                  className="w-full py-3 rounded-xl bg-secondary text-on-secondary font-bold hover:opacity-90 transition-all duration-300 hover:shadow-lg"
                >
                  Browse Mentors →
                </button>
              </div>
            </div>
          </div>

          {/* Mentor Card */}
          <div className="rounded-2xl border-2 border-primary/30 bg-surface-container-lowest overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
            <div className="bg-gradient-to-r from-primary/20 to-primary-container/20 px-8 py-6 border-b border-primary/20">
              <div className="text-5xl mb-3">👨‍🏫</div>
              <h2 className="text-3xl font-bold text-on-surface mb-2">Mentor</h2>
              <p className="text-on-surface-variant">Earn while teaching your expertise</p>
            </div>

            <div className="p-8">
              <div className="space-y-6">
                {/* Features */}
                <div>
                  <h3 className="font-bold text-lg text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                    Key Features
                  </h3>
                  <ul className="space-y-3 text-on-surface-variant text-sm">
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-primary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Create and manage your own sessions</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-primary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Set your own hourly rates and packages</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-primary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Manage learner bookings and accept/reject requests</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-primary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Create learning roadmaps for your learners</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-primary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Build your reputation with ratings and reviews</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-sm text-primary mt-0.5 flex-shrink-0">arrow_right</span>
                      <span>Track earnings and withdraw payments</span>
                    </li>
                  </ul>
                </div>

                {/* Dashboard */}
                <div>
                  <h3 className="font-bold text-lg text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">dashboard</span>
                    Your Dashboard Includes
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-surface-container-high p-3 text-center">
                      <div className="text-xs text-on-surface-variant mb-1">Pending Requests</div>
                      <div className="text-xl font-bold text-primary">📬</div>
                    </div>
                    <div className="rounded-lg bg-surface-container-high p-3 text-center">
                      <div className="text-xs text-on-surface-variant mb-1">Sessions</div>
                      <div className="text-xl font-bold text-primary">🎓</div>
                    </div>
                    <div className="rounded-lg bg-surface-container-high p-3 text-center">
                      <div className="text-xs text-on-surface-variant mb-1">Reviews</div>
                      <div className="text-xl font-bold text-primary">⭐</div>
                    </div>
                    <div className="rounded-lg bg-surface-container-high p-3 text-center">
                      <div className="text-xs text-on-surface-variant mb-1">Earnings</div>
                      <div className="text-xl font-bold text-primary">💰</div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => navigate('/teach')}
                  className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold hover:opacity-90 transition-all duration-300 hover:shadow-lg"
                >
                  Start Teaching →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-8 py-6 border-b border-outline-variant/10">
            <h2 className="text-2xl font-bold text-on-surface">Feature Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/10 bg-surface-container-high">
                  <th className="px-6 py-4 text-left font-bold text-on-surface">Feature</th>
                  <th className="px-6 py-4 text-center font-bold text-on-surface">👨‍🎓 Learner</th>
                  <th className="px-6 py-4 text-center font-bold text-on-surface">👨‍🏫 Mentor</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Browse Mentors', learner: true, mentor: false },
                  { feature: 'Create Sessions', learner: false, mentor: true },
                  { feature: 'Book Sessions', learner: true, mentor: false },
                  { feature: 'Manage Bookings', learner: false, mentor: true },
                  { feature: 'Learning Roadmaps', learner: true, mentor: true },
                  { feature: 'Leave Reviews', learner: true, mentor: false },
                  { feature: 'Receive Reviews', learner: false, mentor: true },
                  { feature: 'Set Pricing', learner: false, mentor: true },
                  { feature: 'Track Earnings', learner: false, mentor: true },
                  { feature: 'Watch Skills', learner: true, mentor: false },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-outline-variant/10 ${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}>
                    <td className="px-6 py-4 font-medium text-on-surface">{row.feature}</td>
                    <td className="px-6 py-4 text-center">
                      {row.learner ? (
                        <span className="material-symbols-outlined text-2xl text-success">check_circle</span>
                      ) : (
                        <span className="text-on-surface-variant text-2xl">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.mentor ? (
                        <span className="material-symbols-outlined text-2xl text-success">check_circle</span>
                      ) : (
                        <span className="text-on-surface-variant text-2xl">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-on-surface-variant text-lg mb-6">
            Want to switch roles later? You can update your role anytime in your profile settings.
          </p>
          <button
            onClick={() => navigate('/home')}
            className="inline-block px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold hover:opacity-90 transition-opacity shadow-lg hover:shadow-xl"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    </main>
  );
}
