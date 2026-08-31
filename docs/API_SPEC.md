# BrightLink BL-8X8-HDBT-HD20 — HTTP API Specification

Reverse-engineered specification for the HTTP interface of the BrightLink 8×8 HDMI 2.0 /
HDBaseT matrix switcher (the device also brands itself "8*16 HDMI2.0 Matrix" — 8 inputs,
8 HDMI outputs + 8 HDBT outputs = 16 output ports).

> **Provenance.** This document is a copy of `API_SPEC.md` from
> [ntbutler87/BLMatrixServer](https://github.com/ntbutler87/BLMatrixServer), a device emulator
> for the same matrix. It is vendored here so that anyone contributing to this Companion module
> has the wire format to hand. The file paths it cites as evidence — `public/original.html`,
> `all_dat.get.sample`, `server.js` — live in that repo, not this one. Fix the spec upstream and
> re-copy it here rather than editing the two apart.

**Sources of truth for everything below**

| Evidence | What it settles |
|---|---|
| `public/original.html` — the device's own web UI, captured from a live unit | Command wire format (`APPLY()`), response parsing (`SynRadio()`), and which fields the firmware's own UI trusts |
| `all_dat.get.sample` — a real response captured from a live unit | Segment counts, ordering, and observed field values |
| `server.js` — the emulator in BLMatrixServer | Implements this spec; used to verify the parse rules round-trip |

Anything not directly evidenced by those is marked **unconfirmed**.

---

## 1. Transport

Plain HTTP/1.1 on port 80. **No authentication of any kind** — every endpoint answers any
client that can reach the device. (The web UI's login screen is cosmetic: it downloads the
credential list from `all_dat.get` and compares in JavaScript. See §5.5.)

| Method | Path | Purpose | Response |
|---|---|---|---|
| `GET` | `/all_dat.get<cachebuster>` | Read the entire device state | `text/plain`, one line, 160 `;`-separated segments |
| `POST` | `/video.set` | Send one or more control commands | Empty body, `200` |
| `POST` | `/ip.set` | Network configuration | Empty body, `200` |
| `GET` | `/ip.get` | Network info as executable JavaScript | JS calling `settingsCallback({mac, ip, sub, gw, hdcp})` |
| `GET` | `/` | The device web UI | HTML |

### 1.1 The cache-buster is part of the path, not a query string

The stock UI requests:

```js
xmlHttp.open('GET', 'all_dat.get' + new Date().getTime(), true);
```

producing `GET /all_dat.get1712345678901` — **no `?`**. The firmware prefix-matches the path.
A bare `GET /all_dat.get` also works. Any emulator or proxy must match the path as a prefix
(this repo routes `/all_dat.get*`).

### 1.2 Polling model

The stock UI polls once per second and re-renders **only when the full response text differs
from the previous one**:

```js
if (o != window.myold && index != -1) { …parse… ; window.myold = o; }
setTimeout('httpGetDate()', 1000);
```

There is no push, no long-poll, and no event stream. Twelve consecutive failed polls make the
stock UI reload the page.

### 1.3 Commands are fire-and-forget

`POST /video.set` returns an empty `200` whether the command was understood, malformed, or
out of range. **There is no acknowledgement and no error channel.** To confirm any change,
re-read `all_dat.get` and compare. Content-Type is ignored by the device (the stock UI sends
XHR's default `text/plain;charset=UTF-8`).

---

## 2. Control commands (`POST /video.set`)

### 2.1 Framing

A request body is one or more commands, **each introduced by `#`**, concatenated with no
other separator:

```
#video_d out1 matrix=3#video_d out2 matrix=3#video_d out7 matrix=8
```

* Fields within a command are separated by **single spaces**.
* Arguments are `key=value`, except the leading command token and its target.
* The leading `#` on the first command is conventional; parsers should tolerate its absence.
* Values are decimal, 1-based, and never zero-padded (`out8`, not `out08`).
* Port names are the only free-text values — they may contain spaces (§2.6).

### 2.2 Command token grammar

```
<group>_<op>   e.g. video_d, audio_d, edid_d
```

The **last character of the token is the operation**:

| Suffix | Meaning | Seen in stock UI |
|---|---|---|
| `d` | data — set/change a value | Yes, everywhere |
| `l` | lock | No — inferred from firmware parsing |
| `s` | save | No — inferred from firmware parsing |

Only `_d` is exercised by the stock UI; `l` and `s` are **unconfirmed**.
`group<N>`, `port`, `register<N>`, and `ip` do not follow the suffix convention.

### 2.3 Command reference

| Command | Range | Effect |
|---|---|---|
| `video_d out<N> matrix=<M>` | N,M = 1–8 | Route input M to output N. **HDMI output N and HDBT output N always switch together** — they are one logical output. |
| `audio_d in<N> enc=<E>` | N = 1–8, E = 0/1/2 | Audio source for input N: `0` = mute, `1` = HDMI embedded, `2` = analog. |
| `audio_d out<N> iis=<A> spdif=<S>` | N = 1–8, A,S = 0/1 | Audio output enables for output N. `iis` is the analog/I²S output; `spdif` is the coax/optical output. The stock UI **always sends both flags together**, in this order. |
| `edid_d in<N> mode=<M> data=<D>` | N = 1–8, M = 0–3, D = 1–8 | Assign an EDID to input N. See §2.4. |
| `edid_d user<N> mode=<M> data=<D>` | N = 1–8, M = 2 or 3, D = 1–8 | Copy the EDID read from HDMI output D (`mode=2`) or HDBT output D (`mode=3`) into user EDID slot N. |
| `group<N> exe=<E>` | N = 1–8, E = 0/1/2 | Scene: `1` = save current routing into scene N, `2` = recall scene N, `0` = clear scene N (**unconfirmed** — the stock UI never sends `exe=0`). |
| `port in<N> name=<text>` | N = 1–8 | Rename input N. |
| `port hdmi<N> name=<text>` | N = 1–8 | Rename HDMI output N. |
| `port hdbt<N> name=<text>` | N = 1–8 | Rename HDBT output N. |
| `register<N> id=<user> psd=<pass>` | **N = 0–4** | Set credentials for user slot N. Note this index is **0-based**, unlike every other index in the API. |
| `ip dhcp=<0\|1>` | — | Sent to **`/ip.set`**, not `/video.set`. `dhcp=1` enables DHCP. |

Not observed being sent by the stock UI, but accepted by the firmware's dispatcher
(all **unconfirmed**): `lcd`, `power`, `system`, `factory`.

### 2.4 EDID modes

`mode` selects which table `data` indexes into:

| mode | Table | Response block | Meaning |
|---|---|---|---|
| `0` | Default | `ded1`–`ded8` | Built-in preset EDIDs |
| `1` | User | `ued1`–`ued8` | User-defined EDIDs |
| `2` | HDMI | `oed_hdim1`–`oed_hdim8` | Copy the EDID of the display on HDMI output *data* |
| `3` | HDBT | `oed_hdbt1`–`oed_hdbt8` | Copy the EDID of the display on HDBT output *data* |

`data` is **1-based**. The current assignment for each input is reported back in the `E:` field
(§3.2), and the resulting EDID string in `ied<N>` (§3.3).

### 2.5 Network configuration (`POST /ip.set`)

Two shapes are used by the stock UI:

* Command text, as a DHCP toggle: `#ip dhcp=0` / `#ip dhcp=1`
* A conventional HTML form POST (urlencoded) with fields `mac`, `DHCP`, `check`, `ip`, `sub`, `gw`

A commented-out line in the firmware UI suggests the command form also accepts the full set:
`#ip dhcp=0 ip=<addr> mask=<mask> gw=<addr>` — **unconfirmed**, it is not the path the shipped
UI takes.

### 2.6 Name values

* Names may contain **spaces** — `#port hdmi2 name=Side Stage TV` is one command with a
  three-word value. A parser that splits the whole command on spaces and reads only the token
  after `name=` will silently truncate to the first word.
* Names must not contain `;`, `:`, or `#` — those are response and command delimiters, and the
  response format has no escaping.
* The stock UI limits entry to **12 characters**, but the firmware stores more: a live unit was
  observed holding `Presentation PC 1` (17). The true limit is **unconfirmed**.
* Non-ASCII is not supported.

### 2.7 Batching

Every stock UI "Apply" button batches: it walks its widgets, appends `#…` for each change, and
sends one POST. Batches of 8–24 commands are routine (the audio page always sends all 24).
There is no observed size limit.

---

## 3. State response (`GET /all_dat.get`)

One line of ASCII. **Exactly 160 `;`-separated segments, with no trailing separator.**
Segment position is fixed — the stock UI slices by index, not by key:

```js
var sw_info     = o.split(";").slice(0, 48);     // switch + audio state
    edid_info   = o.split(";").slice(48, 88);    // 5 × 8 EDID entries
var port_name   = o.split(";").slice(88, 112);   // 3 × 8 port names
var source_name = o.split(";").slice(112, 120);  // scene names
var login_info  = o.split(";").slice(120, 136);  // 8 × (user, pass)
var input_info  = o.split(";").slice(136, 144);  // input port status
var hdmi_info   = o.split(";").slice(144, 152);  // HDMI output status
var hdbt_info   = o.split(";").slice(152, 160);  // HDBT output status
```

### 3.1 Segment map

| Segments | Block | Contents |
|---|---|---|
| 0–47 | Switch & audio | 8 groups of 6: `VO:`, `E:`, `AI:`, `AO:…HDMI`, `AO:…iis`, `AO:…spdif` |
| 48–55 | `ded1`–`ded8` | Default EDID presets |
| 56–63 | `ued1`–`ued8` | User EDID slots |
| 64–71 | `ied1`–`ied8` | EDID currently presented on each **input** |
| 72–79 | `oed_hdim1`–`oed_hdim8` | EDID read from each **HDMI output**'s display |
| 80–87 | `oed_hdbt1`–`oed_hdbt8` | EDID read from each **HDBT output**'s display |
| 88–95 | `port_i1`–`port_i8` | Input names |
| 96–103 | `port_ohdmi1`–`port_ohdmi8` | HDMI output names |
| 104–111 | `port_ohdbt1`–`port_ohdbt8` | HDBT output names |
| 112–119 | `grp1`–`grp8` | Scene names |
| 120–135 | `lod1`–`lod8` | Credentials — two segments per user (§3.6) |
| 136–143 | `INPORT:` | Input port status (§3.7) |
| 144–151 | `OUTHDMIPORT:` | HDMI output port status (§3.7) |
| 152–159 | `OUTHDBTPORT:` | HDBT output port status (§3.7) |

Parsing by key (regex per segment) is safer than slicing by index and produces the same result
for every field except the three status blocks, whose ports 2–8 carry no key (§3.7).

### 3.2 Switch & audio block (segments 0–47)

Six segments repeat for each index *i* = 1…8. **The index means different things in different
fields in the same group** — this is the single most misleading part of the format:

| Field | Index refers to | Meaning |
|---|---|---|
| `VO:<o>IN:<i>` | **output** *o* | Output *o* is currently sourcing input *i*. Applies to HDMI output *o* and HDBT output *o* alike. |
| `E:<n>M:<mode>D:<slot>` | **input** *n* | Input *n*'s EDID assignment: `mode` 0–3 per §2.4, `slot` 1–8 within that table. |
| `AI:<n>M:<m>` | **input** *n* | Audio source for input *n*: `0` mute, `1` HDMI embedded, `2` analog. |
| `AO:<o>HDMI:<v>` | **output** *o* | HDMI audio-out flag. The stock UI parses this segment and then **discards it** — it drives no widget. Purpose **unconfirmed**. |
| `AO:<o>iis:<v>` | **output** *o* | Analog/I²S audio out enabled (`0`/`1`). |
| `AO:<o>spdif:<v>` | **output** *o* | S/PDIF audio out enabled (`0`/`1`). |

Parsing note: `"VO:1IN:3".split(":")` yields `["VO", "1IN", "3"]`; the firmware UI relies on
`parseInt("1IN", 10) === 1`. A regex (`/^VO:(\d+)IN:(\d+)$/`) is clearer and equivalent.

`VO:` is the **only** routing source of truth. There is no separate HDMI/HDBT routing field,
because there is no separate HDMI/HDBT routing.

### 3.3 EDID blocks (48–87)

All five are human-readable capability summaries, not raw EDID bytes, e.g.
`3840x2160P60 444 DbV DTS5.1` = resolution/refresh, chroma subsampling, Dolby Vision,
audio format.

* `ded1`–`ded8` — fixed built-in presets. Observed identical across units.
* `ued1`–`ued8` — user slots, writable via `edid_d user<N> …`.
* `ied1`–`ied8` — the EDID input *N* is **currently presenting to its source**. This is a
  derived value: it resolves `E:<n>M:…D:…` through the table that mode selects.
* `oed_hdim1`–`oed_hdim8` — EDID read back from the display on each HDMI output.
* `oed_hdbt1`–`oed_hdbt8` — the same for HDBT outputs.
* **`oed_hdim` is misspelled in the firmware** (`hdim`, not `hdmi`). Match it exactly.
* **`Unplug` in an `oed_*` field means no display is attached to that output port.** This is a
  second, independent connection indicator — see §4.

### 3.4 Port names (88–111)

`port_i<N>`, `port_ohdmi<N>`, `port_ohdbt<N>`. HDMI output *N* and HDBT output *N* have
**separate names** even though they switch as one. The stock UI shows them joined with `&`
(e.g. `Projector&ProjMirror`) on the video page.

Empty names are possible; a name is everything after the first `:` to the next `;`.

### 3.5 Scene names (112–119)

`grp1`–`grp8`. The stock UI displays these as tooltips only, and provides no way to rename a
scene — no rename command for scenes was observed. **Unconfirmed** whether one exists.

### 3.6 Credentials (120–135)

**Two consecutive segments share the same key**, username first, then password:

```
lod1:admin;lod1:123456;lod2:admin1;lod2:123456;…lod8:;lod8:;
```

Eight slots, of which the stock UI only ever uses the first five. Empty slots are `lodN:;lodN:;`.

A key-based parser building a map will silently lose the username to the password. Read them
positionally: even offset = username, odd offset = password.

> **Security note.** Every username and password on the device is served in plaintext to any
> unauthenticated client that can `GET /all_dat.get`. The login screen is enforced entirely in
> browser JavaScript against this list. Treat this device as having **no access control**: it
> should sit on a management VLAN, not on a network any untrusted client can reach, and its
> credentials should never be reused anywhere else.

### 3.7 Port status blocks (136–159)

Three blocks of 8 ports. Each port is a comma-separated list of `key=value` pairs;
**ports are separated by `;` like every other segment**, so a block occupies 8 segments and
only the *first* carries the block label:

```
INPORT:pw5v=1,sig=1,rat=0,col=0,hdcp=0,bit=1;pw5v=1,sig=1,…;…(6 more)…
OUTHDMIPORT:hpd=1,sig=0,rat=0,col=0,hdcp=0,bit=0;hpd=0,…
OUTHDBTPORT:hpd=1,sig=0,rat=0,col=0,hdcp=0,bit=0;hpd=1,…
```

Consequence: you cannot find port 4's status by looking for a key. Locate the block label,
then take the following 8 `;`-separated segments in order. §5.1 has a parser.

**Input fields (`INPORT`)**

| Field | Meaning | Confidence |
|---|---|---|
| `pw5v` | +5 V rail present on the port | Certain (name); **useless as a connection test** — see §4 |
| `sig` | Valid video signal detected from the source | **Certain** — this is the field the stock UI uses |
| `rat` | Aspect/rate class of the incoming signal | Unconfirmed |
| `col` | Colour space / colour depth class | Unconfirmed |
| `hdcp` | HDCP state of the incoming stream | Unconfirmed |
| `bit` | Bit-depth or "data valid" flag | Unconfirmed; tracks `sig` in all observed samples |

**Output fields (`OUTHDMIPORT`, `OUTHDBTPORT`)**

| Field | Meaning | Confidence |
|---|---|---|
| `hpd` | **Hot-plug detect — a display is attached** | **Certain** — this is the field the stock UI uses |
| `sig` | Output actively transmitting a signal | Likely; **not** a proxy for "connected" — see §4 |
| `rat`, `col`, `bit` | As above | Unconfirmed |
| `hdcp` | HDCP state. Observed as `2` on every port with `hpd=0`, `0` on ports with `hpd=1` | Partially confirmed: `2` co-occurs with "no sink" |

The stock UI reads exactly two of these fields — input `sig` and output `hpd` — and ignores
`rat`, `col`, `hdcp`, and `bit` entirely.

---

## 4. Detecting what is actually plugged in

This is the part that is easiest to get wrong, and getting it wrong produces exactly one
symptom: **a UI that reports nothing is connected while pictures are visibly on screen.**

### 4.1 Inputs — use `sig`, never `pw5v`

The stock UI highlights an input when `sig == 1`:

```js
// input_info[i].split(",")[1] is "sig=1"; it tests the last character
var str = input_info_str[i].substr(input_info_str[i].length - 1, 1);
if (str == 1) { /* highlight port as live */ }
```

In the captured sample, **`pw5v` reads `1` on all eight inputs**, including ports named
`Unused` with nothing plugged into them, while `sig` reads `1` on exactly the three ports with
a live source:

| Input | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| `pw5v` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| `sig` | **1** | **1** | 0 | 0 | 0 | 0 | 0 | **1** |
| Port name | Presentation PC 1 | Presentation PC 2 | Audio PC | HDMI4 Cable | Unused | Unused | Unused | Live Stream |

> `sig == 1` → a source is connected and sending video.
> `pw5v` says only that the port's 5 V rail is up. On this hardware it is always `1`.

### 4.2 Outputs — use `hpd`, never `sig`

The stock UI highlights an output when **either** the HDMI **or** the HDBT half asserts `hpd`:

```js
// hdmi_info[i].split(",")[0] is "hpd=1"; likewise hdbt_info
if (str1 == 1 || str2 == 1) { /* highlight output as connected */ }
```

On the EDID page, where the HDMI and HDBT halves are shown separately, each is tested against
its own `hpd`.

**Output `sig` is `0` on ports that are working normally.** In the captured sample, five HDBT
outputs are driving displays; only four of them report `sig=1`, and *every* HDMI output but
one reports `sig=0` despite two having displays attached:

| Output | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| HDMI `hpd` | **1** | 0 | 0 | 0 | 0 | **1** | **1** | 0 |
| HDMI `sig` | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| HDMI `oed_hdim` | Unplug | Unplug | Unplug | Unplug | Unplug | *EDID* | *EDID* | Unplug |
| HDBT `hpd` | **1** | **1** | **1** | **1** | **1** | 0 | 0 | 0 |
| HDBT `sig` | 0 | 1 | 1 | 1 | 1 | 0 | 0 | 0 |
| HDBT `oed_hdbt` | *EDID* | *EDID* | *EDID* | *EDID* | *EDID* | Unplug | Unplug | Unplug |

Reading `sig` as "connected" would report 5 of 16 output ports live when 8 actually are.
That is the bug behind "the app says nothing is connected but the projector is showing fine".

### 4.3 Recommended test

```
output N has a display  ⟺  hpd == 1  OR  oed_* != "Unplug"
```

`hpd` and the `oed_*` EDID readback are independent signals and agree on 15 of 16 ports in the
sample. The exception is HDMI output 1 (`hpd=1` but `oed_hdim1:Unplug`), consistent with a
cable present whose EDID could not be read — a state worth surfacing differently from
"nothing connected" if the UI has room for it.

For a per-logical-output indicator (the way the stock video page shows it), OR the HDMI and
HDBT halves. For diagnostics, show them separately: the two halves of one output genuinely
differ, and that difference is usually what a technician needs to see.

---

## 5. Parsing recipes

### 5.1 Port status blocks

```js
// Ports 2-8 carry no key, so the block must be read positionally from the raw string.
function parsePortBlock(raw, key) {          // key: 'INPORT' | 'OUTHDMIPORT' | 'OUTHDBTPORT'
    const at = raw.indexOf(key + ':');
    if (at === -1) return {};
    const ports = {};
    raw.slice(at + key.length + 1).split(';').slice(0, 8).forEach((seg, i) => {
        const fields = {};
        for (const pair of seg.split(',')) {
            const [k, v] = pair.split('=');
            if (k) fields[k.trim()] = parseInt(v, 10);
        }
        ports[i + 1] = fields;               // 1-based port number
    });
    return ports;
}
```

### 5.2 Everything else

Split on `;` and match each segment by key:

```js
/^VO:(\d+)IN:(\d+)$/          // routing:      [output, input]
/^E:(\d+)M:(\d+)D:(\d+)$/     // input EDID:   [input, mode, slot]
/^AI:(\d+)M:(\d+)$/           // input audio:  [input, mode]
/^AO:(\d+)(HDMI|iis|spdif):(\d+)$/
/^port_i(\d+):(.*)$/          // input name
/^port_ohdmi(\d+):(.*)$/      // HDMI output name
/^port_ohdbt(\d+):(.*)$/      // HDBT output name
/^grp(\d+):(.*)$/             // scene name
/^oed_hdim(\d+):(.*)$/        // HDMI sink EDID — note the firmware's misspelling
/^oed_hdbt(\d+):(.*)$/        // HDBT sink EDID
```

Use `(.*)`, not `(.+)`, for name and EDID fields: empty values occur.

### 5.3 Change detection

Compare the whole raw response string against the previous one before re-parsing, as the stock
UI does. A 1 Hz poll of a 3.3 KB string is cheap; re-rendering on every poll is not.

---

## 6. Gotchas checklist

1. **`oed_hdim`** is misspelled in the firmware. Preserve it exactly.
2. **Status blocks are positional** — only the first of 8 ports carries the block label (§3.7).
3. **`lod<N>` appears twice per user** — username then password (§3.6).
4. **Response has no trailing `;`** — it splits into exactly 160 segments, not 161.
5. **The cache-buster is glued to the path**, with no `?` (§1.1).
6. **Index meaning changes within a group** — `VO:`/`AO:` are output-indexed, `E:`/`AI:` are
   input-indexed, in the same repeating six segments (§3.2).
7. **HDMI and HDBT outputs switch as one** but have separate names, separate EDIDs, and
   separate connection status.
8. **`register<N>` is 0-based**; every other index in the API is 1-based.
9. **Port names may contain spaces** — don't split the command on whitespace and read one token.
10. **Commands are never acknowledged** — poll to confirm.
11. **`pw5v` (inputs) and `sig` (outputs) are the wrong connection fields** — §4.
12. **No authentication anywhere**, and credentials are in the state response in plaintext (§3.6).

---

## 7. Reading the stock UI's source (`public/original.html`)

The element IDs in the firmware's own web page invert what they name, which is the main reason
this API is easy to misread. When cross-checking against that file:

| DOM id | Actually is | Driven by |
|---|---|---|
| `VO11`–`VO32` | Outputs 1–8 (a 3-wide grid; `VO33` is "All") | `VO:` |
| `VI11`–`VI32` | Inputs 1–8 | — |
| `CI1`–`CI8` | Inputs 1–8, EDID page | `E:`, `ied<N>` |
| `CO1`–`CO8` | HDMI outputs 1–8, EDID page | `oed_hdim<N>` |
| `CO9`–`CO16` | HDBT outputs 1–8, EDID page | `oed_hdbt<N>` |
| `DO1`–`DO8` | Default EDID presets 1–8 | `ded<N>` |
| `DO9`–`DO16` | User EDID slots 1–8 | `ued<N>` |
| **`AO111`–`AO322`** | **Audio *inputs*** 1–8 (buttons `H` = HDMI, `A` = analog) | `AI:` |
| **`AI111`–`AI322`** | **Audio *outputs*** 1–8 (buttons `A` = analog/I²S, `S` = S/PDIF) | `AO:` |
| `AIN1`–`AIN8` | Audio input fieldsets | `AI:` |
| `AON1`–`AON8` | Audio output fieldsets | `AO:` |
| `S1`–`S8` | Scenes 1–8 | `grp<N>` |

The `AO`/`AI` inversion is in the DOM ids only. **The wire format is consistent**: `AI:` is
audio input, `AO:` is audio output.

Other landmarks in that file: `SynRadio()` (line ~1326) parses the state string; `APPLY()`
(line ~947) builds every command; `senda()` (line ~2451) posts them; `httpGetDate()`
(line ~2432) is the poll loop.

---

## 8. Emulator conformance (`server.js`)

The emulator in [BLMatrixServer](https://github.com/ntbutler87/BLMatrixServer) implements the
above, and is a useful stand-in for a real matrix when developing this module. Known deliberate
gaps:

| Area | Status |
|---|---|
| `video_d`, `audio_d`, `edid_d`, `group`, `port`, `register` | Implemented |
| `group<N> exe=0` (clear scene) | Accepted, no-op — real behaviour unconfirmed |
| `_l` (lock) and `_s` (save) operations | Accepted, no-op |
| `lcd`, `power`, `system`, `factory` | Accepted, no-op |
| `GET /ip.get` | Returns an empty body; the real device returns JavaScript calling `settingsCallback(...)`, so the stock UI's Network tab stays blank against the emulator |
| `POST /ip.set` | Not implemented |
| Port status (`pw5v`, `sig`, `hpd`, …) | Stored and reported, but static — the emulator has no simulated cable events |
