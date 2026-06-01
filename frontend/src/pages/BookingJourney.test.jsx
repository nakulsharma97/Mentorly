import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LearningPage from './LearningPage';
import MentorProfilePage from './MentorProfilePage';
import client from '../api/client';

vi.mock('../api/client', () => ({
  createIdempotencyKey: (prefix = 'req') => `${prefix}-test-key`,
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Booking journey integration flow', () => {
  beforeEach(() => {
    const sessionStart = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const sessionEnd = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    client.get.mockImplementation((url) => {
      if (url === '/api/v1/roadmaps') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/api/v1/users/mentors') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 7,
                fullName: 'Alice Mentor',
                skills: 'React,Frontend',
                averageRating: 4.8,
                totalReviews: 12,
                profileImageUrl: '',
                liveNow: false,
              },
            ],
          },
        });
      }
      if (url === '/api/v1/users/mentors/skills') {
        return Promise.resolve({ data: { data: ['React', 'Frontend'] } });
      }
      if (url === '/api/v1/users/mentors/7') {
        return Promise.resolve({
          data: {
            data: {
              id: 7,
              fullName: 'Alice Mentor',
              skills: 'React,Frontend',
              mentorVerified: true,
              aboutMe: 'Helping learners become confident React developers.',
              verifiedSkills: 'React,JavaScript',
              upcomingSessions: 3,
              githubUrl: '',
              linkedinUrl: '',
            },
          },
        });
      }
      if (url === '/api/v1/sessions/mentor/7') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 501,
                title: 'React Mock Interview',
                sessionType: 'LIVE',
                startTime: sessionStart,
                endTime: sessionEnd,
                priceAmount: 1200,
              },
            ],
          },
        });
      }
      if (url === '/api/v1/reviews/mentor/7') {
        return Promise.resolve({
          data: {
            data: {
              averageRating: 4.8,
              totalReviews: 12,
              reviews: [],
            },
          },
        });
      }
      if (url === '/api/v1/reviews/eligible/mentor/7') {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    client.post.mockImplementation((url) => {
      if (url === '/api/v1/bookings') {
        return Promise.resolve({ data: { data: { id: 999 } } });
      }
      return Promise.resolve({ data: { data: null } });
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('allows learner to browse mentors, open profile, book, and return to sessions view', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/sessions']}>
        <Routes>
          <Route path="/sessions" element={<LearningPage notify={() => {}} />} />
          <Route path="/mentors/:mentorId" element={<MentorProfilePage isLoggedIn onRequireLogin={() => {}} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('People guiding the learning path.')).toBeInTheDocument();
    });

    await user.click(await screen.findByRole('link', { name: 'View profile' }));

    await waitFor(() => {
      expect(screen.getByText('Public mentor profile')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Book now' }));

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith(
        '/api/v1/bookings',
        { sessionId: 501 },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': expect.stringContaining('booking-7-501'),
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Session booked successfully. You can track it in your dashboard bookings.')).toBeInTheDocument();
    });
  });

  it('shows login prompt and triggers login callback when unauthenticated learner clicks book now', async () => {
    const user = userEvent.setup();
    const onRequireLogin = vi.fn();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/mentors/7']}>
        <Routes>
          <Route path="/mentors/:mentorId" element={<MentorProfilePage isLoggedIn={false} onRequireLogin={onRequireLogin} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Public mentor profile')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Book now' }));

    await waitFor(() => {
      expect(screen.getByText('Please log in to book this session.')).toBeInTheDocument();
    });

    expect(onRequireLogin).toHaveBeenCalledTimes(1);
    expect(client.post).not.toHaveBeenCalledWith('/api/v1/bookings', expect.anything());
  });

  it('shows backend booking error and stays on mentor profile when booking fails', async () => {
    const user = userEvent.setup();

    client.post.mockImplementation((url) => {
      if (url === '/api/v1/bookings') {
        return Promise.reject({
          response: {
            data: {
              data: {
                error: 'This session slot is no longer available.',
              },
            },
          },
        });
      }
      return Promise.resolve({ data: { data: null } });
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/mentors/7']}>
        <Routes>
          <Route path="/sessions" element={<LearningPage notify={() => {}} />} />
          <Route path="/mentors/:mentorId" element={<MentorProfilePage isLoggedIn onRequireLogin={() => {}} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Public mentor profile')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Book now' }));

    await waitFor(() => {
      expect(screen.getByText('This session slot is no longer available.')).toBeInTheDocument();
    });

    expect(screen.getByText('Public mentor profile')).toBeInTheDocument();
    expect(screen.queryByText('People guiding the learning path.')).not.toBeInTheDocument();
  });

  it('retries booking: first call fails, second succeeds, then redirects to sessions', async () => {
    const user = userEvent.setup();

    let bookingAttempt = 0;
    client.post.mockImplementation((url) => {
      if (url === '/api/v1/bookings') {
        bookingAttempt += 1;
        if (bookingAttempt === 1) {
          return Promise.reject({
            response: {
              data: {
                data: {
                  error: 'Temporary booking conflict. Please retry.',
                },
              },
            },
          });
        }
        return Promise.resolve({ data: { data: { id: 1001 } } });
      }
      return Promise.resolve({ data: { data: null } });
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/mentors/7']}>
        <Routes>
          <Route path="/sessions" element={<LearningPage notify={() => {}} />} />
          <Route path="/mentors/:mentorId" element={<MentorProfilePage isLoggedIn onRequireLogin={() => {}} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Public mentor profile')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Book now' }));

    await waitFor(() => {
      expect(screen.getByText('Temporary booking conflict. Please retry.')).toBeInTheDocument();
    });

    // Second click should succeed and redirect to learner sessions view.
    await user.click(screen.getByRole('button', { name: 'Retry booking' }));

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByText('Session booked successfully. You can track it in your dashboard bookings.')).toBeInTheDocument();
    });

    // After successful retry, the prior booking error should no longer be shown.
    expect(screen.queryByText('Temporary booking conflict. Please retry.')).not.toBeInTheDocument();
  });

  it('locks booking button while request is inflight and re-enables for retry after failure', async () => {
    const user = userEvent.setup();

    let releaseRequest;
    client.post.mockImplementation((url) => {
      if (url === '/api/v1/bookings') {
        return new Promise((resolve, reject) => {
          releaseRequest = () => reject({
            response: {
              data: {
                data: {
                  error: 'Temporary booking conflict. Please retry.',
                  retryable: true,
                },
              },
            },
          });
        });
      }
      return Promise.resolve({ data: { data: null } });
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/mentors/7']}>
        <Routes>
          <Route path="/mentors/:mentorId" element={<MentorProfilePage isLoggedIn onRequireLogin={() => {}} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Public mentor profile')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Book now' }));

    const inflightButton = await screen.findByRole('button', { name: 'Booking...' });
    expect(inflightButton).toBeDisabled();

    releaseRequest();

    await waitFor(() => {
      expect(screen.getByText('Temporary booking conflict. Please retry.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Retry booking' })).not.toBeDisabled();
  });
});
