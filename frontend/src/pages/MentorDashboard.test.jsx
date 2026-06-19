import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import MentorDashboard from './MentorDashboard';
import { server } from '../test/mocks/server';

const profile = { fullName: 'Mentor Prime' };

function renderMentorDashboard() {
  return render(
    <MemoryRouter>
      <MentorDashboard profile={profile} />
    </MemoryRouter>
  );
}

describe('MentorDashboard', () => {
  it('renders mentor name from profile prop', async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Mentor/i)).toBeInTheDocument();
    });
  });

  it('renders pending bookings count', async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    });

    const pendingStat = screen.getByText('Pending Requests').closest('.dash-hero-stat');
    expect(pendingStat).not.toBeNull();
    expect(within(pendingStat).getByText('1')).toBeInTheDocument();
  });

  it('renders total completed sessions', async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    const completedCard = screen.getByText('Completed').closest('.dash-metric-card');
    expect(completedCard).not.toBeNull();
    expect(within(completedCard).getByText('1')).toBeInTheDocument();
  });

  it('renders average rating from reviews', async () => {
    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText('Avg Rating')).toBeInTheDocument();
    });

    const avgRatingCard = screen.getByText('Avg Rating').closest('.dash-metric-card');
    expect(avgRatingCard).not.toBeNull();
    expect(within(avgRatingCard).getByText('5')).toBeInTheDocument();
  });

  it('shows empty state when no sessions exist', async () => {
    server.use(
      http.get('*/api/v1/sessions', () => HttpResponse.json({ data: [] }))
    );

    renderMentorDashboard();

    await waitFor(() => {
      expect(screen.getByText('No upcoming sessions')).toBeInTheDocument();
    });
  });
});
