package com.skillswap.verification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * Spring Data repository for {@code SkillVerificationTask} persistence.
 */
public interface SkillVerificationTaskRepository extends JpaRepository<SkillVerificationTask, Long> {
    List<SkillVerificationTask> findByActiveTrue();

    List<SkillVerificationTask> findByMentorId(Long mentorId);

    /**
     * Re-points verification tasks from one skill name to another
     * (case-insensitive) when two skills are merged, keeping mentor-created
     * verification tasks attached to the surviving canonical skill.
     *
     * @param fromName the skill name being merged away
     * @param toName   the canonical skill name that survives
     * @return number of tasks re-pointed
     */
    @Modifying
    @Query("update SkillVerificationTask t set t.skillName = :toName "
            + "where lower(t.skillName) = lower(:fromName)")
    int mergeSkillName(@Param("fromName") String fromName, @Param("toName") String toName);

    /**
     * Counts how many verification tasks reference a skill name
     * (case-insensitive). Shown in the admin skill list.
     *
     * @param skillName the skill name
     * @return number of matching tasks
     */
    long countBySkillNameIgnoreCase(String skillName);

    /**
     * Returns {@code [lower(skillName), count]} grouped by skill name so the
     * admin skill list can show task usage without N+1 queries.
     *
     * @return rows of {@code Object[]} with a String and a Number
     */
    @Query("select lower(t.skillName), count(t) from SkillVerificationTask t group by lower(t.skillName)")
    List<Object[]> countGroupedBySkillName();
}
