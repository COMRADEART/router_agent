import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;

/** Store APK resources at 4-byte boundaries before APK v2/v3 signing. */
public final class PackageApk {
    private static final class CountingStream extends FilterOutputStream {
        long count;
        CountingStream(OutputStream stream) { super(stream); }
        @Override public void write(int value) throws IOException { out.write(value); count++; }
        @Override public void write(byte[] bytes, int offset, int length) throws IOException {
            out.write(bytes, offset, length); count += length;
        }
    }
    private static void put(ZipOutputStream output, CountingStream counter, String name, byte[] bytes) throws IOException {
        ZipEntry entry = new ZipEntry(name);
        CRC32 crc = new CRC32();
        crc.update(bytes);
        entry.setMethod(ZipEntry.STORED);
        entry.setSize(bytes.length);
        entry.setCompressedSize(bytes.length);
        entry.setCrc(crc.getValue());
        // Fix ZIP timestamps so metadata does not add an extended time field.
        entry.setTime(1609459200000L);
        long dataOffset = counter.count + 30 + name.getBytes(StandardCharsets.UTF_8).length;
        if (dataOffset % 4 != 0) {
            int length = 4 + (int) ((4 - ((dataOffset + 4) % 4)) % 4);
            byte[] extra = new byte[length];
            extra[0] = (byte) 0xff;
            extra[1] = (byte) 0xff;
            extra[2] = (byte) (length - 4);
            entry.setExtra(extra);
        }
        output.putNextEntry(entry);
        output.write(bytes);
        output.closeEntry();
    }
    public static void main(String[] args) throws Exception {
        try (ZipFile resources = new ZipFile(args[0]);
             CountingStream counter = new CountingStream(new FileOutputStream(args[2]));
             ZipOutputStream output = new ZipOutputStream(counter)) {
            Enumeration<? extends ZipEntry> entries = resources.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (!entry.isDirectory()) {
                    try (InputStream input = resources.getInputStream(entry)) {
                        put(output, counter, entry.getName(), input.readAllBytes());
                    }
                }
            }
            put(output, counter, "classes.dex", java.nio.file.Files.readAllBytes(new File(args[1]).toPath()));
        }
    }
}
