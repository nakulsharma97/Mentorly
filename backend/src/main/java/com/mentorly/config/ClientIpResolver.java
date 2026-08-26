package com.mentorly.config;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Resolves the originating client IP for rate limiting and audit logging.
 *
 * <p>Client-supplied proxy headers are never trusted by default.
 * {@code X-Forwarded-For} can be spoofed by any client that can set HTTP
 * headers, so it is only consulted when the deployment sits behind a trusted
 * reverse proxy ({@code app.security.trusted-proxy=true}, e.g. the nginx
 * fronting the API in prod/staging). In that mode the proxy appends the real
 * client IP as the RIGHT-MOST entry of {@code X-Forwarded-For} (nginx uses
 * {@code $proxy_add_x_forwarded_for}) and sets {@code X-Real-IP} to
 * {@code $remote_addr}, so the left-most entries — which the client controls —
 * are never trusted. When proxy headers are not trusted, only
 * {@link HttpServletRequest#getRemoteAddr()} is used, so a client can never
 * spoof its rate-limit identity.
 */
/**
 * Encapsulates client ip resolver.
 */
@Component
public class ClientIpResolver {

    private static final Logger LOG = LoggerFactory.getLogger(ClientIpResolver.class);

    private final boolean trustProxyHeaders;

    public ClientIpResolver(@Value("${app.security.trusted-proxy:false}") boolean trustProxyHeaders) {
        this.trustProxyHeaders = trustProxyHeaders;
        if (trustProxyHeaders) {
            LOG.warn("ClientIpResolver: app.security.trusted-proxy=true — forwarding headers will be "
                    + "trusted. ONLY enable this when the app is deployed behind a trusted reverse "
                    + "proxy that overwrites/appends X-Forwarded-For.");
        }
    }

    public boolean isTrustProxyHeaders() {
        return trustProxyHeaders;
    }

    public String resolve(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        if (trustProxyHeaders) {
            String xForwardedFor = request.getHeader("X-Forwarded-For");
            if (xForwardedFor != null && !xForwardedFor.isBlank()) {
                String[] entries = xForwardedFor.split(",");
                // The trusted proxy appends the immediate client IP last; any
                // value the client supplied sits to its left and is ignored.
                String rightMost = entries[entries.length - 1].trim();
                if (!rightMost.isBlank()) {
                    return rightMost;
                }
            }
            String xRealIp = request.getHeader("X-Real-IP");
            if (xRealIp != null && !xRealIp.isBlank()) {
                return xRealIp.trim();
            }
        }
        String remoteAddr = request.getRemoteAddr();
        return remoteAddr == null || remoteAddr.isBlank() ? "unknown" : remoteAddr;
    }
}
