package com.skillswap.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@link CareerPath}.
 */
public interface CareerPathRepository extends JpaRepository<CareerPath, Long> {

    List<CareerPath> findByActiveTrueOrderBySortOrderAsc();
}
