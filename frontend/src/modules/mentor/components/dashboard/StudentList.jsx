import SectionCard, { EmptyState } from "../../../common/dashboard/SectionCard";
import { initials } from "../../../common/dashboard/dashboardUtils";

/** Recent students: avatar, name, email, skill and completion progress. */
export default function StudentList({ students = [] }) {
  return (
    <SectionCard
      title="Recent Students"
      icon="groups"
      action="View all"
      actionTo="/mentor/students"
    >
      {students.length === 0 ? (
        <EmptyState
          icon="person_add"
          title="No students yet"
          description="Once learners book your sessions they'll show up here."
        />
      ) : (
        <div className="md-rows" style={{ gap: 2 }}>
          {students.slice(0, 5).map((s) => (
            <div key={s.id} className="md-student">
              <span className="md-avatar md-avatar--sm">{initials(s.name)}</span>
              <div className="md-student__main">
                <p className="md-student__name">{s.name}</p>
                <p className="md-student__email">
                  {s.email || s.skill || "Learner"}
                </p>
              </div>
              <div className="md-student__progress">
                <div className="md-progress-track">
                  <div
                    className="md-progress-fill"
                    style={{ width: `${Math.min(100, s.progress)}%` }}
                  />
                </div>
                <p className="md-progress-label">{s.progress}%</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
