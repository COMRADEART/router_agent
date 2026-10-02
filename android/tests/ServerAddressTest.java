package com.routeragent.jev;

public final class ServerAddressTest {
    private static void expect(String actual, String expected) {
        if (!actual.equals(expected)) throw new AssertionError(actual + " != " + expected);
    }
    public static void main(String[] args) {
        expect(ServerAddress.normalize(" HTTPS://JEV.EXAMPLE:443/ "), "https://jev.example/");
        expect(ServerAddress.normalize("https://jev.example:8443"), "https://jev.example:8443/");
        expect(ServerAddress.normalize("https://100.64.2.3"), "https://100.64.2.3/");
        String[] invalid = { "", "http://jev.example", "javascript:alert(1)", "file:///etc/passwd",
                "https://user:password@jev.example", "https://jev.example/?token=secret", "https://jev.example/#secret",
                "https://jev.example/path", "https://localhost", "https://127.0.0.1", "https://[::1]",
                "https://jev.example:99999", "https://jev.example:0", "https://jev.example\\@attacker.example" };
        for (String input : invalid) {
            try { ServerAddress.normalize(input); throw new AssertionError("Accepted: " + input); }
            catch (IllegalArgumentException expected) { /* validation refused unsafe or unusable input */ }
        }
        if (!ServerAddress.sameOrigin("https://jev.example/", "https://jev.example:443/tasks")) throw new AssertionError("same origin");
        if (ServerAddress.sameOrigin("https://jev.example/", "https://jev.example.attacker.example/")) throw new AssertionError("lookalike origin");
        if (ServerAddress.sameOrigin("https://jev.example/", "http://jev.example/")) throw new AssertionError("cleartext origin");
        if (ServerAddress.sameOrigin("https://jev.example/", "https://jev.example:8443/")) throw new AssertionError("different port");
        System.out.println("Android connection policy: 21 checks passed.");
    }
}
