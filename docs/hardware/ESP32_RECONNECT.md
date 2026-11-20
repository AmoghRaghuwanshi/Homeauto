# ESP32 restart and reconnect

The lights/sensors firmware starts the saved Wi-Fi connection automatically at
boot. The private `homeauto_config.h` supplies the installed hotspot credentials;
do not commit that file. The Wi-Fi driver reconnects after a lost connection, with
a 30-second fallback retry if the hotspot was unavailable. The firmware does not
erase the saved network or repeatedly restart an in-progress connection every ten
seconds. Wi-Fi power saving is disabled for this controller.

After Wi-Fi obtains an IP address, the board starts network-time synchronization
and retries the authenticated TLS MQTT connection every five seconds. A valid
clock is required for certificate verification. Serial output distinguishes a
missing Wi-Fi connection, waiting for network time, and a broker/TLS failure.
Each successful MQTT connection reports the board online and publishes all four
relay states and fresh sensor data.

For this installation, keep the iPhone hotspot enabled and the laptop connected
to it. Run `Start-HomeAuto-Hardware.bat` after starting Windows. The launcher starts
the private broker even when the dashboard is already running. A dashboard alone
cannot connect the ESP32 if the broker has stopped. If the laptop's hotspot IPv4
changes, update its broker listener/certificate, firewall scope, and the board's
private broker address together before uploading again.

The door module is not part of this change. No relay ON/OFF commands are needed
to verify reconnection: check fresh board-online, relay-status, and gas messages.
The existing relay state restoration on a power reset is preserved.

Verified on the connected lights/sensors ESP32 on 20 November 2026: firmware
compile and flash verification passed; two RTS hardware resets produced fresh
board-online, all four relay-status, and gas reports after 6.6 and 33.2 seconds.
Stopping the private broker while the dashboard remained running, then rerunning
the hardware launcher, restored live gas reports without resetting the ESP32.
No relay commands were sent during these checks. Hotspot-off recovery is handled
by the retry logic but was not physically tested by switching off the hotspot.
