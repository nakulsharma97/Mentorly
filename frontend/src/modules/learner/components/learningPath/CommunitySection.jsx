import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { Avatar, Reveal, SectionHeader } from "./ui";

/** Community: leaderboard rank, friends learning, groups, partners, challenges. */
export default function CommunitySection({ community }) {
  if (!community) return null;
  const { peers, friendsLearning, groups, studyPartners, challenges, rank } = community;

  return (
    <section className="lp-section" aria-label="Community">
      <Reveal>
        <SectionHeader
          icon="groups"
          title="Learning Community"
          subtitle={`${peers} learners are on a journey right now — you're not alone`}
        />
      </Reveal>

      <Reveal delay={0.05}>
        <div className="lp-community">
          <div className="lp-community__rank">
            <div className="lp-community__rank-art">
              <span className="lp-community__trophy">🏆</span>
              <strong>#{rank}</strong>
              <span>Your rank</span>
            </div>
            <p>
              <Icon name="group" /> <strong>{friendsLearning}</strong> friends learning this week
            </p>
            <Link to="/learner/messages" className="lp-btn lp-btn--outline lp-btn--sm">
              <Icon name="forum" /> Find Study Partners
            </Link>
          </div>

          <div className="lp-community__card">
            <h3><Icon name="workspaces" /> Discussion Groups</h3>
            <ul className="lp-community__groups">
              {groups.map((g) => (
                <li key={g}>
                  <span className="lp-community__group-icon"><Icon name="diversity_3" /></span>
                  {g}
                  <Icon name="arrow_forward_ios" />
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-community__card">
            <h3><Icon name="handshake" /> Study Partners</h3>
            <ul className="lp-community__partners">
              {studyPartners.length === 0 && (
                <li className="lp-community__none">Book sessions with mentors to grow your circle.</li>
              )}
              {studyPartners.map((m) => (
                <li key={m.id ?? m.fullName}>
                  <Avatar url={m.profileImageUrl} name={m.fullName} size={34} />
                  <div>
                    <strong>{m.fullName}</strong>
                    <span>Available to learn together</span>
                  </div>
                  <Link to="/learner/messages" aria-label={`Message ${m.fullName}`}>
                    <Icon name="chat_bubble" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-community__card">
            <h3><Icon name="emoji_events" /> Peer Challenges</h3>
            <ul className="lp-community__challenges">
              {challenges.map((c) => (
                <li key={c.title}>
                  <div className="lp-community__challenge-head">
                    <strong>{c.title}</strong>
                    <span><Icon name="star" /> {c.reward}</span>
                  </div>
                  <div className="lp-bar">
                    <div className="lp-bar__fill" style={{ width: `${c.progress}%` }} />
                  </div>
                  <small>{c.progress}% complete</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
