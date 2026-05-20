# Audit Logging Implementation

This document explains how to use and monitor the audit logging system in the Skill Swapping Platform.

## Overview

Audit logging tracks sensitive operations for security, compliance, and debugging purposes.

**Logged Information**:

- Action performed (e.g., BOOKING_CREATED, PAYMENT_PROCESSED)
- Resource affected (e.g., BOOKING, PAYMENT)
- Resource ID
- User ID
- Timestamp
- Client IP address
- Additional details (optional)

## Using Audit Logs

### 1. Add Audit Logging to a Controller Method

Use the `@AuditableOperation` annotation on any method you want to log:

```java
@PostMapping
@AuditableOperation(
    action = "BOOKING_CREATED",
    resource = "BOOKING",
    resourceIdField = "id"
)
public ResponseEntity<BookingDto> createBooking(@RequestBody CreateBookingRequest request) {
    Booking booking = bookingService.create(request);
    return ResponseEntity.ok(new BookingDto(booking));
}
```

**Parameters**:

- `action`: What action was performed (use SNAKE_CASE)
- `resource`: What resource was affected (use SNAKE_CASE)
- `resourceIdField`: The field name in the request body containing the resource ID (defaults to "id")

### 2. Manual Audit Logging in Service Layer

For complex operations, inject `AuditLogService` and log manually:

```java
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final AuditLogService auditLogService;

    public void processRefund(Long paymentId, Long userId, String reason) {
        Payment payment = paymentRepository.findById(paymentId).orElseThrow();

        // Perform refund logic...
        payment.setStatus(PaymentStatus.REFUNDED);
        paymentRepository.save(payment);

        // Log the audit event
        auditLogService.log(
            "PAYMENT_REFUNDED",
            "PAYMENT",
            paymentId,
            "Reason: " + reason,
            userId
        );
    }
}
```

## Common Audit Actions

| Action                | Resource | When                         |
| --------------------- | -------- | ---------------------------- |
| BOOKING_CREATED       | BOOKING  | User creates a new booking   |
| BOOKING_CANCELLED     | BOOKING  | User cancels a booking       |
| BOOKING_CONFIRMED     | BOOKING  | Mentor confirms a booking    |
| BOOKING_REJECTED      | BOOKING  | Mentor rejects a booking     |
| PAYMENT_CREATED       | PAYMENT  | Payment intent created       |
| PAYMENT_PROCESSED     | PAYMENT  | Payment successfully charged |
| PAYMENT_REFUNDED      | PAYMENT  | Payment refunded to user     |
| USER_LOGIN            | USER     | User logs in successfully    |
| USER_PASSWORD_CHANGED | USER     | User changes password        |
| MENTOR_VERIFIED       | MENTOR   | Mentor verification approved |
| SESSION_PUBLISHED     | SESSION  | Mentor publishes a session   |
| REVIEW_SUBMITTED      | REVIEW   | User submits a review        |

## Querying Audit Logs

Inject `AuditLogService` to query audit logs:

```java
// By user
List<AuditLog> userAudits = auditLogService.getAuditsByUser(userId);

// By action
List<AuditLog> bookingCreations = auditLogService.getAuditsByAction("BOOKING_CREATED");

// By resource
List<AuditLog> bookingAudits = auditLogService.getAuditsByResource("BOOKING", bookingId);

// By date range
List<AuditLog> recentAudits = auditLogService.getAuditsBetween(
    OffsetDateTime.now().minusHours(24),
    OffsetDateTime.now()
);
```

## Viewing Audit Logs via API

_(Optional: Create a REST endpoint for authorized admins)_

```java
@GetMapping("/admin/audits")
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<List<AuditLogDto>> getAudits(
    @RequestParam(required = false) Long userId,
    @RequestParam(required = false) String action
) {
    List<AuditLog> logs = userId != null
        ? auditLogService.getAuditsByUser(userId)
        : auditLogService.getAuditsByAction(action);
    return ResponseEntity.ok(logs.stream().map(AuditLogDto::fromEntity).toList());
}
```

## Monitoring Audit Logs

### Check for Suspicious Activity

```sql
-- Find failed login attempts
SELECT * FROM audit_logs
WHERE action = 'USER_LOGIN_FAILED'
AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY);

-- Find password changes by specific user
SELECT * FROM audit_logs
WHERE action = 'USER_PASSWORD_CHANGED'
AND user_id = 123;

-- Find bulk refunds (fraud indicator)
SELECT user_id, COUNT(*) as refund_count FROM audit_logs
WHERE action = 'PAYMENT_REFUNDED'
AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY user_id
HAVING COUNT(*) > 5;
```

### Integration with Monitoring Tools

Send audit logs to your logging platform (ELK, Splunk, Datadog):

```yaml
# application-prod.yml
logging:
  pattern:
    console: "%d{ISO8601} %p [audit] [userId=%X{userId}] [action=%X{action}] %m%n"
```

## Data Retention Policy

Audit logs should be retained for compliance purposes. Typical retention periods:

- **Default**: 1-2 years
- **Regulatory**: 3-7 years (depending on jurisdiction)
- **PCI-DSS**: Minimum 1 year online, 3 months archived

**To archive old logs**:

```sql
-- Archive logs older than 1 year
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);

DELETE FROM audit_logs
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);

-- Create index on archived table
CREATE INDEX idx_archive_created_at ON audit_logs_archive(created_at);
```

## Privacy Considerations

The audit log system logs:

- ✅ User ID (numeric, anonymized)
- ✅ IP address (first octet may be masked for privacy)
- ✅ Resource IDs and actions
- ❌ NOT: Passwords, payment card numbers, sensitive PII

**For GDPR Compliance**:

- Allow users to request their audit logs
- Implement right to erasure for deleted users (with regulatory holds)
- Mask IP addresses in audit logs after 30 days (optional)

## Testing Audit Logs

```java
@SpringBootTest
public class AuditLoggingTest {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Test
    public void testAuditLogCreation() {
        AuditLog log = new AuditLog(
            "TEST_ACTION",
            "TEST_RESOURCE",
            1L,
            "Test details",
            100L,
            "127.0.0.1"
        );
        auditLogRepository.save(log);

        List<AuditLog> logs = auditLogRepository.findByUserIdOrderByCreatedAtDesc(100L);
        assertThat(logs).isNotEmpty();
        assertThat(logs.get(0).getAction()).isEqualTo("TEST_ACTION");
    }
}
```

## Troubleshooting

| Issue                        | Solution                                                              |
| ---------------------------- | --------------------------------------------------------------------- |
| Audit logs not being created | Check `@AuditableOperation` annotation is present and correct         |
| Wrong user ID in logs        | Verify user is authenticated in SecurityContext                       |
| Missing IP address           | Check `X-Forwarded-For` header is set (for load-balanced deployments) |
| Performance slow             | Add index on `created_at` column (already done in schema)             |

## References

- [OWASP: Logging and Monitoring](https://owasp.org/www-community/attacks/Improper_Output_Neutralization_for_Logs_%28Log_Injection%29)
- [PCI-DSS Requirement 10: Logging and Monitoring](https://www.pcisecuritystandards.org/)
- [GDPR Article 32: Security of Processing](https://gdpr-info.eu/art-32-gdpr/)
