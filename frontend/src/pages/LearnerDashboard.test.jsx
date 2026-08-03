import { render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import LearnerDashboard from './LearnerDashboard';
import { server } from '../test/mocks/server';

const profile = {
  fullName: 'Learner One',
  aboutMe: 'I am learning full stack.',
  skills: 'React,Spring',
};

function renderLearnerDashboard() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LearnerDashboard profile={profile} />
    </MemoryRouter>
  );
}

describe('LearnerDashboard', () => {
  it('renders loading skeleton while data loads', async () => {
    renderLearnerDashboard();

    const loading = screen.getByLabelText('Loading dashboard...');
    expect(loading).toBeInTheDocument();

    await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading dashboard...'));
    expect(screen.getByText(/Good (Morning|Afternoon|Evening), Learner/i)).toBeInTheDocument();
  });

  it('renders upcoming sessions count and section when bookings load', async () => {
    renderLearnerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Upcoming Sessions')).toBeInTheDocument();
    });

    expect(screen.getByText('Sessions Done')).toBeInTheDocument();
  });

  it("renders 'No upcoming sessions' when bookings array is empty", async () => {
    server.use(
      http.get('*/api/v1/bookings', () => HttpResponse.json({ data: [] }))
    );

    renderLearnerDashboard();

    await waitFor(() => {
      expect(screen.getByText('No upcoming sessions')).toBeInTheDocument();
    });
  });

  it('renders roadmap progress percentage', async () => {
    renderLearnerDashboard();

    await waitFor(() => {
      expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    });

    const roadmapLink = screen.getByRole('link', { name: /Open Roadmap/i });
    expect(roadmapLink).toBeInTheDocument();
  });

  it('renders referral summary card', async () => {
    renderLearnerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Referral Rewards')).toBeInTheDocument();
    });

    // Scope stat-value assertions to the referral hero so they never collide
    // with identical numbers rendered elsewhere (e.g. session-row days).
    const referralHero = screen.getByText('Referral Rewards').closest('.ld-referral-hero');
    expect(referralHero).not.toBeNull();

    expect(within(referralHero).getByText('SKILLSWAP')).toBeInTheDocument();
    expect(within(referralHero).getByText('3')).toBeInTheDocument();
    expect(within(referralHero).getByText('150')).toBeInTheDocument();
    expect(within(referralHero).getByText('Friends Referred')).toBeInTheDocument();
    expect(within(referralHero).getByText('Credits Earned')).toBeInTheDocument();
    expect(within(referralHero).getByText('Copy Code')).toBeInTheDocument();
  });

  it('renders achievements section', async () => {
    renderLearnerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Achievements')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Learning Streak').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sessions Completed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Certificates').length).toBeGreaterThan(0);
  });

  it('handles bookings API failure gracefully', async () => {
    server.use(
      http.get('*/api/v1/bookings', () => HttpResponse.json({ message: 'failed' }, { status: 500 }))
    );

    renderLearnerDashboard();

    // Loading skeleton should appear first
    expect(screen.getByLabelText('Loading dashboard...')).toBeInTheDocument();

    // After the API fails, the loading state should resolve and render the dashboard
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading dashboard...'), { timeout: 5000 });

    // The component should render some default content even with failed API
    expect(screen.getByText(/Good (Morning|Afternoon|Evening), Learner/i)).toBeInTheDocument();
  });
});
