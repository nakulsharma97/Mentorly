package com.skillswap.auth;

import com.skillswap.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.UUID;
import java.util.Map;
import java.util.function.Function;

@Service
public class JwtService {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

    @Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    private SecretKey signingKey;

    @PostConstruct
    void validateSecret() {
        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(secret);
        } catch (RuntimeException ex) {
            throw new IllegalStateException("app.jwt.secret must be a valid base64-encoded HMAC key", ex);
        }

        if (keyBytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret must decode to at least 32 bytes");
        }

        signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    public String generateToken(UserDetails userDetails) {
        return generateToken(userDetails, UUID.randomUUID().toString());
    }

    public String generateToken(UserDetails userDetails, String tokenId) {
        return generateToken(buildAccessClaims(userDetails, tokenId), userDetails);
    }

    public String generateRefreshToken(UserDetails userDetails) {
        return generateRefreshToken(userDetails, UUID.randomUUID().toString());
    }

    public String generateRefreshToken(UserDetails userDetails, String tokenId) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + refreshExpirationMs);
        Map<String, Object> claims = buildRefreshClaims(userDetails, tokenId);
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .claims(claims)
                .subject(userDetails.getUsername())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    public String generateToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .claims(extraClaims)
                .subject(userDetails.getUsername())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    public boolean isAccessToken(String token) {
        try {
            String tokenType = String.valueOf(extractAllClaims(token).get("tokenType"));
            return "access".equalsIgnoreCase(tokenType) && !isTokenExpired(token);
        } catch (RuntimeException ex) {
            return false;
        }
    }

    public boolean isRefreshToken(String token) {
        try {
            String tokenType = String.valueOf(extractAllClaims(token).get("tokenType"));
            return "refresh".equalsIgnoreCase(tokenType) && !isTokenExpired(token);
        } catch (RuntimeException ex) {
            return false;
        }
    }

    public String extractTokenId(String token) {
        Object tokenId = extractAllClaims(token).get("tokenId");
        if (tokenId == null || String.valueOf(tokenId).isBlank()) {
            throw new IllegalArgumentException("Invalid refresh token");
        }
        return String.valueOf(tokenId);
    }

    public Long extractUserId(String token) {
        Object userId = extractAllClaims(token).get("userId");
        if (userId instanceof Number number) {
            return number.longValue();
        }
        if (userId != null) {
            try {
                return Long.parseLong(String.valueOf(userId));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    public String extractJwtId(String token) {
        String jwtId = extractAllClaims(token).getId();
        if (jwtId == null || jwtId.isBlank()) {
            throw new IllegalArgumentException("Invalid token");
        }
        return jwtId;
    }

    /**
     * Extracts the role claim (e.g. "ADMIN", "MENTOR", "LEARNER") from a token.
     * Returns {@code null} if the token predates the role claim and therefore
     * does not carry it — callers must not treat a missing claim as a failure.
     */
    public String extractRole(String token) {
        Object role = extractAllClaims(token).get("role");
        return role == null ? null : String.valueOf(role);
    }

    public Claims extractAllClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException ex) {
            throw new IllegalArgumentException("Invalid token", ex);
        }
    }

    private Map<String, Object> buildAccessClaims(UserDetails userDetails, String tokenId) {
        Map<String, Object> claims = new java.util.LinkedHashMap<>();
        claims.put("tokenType", "access");
        claims.put("tokenId", tokenId);
        claims.put("userId", resolveUserId(userDetails));
        // Role claim lets clients and downstream components (admin UI, feature
        // flags) determine the user's role without a DB round-trip. It is purely
        // informational — authorization is always re-validated server-side from
        // the live User record via getAuthorities().
        claims.put("role", resolveRole(userDetails));
        return claims;
    }

    private Map<String, Object> buildRefreshClaims(UserDetails userDetails, String tokenId) {
        Map<String, Object> claims = new java.util.LinkedHashMap<>();
        claims.put("tokenType", "refresh");
        claims.put("tokenId", tokenId);
        claims.put("userId", resolveUserId(userDetails));
        claims.put("role", resolveRole(userDetails));
        return claims;
    }

    private String resolveRole(UserDetails userDetails) {
        if (userDetails instanceof User user && user.getRole() != null) {
            return user.getRole().name();
        }
        // Fallback for non-User UserDetails implementations: derive from the
        // granted authority, e.g. "ROLE_ADMIN" -> "ADMIN".
        return userDetails.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(authority -> authority != null && authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .findFirst()
                .orElse(null);
    }

    private Long resolveUserId(UserDetails userDetails) {
        if (userDetails instanceof User user) {
            return user.getId();
        }
        return null;
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private SecretKey getSigningKey() {
        return signingKey;
    }
}
