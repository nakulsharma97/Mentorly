import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import client from './api/client';

vi.mock('./api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

vi.mock('./pages/AuthPage', () => ({ default: () => <div>Auth Page</div> }));
vi.mock('./pages/Dashboard', () => ({ default: () => <div>Dashboard</div> }));
vi.mock('./pages/ExecutiveDashboard', () => ({ default: () => <div>Executive Dashboard</div> }));
vi.mock('./pages/LearnerDashboard', () => ({ default: () => <div>Learner Dashboard</div> }));
vi.mock('./pages/MentorDashboard', () => ({ default: () => <div>Mentor Dashboard</div> }));
vi.mock('./pages/RoleGuide', () => ({ default: () => <div>Role Guide</div> }));
vi.mock('./pages/AnalyticsPage', () => ({ default: () => <div>Analytics Page</div> }));
vi.mock('./pages/LearningPage', () => ({ default: () => <div>Learning Page</div> }));
vi.mock('./pages/ResourcesPage', () => ({ default: () => <div>Resources Page</div> }));
vi.mock('./pages/TeachingPage', () => ({ default: () => <div>Teaching Page</div> }));
vi.mock('./pages/ProfileSetup', () => ({ default: () => <div>Profile Setup</div> }));
vi.mock('./pages/MentorProfilePage', () => ({ default: () => <div>Mentor Profile</div> }));
vi.mock('./pages/MessagesPage', () => ({ default: () => <div>Messages Page</div> }));
vi.mock('./pages/NotFoundPage', () => ({ default: () => <div>Not Found</div> }));
vi.mock('./components/Navbar', () => ({ default: () => <div>Navbar</div> }));
vi.mock('./components/AuthModal', () => ({ default: () => <div>Auth Modal</div> }));

describe('App role routing', () => {
  const mockProfileForRole = (role) => {
    client.get.mockImplementation((url) => {
      if (url === '/api/v1/users/me') {
        return Promise.resolve({
          data: {
            data: {
              role,
              skills: role === 'MENTOR' ? 'Java,Spring Boot' : 'React',
              aboutMe: role === 'MENTOR' ? 'Mentor profile' : 'Learner profile',
              githubUrl: role === 'MENTOR' ? 'https://github.com/mentor' : 'https://github.com/learner',
              linkedinUrl: role === 'MENTOR' ? 'https://linkedin.com/in/mentor' : 'https://linkedin.com/in/learner'
            }
          }
        });
      }
      if (url === '/api/v1/notifications/unread-count') {
        return Promise.resolve({ data: { data: 0 } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  };

  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    mockProfileForRole('LEARNER');

    client.post.mockResolvedValue({ data: { data: null } });
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('redirects learner from /teach to /sessions route', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/teach']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Learning Page')).toBeInTheDocument();
    });

    expect(screen.queryByText('Teaching Page')).not.toBeInTheDocument();
  });

  it('lands learner on learner dashboard after login', async () => {
    mockProfileForRole('LEARNER');

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Learner Dashboard')).toBeInTheDocument();
    });

    expect(screen.queryByText('Mentor Dashboard')).not.toBeInTheDocument();
  });

  it('lands mentor on mentor dashboard after login', async () => {
    mockProfileForRole('MENTOR');

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Mentor Dashboard')).toBeInTheDocument();
    });

    expect(screen.queryByText('Learner Dashboard')).not.toBeInTheDocument();
  });

  it('keeps role boundaries on /home for both learner and mentor', async () => {
    mockProfileForRole('LEARNER');
    const learnerRender = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/home']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Learner Dashboard')).toBeInTheDocument();
    });
    expect(screen.queryByText('Mentor Dashboard')).not.toBeInTheDocument();

    learnerRender.unmount();

    mockProfileForRole('MENTOR');
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/home']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Mentor Dashboard')).toBeInTheDocument();
    });
    expect(screen.queryByText('Learner Dashboard')).not.toBeInTheDocument();
  });
});
