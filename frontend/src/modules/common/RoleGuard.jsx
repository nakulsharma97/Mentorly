import { Navigate } from "react-router";

const roleRoot = (role) => {
  if (role === "ADMIN") {
    return "/admin/dashboard";
  }
  if (role === "MENTOR") {
    return "/mentor/dashboard";
  }
  return "/learner/dashboard";
};

export default function RoleGuard({ profile, allowedRoles, children }) {
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  const currentRole = profile.role || "LEARNER";
  if (!allowedRoles.includes(currentRole)) {
    return <Navigate to={roleRoot(currentRole)} replace />;
  }

  return children;
}
