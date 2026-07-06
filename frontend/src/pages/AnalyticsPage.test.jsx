import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AnalyticsPage, { buildLearnerHistoryCsv } from './AnalyticsPage';
import client from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('AnalyticsPage learner behavior', () => {
  beforeEach(() => {
    const firstSessionStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const firstSessionEnd = new Date(firstSessionStart.getTime() + 90 * 60 * 1000);
    const secondSessionStart = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const secondSessionEnd = new Date(secondSessionStart.getTime() + 90 * 60 * 1000);
    const bookings = [
      {
        id: 1,
        bookingStatus: 'COMPLETED',
        session: {
          title: 'React Basics',
          startTime: firstSessionStart.toISOString(),
          endTime: firstSessionEnd.toISOString(),
          mentor: { id: 10, fullName: 'Alice Mentor' }
        }
      },
      {
        id: 2,
        bookingStatus: 'COMPLETED',
        session: {
          title: 'System Design',
          startTime: secondSessionStart.toISOString(),
          endTime: secondSessionEnd.toISOString(),
          mentor: { id: 11, fullName: 'Bob Mentor' }
        }
      }
    ];

    const payments = [
      { id: 11, status: 'SUCCEEDED', amount: 120, booking: { id: 1 }, createdAt: firstSessionEnd.toISOString() },
      { id: 12, status: 'COMPLETED', amount: 80, booking: { id: 2 }, createdAt: secondSessionEnd.toISOString() }
    ];

    const roadmaps = [{ id: 7, progressPercent: 65 }];

    client.get.mockImplementation((url) => {
      if (url === '/api/v1/bookings') {
        return Promise.resolve({ data: { data: bookings } });
      }
      if (url === '/api/v1/payments') {
        return Promise.resolve({ data: { data: payments } });
      }
      if (url === '/api/v1/roadmaps') {
        return Promise.resolve({ data: { data: roadmaps } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it.each([7, 30, 90])('builds CSV content with expected headers for %i day range', (days) => {
    const csv = buildLearnerHistoryCsv({
      rangeDays: days,
      learnerHistory: {
        totalSessionsAttended: 2,
        averageSessionLengthHours: 1.5
      },
      mentors: [
        {
          name: 'Alice Mentor',
          sessionsAttended: 1,
          totalHours: 1.5,
          totalSpend: 120
        }
      ]
    });

    expect(csv).toContain(`"Range Days","${days}"`);
    expect(csv).toContain('"Mentor","Sessions Attended","Hours Learned","Spend"');
    expect(csv).toContain('"Alice Mentor","1","1.5","120.00"');
  });

  it('shows learner-specific metrics and hides mentor-only action', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AnalyticsPage profile={{ role: 'LEARNER' }} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Mentors Contacted')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Spent')).toBeInTheDocument();
    expect(screen.getAllByText('Hours Learned').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Find Mentor').length).toBeGreaterThan(0);
    expect(screen.queryByText('Create Workshop')).not.toBeInTheDocument();
    expect(screen.getByText('Alice Mentor')).toBeInTheDocument();
    expect(screen.getByText('Bob Mentor')).toBeInTheDocument();
    expect(screen.getByText('Average Session Length')).toBeInTheDocument();
    expect(screen.getAllByText('1.5h').length).toBeGreaterThan(0);
  });

  it('supports mentor search and clickable header sorting for learner history', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AnalyticsPage profile={{ role: 'LEARNER' }} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Learner History Details')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Type mentor name');
    await user.type(searchInput, 'Alice');

    expect(screen.getByText('Alice Mentor')).toBeInTheDocument();
    expect(screen.queryByText('Bob Mentor')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Sort by hours learned/i }));
    expect(screen.getByRole('button', { name: /Sort by spend/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
  });

  it('restores learner history search and sort state from localStorage with aria-sort', async () => {
    localStorage.setItem('learnerHistoryState', JSON.stringify({
      mentorSearch: 'Bob',
      historySortBy: 'hours',
      historySortDirection: 'asc'
    }));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AnalyticsPage profile={{ role: 'LEARNER' }} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Learner History Details')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Type mentor name')).toHaveValue('Bob');
    expect(screen.getByRole('columnheader', { name: /Hours Learned/i })).toHaveAttribute('aria-sort', 'ascending');
  });
});
