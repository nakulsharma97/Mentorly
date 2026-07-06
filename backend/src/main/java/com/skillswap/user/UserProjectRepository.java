package com.skillswap.user;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserProjectRepository extends JpaRepository<UserProject, Long> {
    List<UserProject> findByUserId(Long userId);

    void deleteByUserId(Long userId);
}
