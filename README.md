## Brightlink BL-8X8-HDBT-HD20 Module

Bitfocus Companion module for network control of the BrightLink [BL-8X8-HDBT-HD20 HDMI Matrix](https://brightlinkav.com/products/brightlink-pro-series-hdmi-2-0-8x8-8x16-8x24-hdmi-hdbaset-matrix-with-4kx2k-60hz-hdr-yuv-4-4-4-18gbps-hdcp-1-4-2-2-app-control-distance-upto-70m-228ft-away-c-w-8-hdbaset-receivers-with-2ea-hdmi-outputs-and-poc-poe): 8 HDMI inputs to 8 HDMI outputs plus 8 HDBaseT outputs.

See [HELP.md](./companion/HELP.md) for the full action, feedback and variable reference, and [LICENSE](./LICENSE).

### Features

* Video routing — single path, all-outputs-at-once, and a two-step X/Y panel
* Scene save, recall and clear, using the scene names stored on the device
* Audio — input source select, output analog/I²S and S/PDIF enables
* EDID — assign to inputs from presets, user slots, or a connected display; copy a display's EDID into a user slot
* Port renaming
* Signal-presence feedbacks for inputs and outputs, using the fields the hardware actually reports reliably
* Variables for routing, port names, scene names and connection state

### Protocol

The device speaks plain HTTP: `POST /video.set` for commands, `GET /all_dat.get` for a 160-segment state string. It never reports changes on its own and never acknowledges a command, so the module polls (default 2000ms) and re-polls after every command.

The wire format is documented in [BLMatrixServer](https://github.com/ntbutler87/BLMatrixServer), which also provides a device emulator for testing without hardware. [matrix.js](./matrix.js) implements the parser against that spec.

> **Security.** The matrix has no working access control — it serves all stored credentials in plaintext to any client that can reach it, and its login page is enforced only in the browser. Keep it on a management VLAN.

### TODO

- [ ] Network configuration (`/ip.set` DHCP toggle)
- [ ] Verify the undocumented `lcd`, `power`, `system` and `factory` commands
- [ ] User credential management (`register<N>`)
