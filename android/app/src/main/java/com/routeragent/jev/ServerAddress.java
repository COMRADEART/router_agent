package com.routeragent.jev;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Remote origins only: never store credentials or connection tokens in URLs. */
public final class ServerAddress {
    private ServerAddress() {}

    public static String normalize(String input) {
        try {
            URI uri = new URI(input.trim());
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || host.isEmpty()
                    || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || (uri.getRawPath() != null && !uri.getRawPath().isEmpty() && !"/".equals(uri.getRawPath()))
                    || uri.getPort() > 65535 || uri.getPort() == 0) {
                throw new IllegalArgumentException("Enter only the HTTPS address, without a path, password or query.");
            }
            host = host.toLowerCase(Locale.ROOT);
            if (host.equals("localhost") || host.endsWith(".localhost") || host.startsWith("127.")
                    || host.equals("[::1]") || host.equals("::1") || host.equals("0.0.0.0")) {
                throw new IllegalArgumentException("Use your computer's remote HTTPS address. Localhost refers to this phone.");
            }
            int port = uri.getPort() == 443 ? -1 : uri.getPort();
            return new URI("https", null, host, port, "/", null, null).toASCIIString();
        } catch (URISyntaxException ex) {
            throw new IllegalArgumentException("Enter a valid HTTPS address.");
        }
    }

    public static boolean sameOrigin(String left, String right) {
        try {
            URI a = new URI(left);
            URI b = new URI(right);
            int aPort = a.getPort() == -1 ? 443 : a.getPort();
            int bPort = b.getPort() == -1 ? 443 : b.getPort();
            return "https".equalsIgnoreCase(a.getScheme()) && "https".equalsIgnoreCase(b.getScheme())
                    && a.getHost() != null && a.getHost().equalsIgnoreCase(b.getHost()) && aPort == bPort;
        } catch (URISyntaxException ex) { return false; }
    }
}
