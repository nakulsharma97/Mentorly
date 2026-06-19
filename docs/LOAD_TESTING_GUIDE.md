# Load Testing Guide

This guide explains how to run load tests on the Skill Swapping Platform to verify performance and reliability under stress.

## Performance Targets

| Metric                  | Target             | Tool       |
| ----------------------- | ------------------ | ---------- |
| API response time (p95) | < 500ms            | JMeter/K6  |
| Throughput              | > 100 requests/sec | JMeter/K6  |
| Error rate              | < 0.1%             | JMeter/K6  |
| Backend CPU usage       | < 70%              | Monitoring |
| Memory usage            | < 80%              | Monitoring |
| Database connections    | < 90% of max       | Monitoring |

## Prerequisites

### Option A: JMeter (GUI-based, beginner-friendly)

```bash
# macOS
brew install jmeter

# Windows
# Download from https://jmeter.apache.org/download_jmeter.cgi

# Linux
sudo apt install jmeter
```

### Option B: K6 (CLI-based, modern)

```bash
# macOS
brew install grafana/k6/k6

# Windows
choco install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6-stable.list
sudo apt-get update
sudo apt-get install k6
```

### Option C: Artillery (simple, Node.js-based)

```bash
npm install -g artillery
```

## Test Scenarios

### 1. Smoke Test (Quick Validation)

**Purpose**: Verify basic endpoints work

**JMeter Setup**:

1. File → New Test Plan
2. Add Thread Group (1 user, 1 second ramp-up, 1 loop)
3. Add HTTP Request:
   - URL: `http://localhost:8080/actuator/health`
   - Method: GET
4. Add View Results Tree listener
5. Run

**K6 Script** (`load-test/smoke.js`):

```javascript
import http from "k6/http";
import { check } from "k6";

export default function () {
  let res = http.get("http://localhost:8080/actuator/health");
  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });
}
```

```bash
k6 run load-test/smoke.js
```

### 2. Login Load Test (Authentication)

**K6 Script** (`load-test/login-load.js`):

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export let options = {
  vus: 50, // 50 virtual users
  duration: "2m", // 2 minute test
  rampUp: "30s", // Ramp up over 30 seconds
};

export default function () {
  let payload = JSON.stringify({
    email: `user${__VU}@example.com`,
    password: "password123",
  });

  let params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  let res = http.post(
    "http://localhost:8080/api/v1/auth/login",
    payload,
    params,
  );

  check(res, {
    "login successful": (r) => r.status === 200,
    "response time < 1s": (r) => r.timings.duration < 1000,
    "has token": (r) => r.body.includes("token"),
  });

  sleep(1);
}
```

```bash
k6 run load-test/login-load.js
```

### 3. Booking Idempotency Test

**K6 Script** (`load-test/booking-idempotency.js`):

```javascript
import http from "k6/http";
import { check } from "k6";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.1.0/index.js";

export let options = {
  vus: 20,
  duration: "1m",
};

export default function () {
  const token = "your-jwt-token-here";
  const idempotencyKey = `booking-${__VU}-${randomIntBetween(1, 1000)}`;

  let payload = JSON.stringify({
    sessionId: 1,
  });

  let params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": idempotencyKey,
    },
  };

  // Send same request 3 times (tests idempotency)
  for (let i = 0; i < 3; i++) {
    let res = http.post(
      "http://localhost:8080/api/v1/bookings",
      payload,
      params,
    );

    check(res, {
      "booking created/retrieved": (r) => r.status === 201 || r.status === 200,
      "idempotency works": (r) => r.status === 200 || r.status === 201,
    });
  }
}
```

```bash
k6 run load-test/booking-idempotency.js
```

### 4. Mixed Realistic Traffic

**K6 Script** (`load-test/mixed-traffic.js`):

```javascript
import http from "k6/http";
import { check, group, sleep } from "k6";

export let options = {
  stages: [
    { duration: "2m", target: 10 }, // Ramp up to 10 users
    { duration: "5m", target: 50 }, // Ramp up to 50 users
    { duration: "2m", target: 100 }, // Ramp up to 100 users
    { duration: "5m", target: 100 }, // Stay at 100 for 5 min
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    http_req_failed: ["rate<0.1"],
  },
};

export default function () {
  const baseUrl = "http://localhost:8080";

  group("Browse Sessions", () => {
    let res = http.get(`${baseUrl}/api/v1/sessions`);
    check(res, { "status 200": (r) => r.status === 200 });
  });

  sleep(1);

  group("Get Mentor Profile", () => {
    let res = http.get(`${baseUrl}/api/v1/users/mentors/1`);
    check(res, { "status 200": (r) => r.status === 200 });
  });

  sleep(2);

  group("Health Check", () => {
    let res = http.get(`${baseUrl}/actuator/health`);
    check(res, { "status 200": (r) => r.status === 200 });
  });

  sleep(1);
}
```

```bash
k6 run load-test/mixed-traffic.js --vus 100 --duration 30s
```

## Running Tests

### Against Local Backend

```bash
# Start backend first
cd backend
mvn spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=dev"

# In another terminal, run load test
k6 run load-test/smoke.js
```

### Against Staging

```bash
# Update URLs in scripts to staging
sed -i 's/localhost:8080/staging.example.com/g' load-test/mixed-traffic.js

# Run test
k6 run load-test/mixed-traffic.js
```

### Against Production (Carefully!)

```bash
# Use lower concurrency first to verify
k6 run load-test/smoke.js --vus 5 --duration 30s

# Gradually increase if health looks good
k6 run load-test/mixed-traffic.js --stage 1m@50vus --stage 2m@100vus
```

## Monitoring During Load Test

### Backend Metrics

Open in another terminal:

```bash
# Watch CPU/memory
watch -n 1 'ps aux | grep java'

# Or use jps + jstat
jps -lmv
jstat -gc <PID> 1000

# Monitor database connections
mysql -u root -p
> SHOW PROCESSLIST;
> SHOW ENGINE INNODB STATUS;
```

### Docker Container

```bash
docker stats <container-id>
```

### Kubernetes Pod

```bash
kubectl top pods
kubectl logs -f <pod-name>
```

### Prometheus Metrics

Access `http://localhost:8080/actuator/prometheus` and graph in Grafana:

```promql
# API latency (p95)
histogram_quantile(0.95, http_request_duration_seconds_bucket)

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# Throughput
rate(http_requests_total[5m])
```

## Analyzing Results

### K6 Output

```
execution: local
script: load-test/mixed-traffic.js
output: -

scenarios: (100.00%) 1 scenario, 100 max VUs, 10m30s max duration (incl. 1m ramp-up/down)

     data_received..................: 5.0 MB  4.8 kB/s
     data_sent.......................: 2.3 MB  2.2 kB/s
     http_req_blocked...............: avg=1.23ms   min=10µs   med=50µs   max=125ms
     http_req_connecting............: avg=0.87ms   min=0s     med=0s     max=98ms
     http_req_duration..............: avg=245ms    min=21ms   med=180ms  max=5.32s
     http_req_failed................: 0.42%   ← ERROR RATE TOO HIGH!
     http_req_receiving.............: avg=2.14ms   min=76µs   med=2.1ms  max=56ms
     http_req_sending...............: avg=0.76ms   min=0s     med=0.5ms  max=27ms
     http_req_tls_handshaking.......: avg=0.00ms   min=0s     med=0s     max=0s
     http_req_waiting...............: avg=241ms    min=18ms   med=176ms  max=5.31s
     http_requests..................: 15347   14.7/s  ← THROUGHPUT OK
     iteration_duration.............: avg=11.2s    min=10.1s  med=11.1s  max=13.2s
     iterations.....................: 1534    1.47/s
     vus............................: 100     100
     vus_max........................: 100     100

FAILED THRESHOLDS:
     http_req_failed................: 0.42% > 0.1%  ← INVESTIGATE!
     http_req_duration..............: max=5.32s > 1s threshold (p99)
```

**Analysis**:

- ✅ Throughput: 14.7 req/s is good
- ✅ Median latency: 180ms < 500ms target
- ❌ Error rate: 0.42% > 0.1% target — investigate failed requests
- ❌ Max latency: 5.32s is too high — check for timeouts

### JMeter Output

Right-click test → "Generate HTML Report":

```bash
jmeter -g results.jtl -o html-report
open html-report/index.html
```

## Common Issues & Solutions

| Issue                             | Cause                              | Solution                                           |
| --------------------------------- | ---------------------------------- | -------------------------------------------------- |
| Many 408/Connection Timeouts      | Thread pool exhausted              | Increase `Tomcat max-threads` in `application.yml` |
| High error rate at 50+ VUs        | Database connection pool exhausted | Increase `max-pool-size` in `application.yml`      |
| Memory usage > 90%                | Heap too small                     | Increase JVM heap: `-Xmx2g`                        |
| Database locked errors            | Long-running transactions          | Check for N+1 queries, add indexes                 |
| Response time increases over time | Memory leak                        | Check for unclosed resources in code               |

## Performance Tuning Checklist

- [ ] Databases indexed properly (check slow query log)
- [ ] Connection pooling configured
- [ ] API response times < 500ms p95
- [ ] No memory leaks (heap stable over time)
- [ ] Error handling doesn't slow down success paths
- [ ] Caching implemented for read-heavy endpoints
- [ ] Pagination implemented for list endpoints
- [ ] N+1 query problems resolved
- [ ] Gzip compression enabled for responses

## References

- [K6 Documentation](https://k6.io/docs/)
- [JMeter Official Guide](https://jmeter.apache.org/)
- [Artillery Documentation](https://artillery.io/)
- [Spring Boot Performance Tuning](https://spring.io/blog/2015/12/10/spring-boot-memory-performance)
