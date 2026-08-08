export const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];

const normalizeLegacySkills = (rawSkills) => {
  return String(rawSkills || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name) => ({ name, level: "Intermediate" }));
};

export const parseSkillTags = (rawSkills) => {
  const value = String(rawSkills || "").trim();
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return normalizeLegacySkills(value);
    }

    return parsed
      .map((item) => {
        if (typeof item === "string") {
          return { name: item.trim(), level: "Intermediate" };
        }

        const candidateName = String(
          item?.name || item?.skill || item?.skillName || "",
        ).trim();
        const candidateLevel = String(
          item?.level || item?.proficiency || item?.experience || "",
        ).trim();

        return {
          name: candidateName,
          level: SKILL_LEVELS.includes(candidateLevel)
            ? candidateLevel
            : "Intermediate",
        };
      })
      .filter((item) => item.name);
  } catch {
    return normalizeLegacySkills(value);
  }
};

export const serializeSkillTags = (tags) => {
  return JSON.stringify(
    (tags || [])
      .map((tag) => ({
        name: String(tag?.name || "").trim(),
        level: SKILL_LEVELS.includes(tag?.level) ? tag.level : "Intermediate",
      }))
      .filter((tag) => tag.name),
  );
};

export const getProfileQualityScore = (profile) => {
  // The backend (ProfileCompletionService) is the single source of truth.
  // Never compute a divergent local score.
  if (typeof profile?.profileCompletionPercent === "number") {
    return profile.profileCompletionPercent;
  }
  return 0;
};
