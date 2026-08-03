import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router";
import AuthPage from "../pages/AuthPage";
import AdminLoginPage from "../pages/AdminLoginPage";
import TestChecklistPage from "../pages/TestChecklistPage";
import RouteErrorBoundary from "./RouteErrorBoundary";
import LearnerLayout from "../modules/learner/layouts/LearnerLayout";
import MentorLayout from "../modules/mentor/layouts/MentorLayout";
import RoleGuard from "../modules/common/RoleGuard";
import { roleRoot } from "../modules/common/routeUtils";

const LearnerDashboard = lazy(() => import("../pages/LearnerDashboard"));
const MentorDashboard = lazy(() => import("../pages/MentorDashboard"));
const MentorStudentsPage = lazy(() => import("../pages/MentorStudentsPage"));
const MentorCalendarPage = lazy(() => import("../pages/MentorCalendarPage"));
const MentorReviewsPage = lazy(() => import("../pages/MentorReviewsPage"));
const MentorNotificationsPage = lazy(() => import("../pages/MentorNotificationsPage"));
const MentorSettingsPage = lazy(() => import("../pages/MentorSettingsPage"));
const RoleGuide = lazy(() => import("../pages/RoleGuide"));
const AnalyticsPage = lazy(() => import("../pages/AnalyticsPage"));
const ResourcesPage = lazy(() => import("../pages/ResourcesPage"));
const TeachingPage = lazy(() => import("../pages/TeachingPage"));
const ProfileSetup = lazy(() => import("../pages/ProfileSetup"));
const MentorProfilePage = lazy(() => import("../pages/MentorProfilePage"));
const ProfessionalProfilePage = lazy(() => import("../pages/ProfessionalProfilePage"));
const MessagesPage = lazy(() => import("../pages/MessagesPage"));
const AdminOperationsPage = lazy(() => import("../pages/AdminOperationsPage"));
const AdminDashboardPage = lazy(() => import("../pages/AdminDashboardPage"));
const MentorVerificationsPage = lazy(() => import("../pages/MentorVerificationsPage"));
const WalletPage = lazy(() => import("../pages/WalletPage"));
const AdminLayout = lazy(() => import("../modules/admin/layouts/AdminLayout"));
const UserManagementPage = lazy(() => import("../pages/UserManagementPage"));
const SessionManagementPage = lazy(() => import("../pages/SessionManagementPage"));
const AdminAnalyticsPage = lazy(() => import("../pages/AdminAnalyticsPage"));
const NotificationBroadcastPage = lazy(() => import("../pages/NotificationBroadcastPage"));
const SystemSettingsPage = lazy(() => import("../pages/SystemSettingsPage"));
const AuditLogPage = lazy(() => import("../pages/AuditLogPage"));
const AdminPaymentsPage = lazy(() => import("../pages/AdminPaymentsPage"));
const ContentModerationPage = lazy(() => import("../pages/ContentModerationPage"));
const PlatformHealthPage = lazy(() => import("../pages/PlatformHealthPage"));
const SkillManagementPage = lazy(() => import("../pages/SkillManagementPage"));
const ReportsManagementPage = lazy(() => import("../pages/ReportsManagementPage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));
const LearnerMentorsPage = lazy(() => import("../pages/LearnerMentorsPage"));
const LearnerSkillsPage = lazy(() => import("../pages/LearnerSkillsPage"));
const SkillDetailPage = lazy(() => import("../pages/SkillDetailPage"));
const RoadmapDetailPage = lazy(() => import("../pages/RoadmapDetailPage"));
const CareerDetailPage = lazy(() => import("../pages/CareerDetailPage"));
const LearnerLearningPage = lazy(() => import("../pages/LearnerLearningPage"));
const LearnerSessionsPage = lazy(() => import("../pages/LearnerSessionsPage"));
const LearnerCertificatesPage = lazy(() => import("../pages/LearnerCertificatesPage"));
const LearnerMessagesPage = lazy(() => import("../pages/LearnerMessagesPage"));
const LearnerSavedMentorsPage = lazy(() => import("../pages/LearnerSavedMentorsPage"));
const LearnerPathPage = lazy(() => import("../pages/LearnerPathPage"));
const LearnerAchievementsPage = lazy(() => import("../pages/LearnerAchievementsPage"));
const LearnerProfilePage = lazy(() => import("../pages/LearnerProfilePage"));
const LearnerSettingsPage = lazy(() => import("../pages/LearnerSettingsPage"));
const LearnerNotificationsPage = lazy(() => import("../pages/LearnerNotificationsPage"));
const LearnerSessionRequestsPage = lazy(() => import("../pages/LearnerSessionRequestsPage"));

function RedirectToMentorProfessionalProfile() {
  const { section } = useParams();
  return <Navigate to={`/mentor/professional-profile/${section}`} replace />;
}

/** Returns a wrapped element with RouteErrorBoundary + Suspense for use in Route's element= prop. */
function routeContent(key, children, fallback) {
  return (
    <RouteErrorBoundary key={key}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

export default function AppRoutes({
  isLoggedIn,
  profile,
  profileChecked,
  handleLogout,
  handleSelectAuthMode,
  onLoggedIn,
  notify,
  language,
  onLanguageChange,
  setProfile,
  setProfileChecked,
  unreadNotifications,
  setUnreadNotifications,
  routeFallback,
}) {
  const navigate = useNavigate();

  if (!isLoggedIn) {
    const sharedAuthPage = (
      <AuthPage
        onSelectSignup={() => handleSelectAuthMode("signup")}
        onSelectLogin={() => handleSelectAuthMode("login")}
        language={language}
        onLanguageChange={onLanguageChange}
      />
    );

    return (
      <Routes>
        <Route path="/" element={sharedAuthPage} />
        <Route path="/login" element={sharedAuthPage} />
        <Route path="/signup" element={sharedAuthPage} />
        <Route
          path="/admin/login"
          element={routeContent(
            "admin-login",
            <AdminLoginPage onLoggedIn={onLoggedIn} notify={notify} />,
            routeFallback,
          )}
        />
        <Route path="/test-checklist" element={<TestChecklistPage />} />
        <Route
          path="/mentors/:mentorId"
          element={routeContent("public-mentor-profile",
            <main>
              <MentorProfilePage isLoggedIn={false} onRequireLogin={() => handleSelectAuthMode("login")} notify={notify} />
            </main>,
            routeFallback,
          )}
        />
        <Route path="/resources" element={routeContent("public-resources", <ResourcesPage />, routeFallback)} />
        <Route
          path="/teach"
          element={
            profile?.role === "MENTOR" ? (
              <RouteErrorBoundary key="public-teach">
                <Suspense fallback={routeFallback}><TeachingPage /></Suspense>
              </RouteErrorBoundary>
            ) : (
              <Navigate to="/sessions" replace />
            )
          }
        />
        <Route path="*" element={routeContent("public-not-found", <NotFoundPage isLoggedIn={false} />, routeFallback)} />
      </Routes>
    );
  }

  if (!profileChecked) {
    return (
      <Routes>
        <Route path="*" element={<main><div className="auth-card"><h2>Loading your profile...</h2></div></main>} />
      </Routes>
    );
  }

  const rc = (key, children) => routeContent(key, children, routeFallback);

  return (
    <Routes>
      <Route
        path="/profile-setup"
        element={rc("profile-setup",
          <ProfileSetup
            initialProfile={profile}
            notify={notify}
            onProfileUpdated={(updated) => setProfile(updated)}
            onCompleted={(updated) => {
              setProfile(updated);
              setProfileChecked(true);
              notify({
                type: "success",
                title: "Profile completed",
                message: "You can now browse mentors and start booking sessions.",
              });
              navigate(roleRoot(updated?.role || profile?.role), { replace: true });
            }}
            onLogout={handleLogout}
            language={language}
          />
        )}
      />
      <Route path="/" element={<Navigate to={roleRoot(profile?.role)} replace />} />
      <Route path="/home" element={<Navigate to={roleRoot(profile?.role)} replace />} />

      {/* ── Learner Routes ── */}
      <Route
        path="/learner"
        element={
          <RoleGuard profile={profile} allowedRoles={["LEARNER"]}>
            <LearnerLayout
              profile={profile}
              onLogout={handleLogout}
              language={language}
              onLanguageChange={onLanguageChange}
              unreadNotifications={unreadNotifications}
              onUnreadCountChange={setUnreadNotifications}
              notify={notify}
            />
          </RoleGuard>
        }
      >
        <Route index element={<Navigate to="/learner/dashboard" replace />} />
        <Route path="dashboard" element={rc("learner-dashboard", <LearnerDashboard profile={profile} onLogout={handleLogout} />)} />
        <Route path="mentors" element={rc("learner-mentors", <LearnerMentorsPage />)} />
        <Route path="skills" element={rc("learner-skills", <LearnerSkillsPage />)} />
        <Route path="skills/:skillId" element={rc("learner-skill-detail", <SkillDetailPage notify={notify} />)} />
        <Route path="roadmaps/:roadmapId" element={rc("learner-roadmap-detail", <RoadmapDetailPage />)} />
        <Route path="careers/:careerId" element={rc("learner-career-detail", <CareerDetailPage />)} />
        <Route path="learning" element={rc("learner-learning", <LearnerLearningPage />)} />
        <Route path="sessions" element={rc("learner-sessions", <LearnerSessionsPage />)} />
        <Route path="requests" element={rc("learner-requests", <LearnerSessionRequestsPage />)} />
        <Route path="certificates" element={rc("learner-certificates", <LearnerCertificatesPage />)} />
        <Route path="messages" element={rc("learner-messages", <LearnerMessagesPage profile={profile} />)} />
        <Route path="messages/:conversationId" element={rc("learner-messages-conversation", <LearnerMessagesPage profile={profile} />)} />
        <Route path="saved" element={rc("learner-saved", <LearnerSavedMentorsPage />)} />
        <Route path="path" element={rc("learner-path", <LearnerPathPage />)} />
        <Route path="achievements" element={rc("learner-achievements", <LearnerAchievementsPage />)} />            <Route path="notifications" element={rc("learner-notifications", <LearnerNotificationsPage notify={notify} />)} />
        <Route path="profile" element={rc("learner-profile", <LearnerProfilePage profile={profile} />)} />
        <Route path="settings" element={rc("learner-settings", <LearnerSettingsPage profile={profile} />)} />
        <Route path="resources" element={rc("learner-resources", <ResourcesPage />)} />
        <Route path="wallet" element={rc("learner-wallet", <WalletPage profile={profile} notify={notify} />)} />
        <Route path="*" element={<Navigate to="/learner/dashboard" replace />} />
      </Route>

      {/* ── Mentor Routes ── */}
      <Route
        path="/mentor"
        element={
          <RoleGuard profile={profile} allowedRoles={["MENTOR"]}>
            <MentorLayout
              profile={profile}
              onLogout={handleLogout}
              language={language}
              onLanguageChange={onLanguageChange}
              unreadNotifications={unreadNotifications}
              onUnreadCountChange={setUnreadNotifications}
              notify={notify}
            />
          </RoleGuard>
        }
      >
        <Route index element={<Navigate to="/mentor/dashboard" replace />} />
        <Route path="dashboard" element={rc("mentor-dashboard", <MentorDashboard profile={profile} onLogout={handleLogout} />)} />
        <Route path="teach" element={rc("mentor-teach", <TeachingPage notify={notify} />)} />
        <Route path="students" element={rc("mentor-students", <MentorStudentsPage profile={profile} notify={notify} />)} />
        <Route path="calendar" element={rc("mentor-calendar", <MentorCalendarPage profile={profile} notify={notify} />)} />
        <Route path="analytics" element={rc("mentor-analytics", <AnalyticsPage profile={profile} />)} />
        <Route path="reviews" element={rc("mentor-reviews", <MentorReviewsPage profile={profile} notify={notify} />)} />
        <Route path="messages" element={rc("mentor-messages", <MessagesPage profile={profile} notify={notify} onLogout={handleLogout} />)} />
        <Route path="wallet" element={rc("mentor-wallet", <WalletPage profile={profile} notify={notify} />)} />
        <Route path="professional-profile" element={rc("mentor-professional-profile", <ProfessionalProfilePage profile={profile} notify={notify} />)} />            <Route path="notifications" element={rc("mentor-notifications", <MentorNotificationsPage notify={notify} />)} />
        <Route path="settings" element={rc("mentor-settings", <MentorSettingsPage profile={profile} notify={notify} />)} />
        <Route path="*" element={<Navigate to="/mentor/dashboard" replace />} />
      </Route>

      {/* ── Role-based redirect routes ── */}
      <Route path="/role-guide" element={rc("role-guide", <RoleGuide />)} />
      <Route path="/sessions" element={<Navigate to={profile?.role === "MENTOR" ? "/mentor/teach" : "/learner/sessions"} replace />} />
      <Route path="/resources" element={<Navigate to="/learner/resources" replace />} />
      <Route path="/teach" element={<Navigate to="/mentor/teach" replace />} />
      <Route path="/mentors" element={<Navigate to="/learner/mentors" replace />} />
      <Route path="/professional-profile" element={<Navigate to="/mentor/professional-profile" replace />} />
      <Route path="/professional-profile/:section" element={<RedirectToMentorProfessionalProfile />} />
      <Route path="/wallet" element={<Navigate to={profile?.role === "MENTOR" ? "/mentor/wallet" : "/learner/wallet"} replace />} />
      <Route path="/analytics" element={<Navigate to="/mentor/analytics" replace />} />
      <Route path="/messages" element={<Navigate to={profile?.role === "MENTOR" ? "/mentor/messages" : "/learner/messages"} replace />} />
      <Route path="/sessions/:roadmapId" element={<Navigate to={profile?.role === "MENTOR" ? "/mentor/teach" : "/learner/sessions"} replace />} />
      <Route path="/mentors/:mentorId" element={rc("mentor-profile", <MentorProfilePage isLoggedIn={true} notify={notify} />)} />

      {/* ── Admin Routes ── */}
      <Route
        path="/admin"
        element={
          profile?.role === "ADMIN" ? (
            <RoleGuard profile={profile} allowedRoles={["ADMIN"]}>
              <Suspense fallback={routeFallback}>
                <AdminLayout profile={profile} onLogout={handleLogout} unreadNotifications={unreadNotifications} onUnreadCountChange={setUnreadNotifications} notify={notify} />
              </Suspense>
            </RoleGuard>
          ) : (
            <Navigate to={roleRoot(profile?.role)} replace />
          )
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={rc("admin-dashboard", <AdminDashboardPage notify={notify} />)} />
        <Route path="users" element={rc("admin-users", <UserManagementPage notify={notify} />)} />
        <Route path="sessions" element={rc("admin-sessions", <SessionManagementPage notify={notify} />)} />
        <Route path="analytics" element={rc("admin-analytics", <AdminAnalyticsPage notify={notify} />)} />
        <Route path="notifications" element={rc("admin-notifications", <NotificationBroadcastPage notify={notify} />)} />
        <Route path="settings" element={rc("admin-settings", <SystemSettingsPage notify={notify} />)} />
        <Route path="audit-log" element={rc("admin-audit-log", <AuditLogPage notify={notify} />)} />
        <Route path="flagged-content" element={rc("admin-flagged-content", <ContentModerationPage notify={notify} />)} />
        <Route path="health" element={rc("admin-health", <PlatformHealthPage notify={notify} />)} />
        <Route path="reports" element={rc("admin-reports", <ReportsManagementPage notify={notify} />)} />
        <Route path="verifications" element={rc("admin-verifications", <MentorVerificationsPage notify={notify} />)} />
        <Route path="payments" element={rc("admin-payments", <AdminPaymentsPage notify={notify} />)} />
        <Route path="skills" element={rc("admin-skills", <SkillManagementPage notify={notify} />)} />
        <Route path="conversations" element={rc("admin-conversations", <AdminOperationsPage notify={notify} />)} />
      </Route>

      {/* ── Catch-all for authenticated users ── */}
      <Route path="*" element={rc("authenticated-not-found", <NotFoundPage isLoggedIn={true} />)} />
    </Routes>
  );
}
