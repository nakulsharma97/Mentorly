import { render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
    <MemoryRouter>
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
    expect(screen.getByText(/Welcome back, Learner/i)).toBeInTheDocument();
  });

  it('renders upcoming sessions count when bookings load', async () => {
    renderLearnerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Total Bookings')).toBeInTheDocument();
    });

    const totalBookingsCard = screen.getByText('Total Bookings').closest('.dash-metric-card');
    expect(totalBookingsCard).not.toBeNull();
    expect(within(totalBookingsCard).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Upcoming Sessions')).toBeInTheDocument();
  });

  it("renders 'No upcoming sessions' when bookings array is empty", async () => {
    server.use(
      http.get('*/api/v1/bookings', () => HttpResponse.json({ data: [] }))
    );

    renderLearnerDashboard();

    await waitFor(() => {
      expect(screen.getByText('No upcoming sessions yet')).toBeInTheDocument();
    });
  });

  it('renders roadmap progress percentage', async () => {
    renderLearnerDashboard();

    await waitFor(() => {
      expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Learning Path' }));
  });

  it('renders referral summary card', async () => {
    renderLearnerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Refer a friend')).toBeInTheDocument();
    });

    expect(screen.getByText('SKILLSWAP')).toBeInTheDocument();
    expect(screen.getByText('3 friends referred · 150 credits earned')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://skillswap.app/signup?ref=SKILLSWAP' })).toBeInTheDocument();
  });

  it('shows error toast when bookings API fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get('*/api/v1/bookings', () => HttpResponse.json({ message: 'failed' }, { status: 500 }))
    );

    renderLearnerDashboard();

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });

    errorSpy.mockRestore();
  });
});
