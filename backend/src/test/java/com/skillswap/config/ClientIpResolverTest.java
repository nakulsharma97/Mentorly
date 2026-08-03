package com.skillswap.config;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Verifies the trusted-proxy-aware client IP resolution. The core guarantee:
 * client-supplied {@code X-Forwarded-For} values are NEVER trusted unless the
 * deployment is behind a trusted proxy, and even then only the right-most
 * (proxy-appended) entry is used.
 */
class ClientIpResolverTest {

    private HttpServletRequest request(String remoteAddr, String xForwardedFor, String xRealIp) {
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRemoteAddr()).thenReturn(remoteAddr);
        when(req.getHeader("X-Forwarded-For")).thenReturn(xForwardedFor);
        when(req.getHeader("X-Real-IP")).thenReturn(xRealIp);
        return req;
    }

    @Test
    void directExposure_ignoresSpoofedForwardedFor() {
        ClientIpResolver resolver = new ClientIpResolver(false);
        // A directly-exposed client can set any header — only the socket IP counts.
        HttpServletRequest req = request("203.0.113.9", "6.6.6.6, 1.2.3.4", "1.2.3.4");
        assertThat(resolver.resolve(req)).isEqualTo("203.0.113.9");
    }

    @Test
    void trustedProxy_usesRightMostForwardedForEntryAppendedByProxy() {
        ClientIpResolver resolver = new ClientIpResolver(true);
        // Attacker spoofs the left-most entries; the trusted proxy appended the
        // real client IP last ($proxy_add_x_forwarded_for).
        HttpServletRequest req = request("10.0.0.5", "6.6.6.6, 203.0.113.9", "203.0.113.9");
        assertThat(resolver.resolve(req)).isEqualTo("203.0.113.9");
    }

    @Test
    void trustedProxy_singleEntryUsesIt() {
        ClientIpResolver resolver = new ClientIpResolver(true);
        HttpServletRequest req = request("10.0.0.5", "203.0.113.9", "203.0.113.9");
        assertThat(resolver.resolve(req)).isEqualTo("203.0.113.9");
    }

    @Test
    void trustedProxy_fallsBackToXRealIpWhenNoForwardedFor() {
        ClientIpResolver resolver = new ClientIpResolver(true);
        HttpServletRequest req = request("10.0.0.5", null, "198.51.100.7");
        assertThat(resolver.resolve(req)).isEqualTo("198.51.100.7");
    }

    @Test
    void nullRequestReturnsUnknown() {
        assertThat(new ClientIpResolver(false).resolve(null)).isEqualTo("unknown");
    }
}
