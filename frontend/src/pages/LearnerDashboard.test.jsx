import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LearnerDashboard from './LearnerDashboard';
import client from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const buildFutureIso = (hoursFromNow = 24) => new Date(Date.now() + (hoursFromNow * 60 * 60 * 1000)).toISOString();

const renderLearnerDashboard = ({
  profile = {
    fullName: 'Learner One',
    aboutMe: 'I am learning full stack.',
    skills: 'React,Spring',
  },
  bookings = [],
  roadmaps = [],
  watchlist = [],
  certifications = [],
} = {}) => {
  client.post.mockResolvedValue({ data: { data: null } });
  client.get.mockImplementation((url) => {
    if (url === '/api/v1/bookings') {
      return Promise.resolve({ data: { data: bookings } });
    }
    if (url === '/api/v1/roadmaps') {
      return Promise.resolve({ data: { data: roadmaps } });
    }
    if (url === '/api/v1/watchlist') {
      return Promise.resolve({ data: { data: watchlist } });
    }
    if (url === '/api/v1/certifications/me') {
      return Promise.resolve({ data: { data: certifications } });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LearnerDashboard profile={profile} onLogout={() => {}} />
    </MemoryRouter>
  );
};

describe('LearnerDashboard learner-focused flow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows onboarding checklist and completed progress when core actions are done', async () => {
    renderLearnerDashboard({
      bookings: [
        {
          id: 101,
          bookingStatus: 'ACCEPTED',
          session: {
            startTime: buildFutureIso(30),
            mentor: { fullName: 'Mentor A' },
            skill: { name: 'React' },
          },
        },
      ],
      watchlist: [
        { id: 1, name: 'React', mentorCount: 8 },
        { id: 2, name: 'Spring Boot', mentorCount: 6 },
        { id: 3, name: 'System Design', mentorCount: 4 },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Learner Onboarding Checklist')).toBeInTheDocument();
    });

    expect(screen.getByText('5 of 5 completed')).toBeInTheDocument();
    expect(screen.getByText('What Should I Do Now?')).toBeInTheDocument();
  });

  it('normalizes booking status labels and shows clear next action for learner', async () => {
    renderLearnerDashboard({
      bookings: [
        {
          id: 202,
          bookingStatus: 'PENDING',
          session: {
            startTime: buildFutureIso(48),
            mentor: { fullName: 'Mentor B' },
            skill: { name: 'Node.js' },
          },
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Upcoming Sessions')).toBeInTheDocument();
    });

    expect(screen.getByText('Requested')).toBeInTheDocument();
    expect(screen.getByText('Next: Wait for mentor confirmation')).toBeInTheDocument();
  });

  it('shows organized empty states with primary CTA routing to mentors', async () => {
    renderLearnerDashboard({
      profile: {
        fullName: 'New Learner',
        aboutMe: '',
        skills: '',
      },
      bookings: [],
      roadmaps: [],
      watchlist: [],
      certifications: [],
    });

    await waitFor(() => {
      expect(screen.getByText('No upcoming sessions yet')).toBeInTheDocument();
    });

    expect(screen.getByText('Book your first mentor session')).toBeInTheDocument();

    const findMentorsLink = screen.getByRole('link', { name: 'Find mentors' });
    expect(findMentorsLink).toHaveAttribute('href', '/mentors');

    expect(screen.getByText('No active learning paths yet')).toBeInTheDocument();
    expect(screen.getByText('Your watchlist is empty')).toBeInTheDocument();
  });
});
