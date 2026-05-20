import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MentorDashboard from './MentorDashboard';
import client from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const buildFutureIso = (hoursFromNow = 24) => new Date(Date.now() + (hoursFromNow * 60 * 60 * 1000)).toISOString();

const renderMentorDashboard = ({
  profile = { fullName: 'Mentor Prime' },
  sessions = [],
  bookings = [],
  reviews = [],
  verificationStatus = null,
  certifications = [],
} = {}) => {
  client.post.mockResolvedValue({ data: { data: null } });
  client.patch.mockResolvedValue({ data: { data: null } });
  client.get.mockImplementation((url) => {
    if (url === '/api/v1/sessions') {
      return Promise.resolve({ data: { data: sessions } });
    }
    if (url === '/api/v1/bookings') {
      return Promise.resolve({ data: { data: bookings } });
    }
    if (url === '/api/v1/reviews/mentor') {
      return Promise.resolve({ data: { data: reviews } });
    }
    if (url === '/api/v1/verification/mentor/status') {
      return Promise.resolve({ data: { data: verificationStatus } });
    }
    if (url === '/api/v1/certifications/me') {
      return Promise.resolve({ data: { data: certifications } });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MentorDashboard profile={profile} />
    </MemoryRouter>
  );
};

describe('MentorDashboard role-focused flow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows mentor control room and verification guidance when not verified', async () => {
    renderMentorDashboard({
      verificationStatus: { mentorVerified: false },
      sessions: [],
      bookings: [],
      reviews: [],
    });

    await waitFor(() => {
      expect(screen.getByText('Mentor Control Room')).toBeInTheDocument();
    });

    expect(screen.getByText('Verification pending')).toBeInTheDocument();
    const verifyLinks = screen.getAllByRole('link', { name: 'Finish Profile' });
    expect(verifyLinks.length).toBeGreaterThan(0);
    verifyLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/profile-setup');
    });

    expect(screen.getByText('No upcoming sessions')).toBeInTheDocument();
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    expect(screen.getByText('Complete sessions to earn reviews from your learners.')).toBeInTheDocument();
  });

  it('renders pending booking actions, upcoming session cards, and learner reviews', async () => {
    renderMentorDashboard({
      verificationStatus: { mentorVerified: true },
      sessions: [
        {
          id: 11,
          title: 'React Deep Dive',
          startTime: buildFutureIso(26),
          pricePerHour: 1200,
          confirmedBookings: 2,
          skill: { name: 'React' },
        },
      ],
      bookings: [
        {
          id: 21,
          bookingStatus: 'PENDING',
          learner: { fullName: 'Learner A' },
          session: {
            title: 'React Deep Dive',
            skill: { name: 'React' },
            startTime: buildFutureIso(20),
          },
        },
        {
          id: 22,
          bookingStatus: 'COMPLETED',
          learner: { id: 5, fullName: 'Learner A' },
          payment: { amount: 1200 },
          session: {
            startTime: buildFutureIso(-48),
          },
        },
      ],
      reviews: [
        {
          id: 31,
          rating: 5,
          comment: 'Excellent mentor and very clear explanations.',
          learner: { fullName: 'Learner A' },
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Pending Booking Requests')).toBeInTheDocument();
    });

    expect(screen.getByText('Awaiting Response')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();

    expect(screen.getByText('Upcoming Sessions')).toBeInTheDocument();
    expect(screen.getAllByText(/React Deep Dive/).length).toBeGreaterThan(0);

    expect(screen.getByText('Recent Reviews')).toBeInTheDocument();
    expect(screen.getAllByText('Learner A').length).toBeGreaterThan(0);
    expect(screen.getByText(/Excellent mentor and very clear explanations\./)).toBeInTheDocument();
  });
});
