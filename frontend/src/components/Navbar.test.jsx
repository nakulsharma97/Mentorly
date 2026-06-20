import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from "./Navbar.old";

describe('Navbar role actions', () => {
  it('hides mentor-only actions for learner and shows learner actions', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Navbar
          isLoggedIn
          profile={{ role: 'LEARNER', fullName: 'Learner One', email: 'l@test.com' }}
          onOpenProfile={() => {}}
          onOpenNotifications={() => {}}
          onLogout={() => {}}
          authMode={null}
          onSelectAuthMode={() => {}}
          language="en"
          onLanguageChange={() => {}}
          unreadNotifications={0}
        />
      </MemoryRouter>
    );

    expect(screen.queryByText('Manage Sessions')).not.toBeInTheDocument();
    expect(screen.queryByText('Earnings')).not.toBeInTheDocument();
    expect(screen.getByText('Browse Mentors')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Find Mentor')).toBeInTheDocument();
  });
});
