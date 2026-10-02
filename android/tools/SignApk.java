import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.*;
import java.security.*;
import java.security.cert.X509Certificate;
import java.nio.file.Files;
import java.util.*;

public final class SignApk {
    public static void main(String[] args) throws Exception {
        if (args[0].equals("sign")) {
            char[] password = Files.readString(new File(args[2]).toPath()).trim().toCharArray();
            KeyStore store = KeyStore.getInstance("PKCS12");
            try (InputStream input = new FileInputStream(args[1])) { store.load(input, password); }
            PrivateKey key = (PrivateKey) store.getKey("jev", password);
            X509Certificate certificate = (X509Certificate) store.getCertificate("jev");
            ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder("jev", key, Collections.singletonList(certificate)).build();
            new ApkSigner.Builder(Collections.singletonList(signer)).setInputApk(new File(args[3]))
                    .setOutputApk(new File(args[4])).setMinSdkVersion(26)
                    .setV1SigningEnabled(true).setV2SigningEnabled(true).setV3SigningEnabled(true).build().sign();
            Arrays.fill(password, '\0');
        }
        String apk = args[0].equals("sign") ? args[4] : args[1];
        ApkVerifier.Result result = new ApkVerifier.Builder(new File(apk)).setMinCheckedPlatformVersion(26).build().verify();
        if (!result.isVerified()) throw new IllegalStateException("APK verification failed: " + result.getErrors());
        System.out.println("Verified APK: " + apk);
        System.out.println("APK signatures v1=" + result.isVerifiedUsingV1Scheme() + " v2=" + result.isVerifiedUsingV2Scheme() + " v3=" + result.isVerifiedUsingV3Scheme());
        for (ApkVerifier.IssueWithParams warning : result.getWarnings()) System.out.println("Warning: " + warning);
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        for (X509Certificate certificate : result.getSignerCertificates()) {
            System.out.println("Signing certificate SHA-256: " + HexFormat.of().formatHex(sha.digest(certificate.getEncoded())));
        }
    }
}
