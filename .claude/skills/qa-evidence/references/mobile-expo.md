# Playbook: React Native / Expo on an Android emulator

Driving the app through ADB. Everything here was learned by breaking it first —
each trap below silently corrupts evidence or kills the test run, and none of
them announce themselves.

## Setup

```bash
ADB="$ANDROID_HOME/platform-tools/adb"          # Windows: adb.exe — or just `adb` if on PATH
"$ADB" devices                                   # expect: <id>  device
"$ADB" reverse tcp:8081 tcp:8081                 # emulator reaches host Metro
"$ADB" shell wm size                             # note resolution, e.g. 1080x2400
```

Launch the app directly, bypassing Expo Go's cached "Recently opened" entry —
that entry often points at a stale LAN IP and fails with
`java.io.IOException: Failed to download remote update`:

```bash
"$ADB" shell 'am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent'
```

## Trap 1 — never write screenshots inside the project tree

Metro watches the project directory. Every screenshot saved into it triggers a
hot reload, which resets the form **while you are halfway through filling it**.
This will happen repeatedly and look like an app bug.

Capture to a scratch directory outside the repo. Copy the final, chosen images
into the repo **once**, at the end.

## Trap 2 — never use ESCAPE or BACK to dismiss the keyboard

`keyevent 111` (ESCAPE) and `keyevent 4` (BACK) close the modal you are testing,
not the keyboard. This produces "the dialog closed by itself" reports that are
your automation's doing, not the app's.

Dismiss the keyboard by **tapping a neutral area** of the screen — a section
label or header inside the same modal. Most well-built forms wrap content in
`TouchableWithoutFeedback` + `Keyboard.dismiss` for exactly this.

## Trap 3 — don't bulk-send backspaces to clear a field

Sending 30–40 `keyevent 67` in a row overruns the field and starts triggering
navigation, throwing you out of the screen entirely. Clear like this instead:

```bash
"$ADB" shell 'input tap <field_x> <field_y>; sleep 0.4; input keyevent 123'   # 123 = MOVE_END
"$ADB" shell 'input keyevent 67 67 67 67 67 67 67 67 67 67'                    # bounded, batched
```

Count roughly what is in the field and stay under it.

## Trap 4 — get coordinates from the UI tree, not from the screenshot

Scaling a tap coordinate from a downscaled screenshot compounds rounding errors
and you end up tapping the wrong row. Dump the real tree:

```bash
"$ADB" shell uiautomator dump /sdcard/ui.xml
"$ADB" pull /sdcard/ui.xml ./ui.xml
grep -o 'content-desc="Setujui"[^>]*bounds="\[[0-9,]*\]\[[0-9,]*\]"' ui.xml
# bounds="[414,1879][743,2005]"  ->  tap the centre: 578 1942
```

If `uiautomator dump` returns `ERROR: could not get idle state`, the UI is
animating — wait a beat and retry. If it returns `Can't find service: input`,
the emulator's system server has died; restart the emulator.

## Trap 5 — batch ADB calls, don't spawn one process per keystroke

Each `adb shell` invocation costs real time on Windows. A loop of 20 separate
calls can exceed a two-minute tool timeout. Put the whole sequence in one shell
string:

```bash
"$ADB" shell 'input tap 540 1594; sleep 0.6; input text "Demam%stinggi"; sleep 0.5; input tap 180 221'
```

`input text` needs `%s` for spaces. Avoid characters the shell will eat.

## Trap 6 — verify every capture before continuing

After each step, look at the image. A ~10 KB screenshot is almost always the
splash screen, meaning the app reloaded and the step did not happen. Continuing
blindly produces a evidence set that looks complete and documents nothing.

## Screenshot helper

```python
import io, subprocess
from pathlib import Path
from PIL import Image

ADB, WIDTH = r"<path to adb>", 420

def shot(out_dir: Path, case: str, step: str) -> Path:
    raw = subprocess.run([ADB, "exec-out", "screencap", "-p"], capture_output=True).stdout
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{case}-{step}.jpg"
    img.save(path, quality=78, optimize=True)
    return path
```

## Simulating conditions

```bash
# No network (test A11-style cases) — remember to restore afterward
"$ADB" shell svc wifi disable; "$ADB" shell svc data disable
"$ADB" shell svc wifi enable;  "$ADB" shell svc data enable

# GPS, for geofence-gated features. Order is LONGITUDE then LATITUDE
"$ADB" emu geo fix 116.8137 -1.2508

# Screen off / dimmed
"$ADB" shell input keyevent 224          # wake
```

Faking GPS to inside the office radius is often the only way to reach a
location-gated button — and doing so may expose that the client has no idea
about a server-side rule (an approved leave silently blocking check-in).

## Environment health

The dev server and emulator fail in ways that look like app bugs:

| Symptom | Meaning |
|---|---|
| `Can't find service: input` | Emulator system server died — restart the emulator |
| `Expo Go isn't responding` / `System UI isn't responding` | Host is starved; the emulator needs a restart, results are unreliable until then |
| Metro exits with `RangeError: Too many message fragments` | Known RN dev-middleware bug: the inspector WebSocket has no `'error'` handler, so one bad frame kills Metro. Restart it; not an app defect |
| `Failed to download remote update` | Stale Expo Go cache entry — relaunch via the `exp://127.0.0.1:8081` deep link |

Before diagnosing anything as an app bug, confirm Metro is alive:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/status   # expect 200
```

None of these belong in the findings section. They belong in a clearly labelled
"test tooling problems" note, so the reader can tell them apart from real bugs.

## Switching accounts for chained cases

Chained cases need submitter → approver → submitter. Each switch is
logout → login, and login screens are where automation most often goes wrong:

- Password fields may display dots from autofill while the JS state is still
  empty — the app then rejects with "fields required". Type the password
  explicitly rather than trusting what the field appears to show.
- Take the submit button's real bounds from `uiautomator dump`; login layouts
  shift when the keyboard opens.
- After login, confirm the greeting shows the expected user before proceeding.
  Testing three cases as the wrong account wastes the whole run.
