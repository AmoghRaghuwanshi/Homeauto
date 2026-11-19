# Firmware source for the current two-board build

The `.ino` files in this directory are older reference sketches. They do not match the GPIO wiring, keypad, LCD, RFID flash authorization, or relay state recovery in the user's [VidyutRakshak hardware repository](https://github.com/Mishrajishri/home-security-simple/tree/480b51b1d73cbc86ae65b044bc64562ca23386c4/firmware).

Use that hardware repository as the board source after reviewing [the integration and commissioning notes](../docs/verification/VIDYUTRAKSHAK_HARDWARE_INTEGRATION.md). Both linked sketches still need a verified hub address, private Wi-Fi provisioning, board-specific MQTT credentials, CA-validated TLS, and door timing fixes before they can be used with this project's secure broker and a physical lock. No sketch in either repository has been flashed or hardware-tested by this software review.
