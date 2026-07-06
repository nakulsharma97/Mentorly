# Security Headers Configuration

This document explains the security headers implemented in the Skill Swapping Platform and how to configure them for different environments.

## Headers Configured

### 1. Content Security Policy (CSP)

**Purpose**: Prevent XSS attacks by controlling which resources can be loaded.

**Current Policy**:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:
```

**Configure in**: `SecurityConfig.java`

**To adjust for production**:

- Remove `'unsafe-inline'` if CSS/JS can be externalized
- Add specific CDN origins if using external resources
- Example: `script-src 'self' https://cdn.example.com`

### 2. X-Frame-Options

**Purpose**: Prevent clickjacking attacks.

**Current Setting**: `DENY` (frame embedding not allowed)

**Options**:

- `DENY`: No framing allowed
- `SAMEORIGIN`: Framing allowed from same domain only
- `ALLOW-FROM uri`: Framing allowed from specific origin

### 3. X-Content-Type-Options

**Purpose**: Prevent MIME type sniffing.

**Current Setting**: `nosniff` (always enforce declared content type)

### 4. Strict-Transport-Security (HSTS)

**Purpose**: Force HTTPS connections, prevent downgrade attacks.

**Current Settings**:

- Max age: 31536000 seconds (1 year)
- Include subdomains: Yes
- Preload: Yes (adds domain to browser preload list)

**For Production**:

```java
hsts.includeSubDomains(true).preload(true).maxAgeInSeconds(31536000)
```

### 5. X-XSS-Protection

**Purpose**: Legacy XSS protection for older browsers.

**Current Setting**: Enabled (browser default behavior)

## Environment-Specific Configuration

### Development

```yaml
# application-dev.yml
app:
  cors:
    allowed-origins: http://localhost:5174,http://127.0.0.1:5174
```

### Staging

```yaml
# application-staging.yml
app:
  cors:
    allowed-origins: https://staging-app.example.com,https://staging.example.com
```

### Production

```yaml
# application-prod.yml
app:
  cors:
    allowed-origins: https://app.example.com
```

## Testing Security Headers

### Using curl

```bash
# Check which headers are present
curl -I https://your-api.example.com/api/v1/health

# Expected headers:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Content-Security-Policy: default-src 'self'...
```

### Using online tools

- https://securityheaders.com
- https://csp-evaluator.withgoogle.com

### Verify in browser

Open DevTools → Network tab → Click any request → "Response Headers" section

## CSP Violations

If legitimate resources are blocked, CSP violations will appear in browser console:

```
Refused to load the script from 'https://example.com/script.js'
because it violates the Content-Security-Policy directive.
```

**To fix**: Add the origin to CSP policy in `SecurityConfig`:

```java
.contentSecurityPolicy(csp -> csp.policyDirectives(
  "default-src 'self'; script-src 'self' https://example.com; ..."
))
```

## CORS Configuration

Separate from security headers, CORS controls cross-origin requests.

**Current Configuration in `SecurityConfig`**:

```java
config.setAllowedOriginPatterns(allowedOrigins.split(","));
config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
config.setAllowedHeaders(List.of("*"));
config.setAllowCredentials(true);
config.setExposedHeaders(List.of("X-Total-Count", "X-Page-Number", "X-Page-Size"));
```

**For Production**:

- Restrict `allowedOrigins` to your frontend domain(s) only
- Don't use `*` for allowed headers if not needed
- Only expose headers required by frontend

Example:

```yaml
# Environment variable
CORS_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
```

## Security Headers Checklist

- [ ] All headers are set (run curl test above)
- [ ] CSP doesn't use `unsafe-eval`
- [ ] CSP `default-src` is not `*`
- [ ] HSTS max-age >= 31536000 for production
- [ ] X-Frame-Options is set (DENY or SAMEORIGIN)
- [ ] X-Content-Type-Options is set to `nosniff`
- [ ] CORS allowed origins are restrictive
- [ ] No overly permissive CSP directives
- [ ] Tested in target browsers

## Troubleshooting

| Issue                           | Solution                                        |
| ------------------------------- | ----------------------------------------------- |
| "Refused to load script"        | Add origin to CSP script-src directive          |
| "Refused to load stylesheet"    | Add origin to CSP style-src directive           |
| CORS errors from frontend       | Check CORS_ALLOWED_ORIGINS environment variable |
| Subdomains get security headers | Verify HSTS includeSubDomains is correct        |

## References

- [OWASP: Security Headers](https://owasp.org/www-project-secure-headers/)
- [MDN: Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)
- [MDN: Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
