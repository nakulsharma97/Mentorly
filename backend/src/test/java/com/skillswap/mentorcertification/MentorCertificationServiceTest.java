package com.skillswap.mentorcertification;

import com.skillswap.user.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentorCertificationServiceTest {

    @Mock
    private MentorCertificationRepository certificationRepository;

    @InjectMocks
    private MentorCertificationService certificationService;

    private User mentor(Long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private MentorCertificationDto validRequest() {
        MentorCertificationDto dto = new MentorCertificationDto();
        dto.setCertificationName("AWS Certified Developer");
        dto.setIssuingOrganization("Amazon Web Services");
        dto.setIssueDate(LocalDate.of(2024, 1, 1));
        return dto;
    }

    @Test
    void createPersistsCertificationForOwner() {
        User owner = mentor(7L);
        when(certificationRepository.save(any(MentorCertification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        MentorCertificationDto result = certificationService.create(owner, validRequest());

        assertThat(result.getCertificationName()).isEqualTo("AWS Certified Developer");
        verify(certificationRepository).save(any(MentorCertification.class));
    }

    @Test
    void createRejectsExpiryBeforeIssueDate() {
        MentorCertificationDto request = validRequest();
        request.setExpiryDate(LocalDate.of(2023, 12, 31));

        assertThatThrownBy(() -> certificationService.create(mentor(7L), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Expiry date");

        verify(certificationRepository, never()).save(any());
    }

    @Test
    void createRejectsBlankCertificationName() {
        MentorCertificationDto request = validRequest();
        request.setCertificationName("   ");

        assertThatThrownBy(() -> certificationService.create(mentor(7L), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Certification name");
    }

    @Test
    void createRejectsDuplicateCertificationForSameMentor() {
        User owner = mentor(7L);
        MentorCertification existing = new MentorCertification();
        existing.setMentor(owner);
        existing.setCertificationName("AWS Certified Developer");
        existing.setIssuingOrganization("Amazon Web Services");
        existing.setIssueDate(LocalDate.of(2024, 1, 1));
        when(certificationRepository.findByMentorIdOrderByIssueDateDesc(7L)).thenReturn(List.of(existing));

        MentorCertificationDto request = validRequest();

        assertThatThrownBy(() -> certificationService.create(owner, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");

        verify(certificationRepository, never()).save(any());
    }

    @Test
    void updateByNonOwnerThrows() {
        MentorCertification existing = new MentorCertification();
        existing.setId(99L);
        existing.setMentor(mentor(1L));
        when(certificationRepository.findById(99L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> certificationService.update(mentor(2L), 99L, validRequest()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");

        verify(certificationRepository, never()).save(any());
    }

    @Test
    void deleteByOwnerRemovesCertification() {
        MentorCertification existing = new MentorCertification();
        existing.setId(99L);
        existing.setMentor(mentor(5L));
        when(certificationRepository.findById(99L)).thenReturn(Optional.of(existing));

        certificationService.delete(mentor(5L), 99L);

        verify(certificationRepository).delete(existing);
    }

    @Test
    void listForMentorReturnsMappedDtos() {
        MentorCertification existing = new MentorCertification();
        existing.setId(1L);
        existing.setMentor(mentor(5L));
        existing.setCertificationName("Oracle Certified Java Professional");
        existing.setIssuingOrganization("Oracle");
        existing.setIssueDate(LocalDate.of(2024, 2, 2));
        when(certificationRepository.findByMentorIdOrderByIssueDateDesc(5L)).thenReturn(List.of(existing));

        List<MentorCertificationDto> result = certificationService.listForMentor(5L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getMentorId()).isEqualTo(5L);
        assertThat(result.get(0).getCertificationName()).isEqualTo("Oracle Certified Java Professional");
    }
}
