// Open and recheck the exact USB collection before any I/O. No kernel driver is installed.
#include <errno.h>
#include <fcntl.h>
#include <linux/hidraw.h>
#include <stdio.h>
#include <string.h>
#include <sys/ioctl.h>
#include <unistd.h>

static int digit(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return -1;
}

static int unhex(const char *s, unsigned char *out, size_t len) {
    if (strlen(s) != len * 2) return 0;
    for (size_t i = 0; i < len; i++) {
        int hi = digit(s[i * 2]), lo = digit(s[i * 2 + 1]);
        if (hi < 0 || lo < 0) return 0;
        out[i] = (unsigned char)(hi * 16 + lo);
    }
    return 1;
}

static int fail(const char *msg) {
    fprintf(stderr, "%s\n", msg);
    return 1;
}

int main(int argc, char **argv) {
    if (argc < 4 || argc > 5) return fail("Invalid HID bridge arguments");
    int probe = !strcmp(argv[1], "probe"), send = !strcmp(argv[1], "send"), battery = !strcmp(argv[1], "battery");
    if ((!probe && !send && !battery) || argc != (send ? 5 : 4)) return fail("Unsupported HID operation");
    const char *path = argv[2];
    if (strncmp(path, "/dev/hidraw", 11) || !path[11] ||
        strspn(path + 11, "0123456789") != strlen(path + 11)) return fail("Invalid HID device node");
    int fd = open(path, O_RDWR | O_NONBLOCK | O_CLOEXEC | O_NOFOLLOW);
    if (fd < 0) return fail(errno == EACCES || errno == EPERM
        ? "Linux denied receiver access. Run the AppImage with --install-udev-rule, then unplug and reconnect the receiver."
        : "Unable to open the Linux receiver. Reconnect the 2.4 GHz receiver.");
    struct hidraw_devinfo info = {0};
    struct hidraw_report_descriptor desc = {0};
    unsigned char expected[HID_MAX_DESCRIPTOR_SIZE];
    int size = 0;
    if (ioctl(fd, HIDIOCGRAWINFO, &info) < 0 || info.bustype != 3 ||
        info.vendor != 0x24ae || info.product != 0x1870 ||
        ioctl(fd, HIDIOCGRDESCSIZE, &size) < 0 || size < 1 || size > HID_MAX_DESCRIPTOR_SIZE ||
        !unhex(argv[3], expected, (size_t)size)) return fail("Receiver identity changed. Reconnect and scan again.");
    desc.size = (unsigned int)size;
    if (ioctl(fd, HIDIOCGRDESC, &desc) < 0 || desc.size != (unsigned int)size ||
        memcmp(desc.value, expected, (size_t)size)) return fail("Receiver descriptor changed. Reconnect and scan again.");
    if (probe) return 0;
    unsigned char report[32] = {0xba, 0xa5, 0xaa};
    if (send) {
        if (!unhex(argv[4], report, sizeof report) || report[0] != 0xba || report[1] != 0xa5 || report[2] != 0xa5)
            return fail("Invalid configuration report");
        return write(fd, report, sizeof report) == sizeof report ? 0 : fail("Linux receiver output report failed");
    }
    for (int attempt = 0; attempt < 3; attempt++) {
        if (write(fd, report, sizeof report) != sizeof report) return fail("Battery query could not be sent");
        usleep(50000);
        unsigned char reply[32] = {0xba};
        int n = ioctl(fd, HIDIOCGINPUT(sizeof reply), reply);
        if ((n == 4 || n == 32) && reply[0] == 0xba && reply[1] == 1) {
            for (int i = 0; i < n; i++) printf("%02x", (unsigned int)reply[i]);
            puts("");
            return 0;
        }
    }
    return fail("Linux battery read unavailable. Wake the mouse and refresh.");
}
