import SectionCard, { EmptyState } from "../../../common/dashboard/SectionCard";
import Icon from "../../../common/dashboard/Icon";
import { getRoadmapMilestoneCount } from "../../../../utils/dashboard";

/** Vertical roadmap timeline with per-roadmap progress. */
export default function LearningRoadmap({ roadmaps = [] }) {
  return (
    <SectionCard
      title="Learning Roadmap"
      icon="route"
      action="Open path"
      actionTo="/learner/path"
    >
      {roadmaps.length === 0 ? (
        <EmptyState
          icon="signpost"
          title="No roadmap yet"
          description="Create a learning path to map milestones toward your goal."
          actionLabel="Explore skills"
          actionTo="/learner/skills"
        />
      ) : (
        <div className="ld-timeline">
          {roadmaps.slice(0, 4).map((r) => {
            const progress = Number(r.progressPercent || 0);
            const done = progress >= 100;
            return (
              <div key={r.id} className={`ld-timeline__item${done ? " is-done" : ""}`}>
                <span className="ld-timeline__dot">
                  <Icon name={done ? "check" : "radio_button_unchecked"} />
                </span>
                <div className="ld-timeline__body">
                  <div className="ld-timeline__head">
                    <p className="md-row__title">{r.title || "Roadmap"}</p>
                    <span className="md-badge md-badge--info">{progress}%</span>
                  </div>
                  <div className="md-progress-track">
                    <div className="md-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="md-row__meta" style={{ margin: "6px 0 0" }}>
                    <Icon name="flag" /> {getRoadmapMilestoneCount(r)} milestones
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
