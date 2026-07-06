import { Link } from "react-router-dom";
import SectionCard, { EmptyState } from "../../../common/dashboard/SectionCard";
import Icon from "../../../common/dashboard/Icon";
import { getRoadmapMilestoneCount } from "../../../../utils/dashboard";

const THUMBS = [
  "linear-gradient(135deg, #0d9488, #34d399)",
  "linear-gradient(135deg, #047857, #10b981)",
  "linear-gradient(135deg, #0f766e, #5eead4)",
];

/** Continue-learning course cards derived from the learner's roadmaps. */
export default function ContinueLearning({ roadmaps = [] }) {
  const inProgress = roadmaps
    .filter((r) => Number(r.progressPercent || 0) < 100)
    .slice(0, 3);

  return (
    <SectionCard
      title="Continue Learning"
      icon="play_circle"
      action="My learning"
      actionTo="/learner/learning"
    >
      {inProgress.length === 0 ? (
        <EmptyState
          icon="menu_book"
          title="Nothing in progress"
          description="Start a learning roadmap to track your progress here."
          actionLabel="Explore skills"
          actionTo="/learner/skills"
        />
      ) : (
        <div className="ld-courses">
          {inProgress.map((r, i) => {
            const progress = Number(r.progressPercent || 0);
            const total = getRoadmapMilestoneCount(r) || 0;
            const remaining = Math.max(0, Math.round((total * (100 - progress)) / 100));
            return (
              <div key={r.id || i} className="ld-course">
                <div className="ld-course__thumb" style={{ background: THUMBS[i % THUMBS.length] }}>
                  <Icon name="school" />
                </div>
                <div className="ld-course__body">
                  <p className="md-row__title">{r.title || "Learning roadmap"}</p>
                  <div className="ld-course__bar">
                    <div className="md-progress-track">
                      <div className="md-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="ld-course__pct">{progress}%</span>
                  </div>
                  <div className="ld-course__foot">
                    <span className="md-row__meta" style={{ margin: 0 }}>
                      <Icon name="list_alt" /> {remaining} lessons left
                    </span>
                    <Link to="/learner/learning" className="md-btn md-btn--brand md-btn--sm">
                      <Icon name="play_arrow" /> Continue
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
