# Snake Squad — installable web app

The participant-facing build of the study. Same experiment as the SwiftUI
prototype in [`../SnakeSquad`](../SnakeSquad), rebuilt as a **PWA** so it can be
hosted on GitHub Pages and installed from a URL — no Apple Developer account, no
Xcode, no TestFlight, no App Review. Design rationale, measures and ethics notes
are in [`../SPEC.md`](../SPEC.md).

Plain ES modules. No build step, no dependencies, no bundler: what's in this
folder is what runs.

## Deploying

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Deploy from a branch**, pick the
   branch and set the folder to `/web` (or move these files to the repo root).
3. The app is served at `https://<user>.github.io/<repo>/`.
   Send participants **`.../install.html`** — that's the Add-to-Home-Screen page.

Every path in the app is relative, so it works from a project subpath without
configuration. HTTPS comes free with Pages and is required: geolocation, the
service worker, and `crypto.subtle` all need a secure context.

The stimulus privacy policy is public on a Pages site, so `index.html` and
`install.html` both carry `<meta name="robots" content="noindex, nofollow">`.
Consider an unguessable repo name too.

## Running a session

1. **Install first.** Open `install.html` in **Safari** on the participant's
   iPhone → Share → *Add to Home Screen* → *Add*. Launch it from the home-screen
   icon, not from Safari — that's what gives the fullscreen, no-browser-chrome
   presentation the study's framing depends on.
2. The participant taps **Play**.
3. **Consent screen** — the researcher enters the participant code (e.g.
   `P-1042`), the participant agrees.
4. The participant plays through unassisted: terms/privacy (disclosure 1) →
   player-profile survey → level 1 → squad invite (disclosure 2) → level 2 →
   location ask (disclosure 3) → levels 3–5 → debrief (with withdraw option).
5. **Export / reset:** triple-tap the top-right corner of any screen (or the
   version label on the title/finish screens), enter the researcher passcode,
   then **Export CSV** (opens the iOS share sheet → AirDrop / Files / Mail; a
   raw-JSON backup and a copy-to-clipboard fallback are also there) and
   **Reset for next participant**.

An interrupted session resumes at the same stage when the app is reopened.

### Before running participants — check `js/config.js`

Two settings live there, and both matter:

| Setting | Default | What to do |
|---|---|---|
| `RESEARCHER_PASSCODE` | `'2468'` | Change it. |
| `TESTING_TOOLS` | `true` | **Set to `false`.** |

`TESTING_TOOLS` shows a dashed **↺ Restart** pill in the top-left corner that
wipes the session and returns to the title screen in one tap — no passcode, no
confirmation. It exists to make repeated test runs quick. A participant who taps
it destroys their own data, and it is not part of the stimulus, so it must be off
for real sessions. The researcher panel's **Reset for next participant** does the
same job safely.

### Between participants — important

Browser permissions and storage are per **origin**, not per install, so a
second participant on the same icon would find location already decided and
never see the system dialog. Between participants either:

- **Delete the home-screen icon and re-add it** (clears that web app's storage
  and permissions — the clean option, and what we recommend), or
- use **Reset for next participant**, and accept that the location dialog will
  not reappear. The app logs `location_permission_prior` on every run precisely
  so these sessions are identifiable in the data rather than silently wrong.

## What gets logged

Identical to the iOS build. Primary export is a **wide-format CSV**: one row per
event, fixed columns (`participant`, `device_uuid`, `app_version`, `timestamp`,
`event`) plus one column per payload key; multi-answer values joined with `"; "`.
A raw JSON export of the same stream is available as a backup.

| Event | Payload highlights |
|---|---|
| `policy_opened` / `policy_closed` | `dwell_s`, `max_scroll_pct` |
| `third_party_consent` | `value` (bool), `toggle_flips` |
| `terms_accepted` | `policy_open_count`, `screen_dwell_s` |
| `survey_item` | `id` (F1–F7, S2, S9–S12, D1–D2), `value` (1–5, label, or array) |
| `contacts_prompt` | `action` (submitted/skipped), `n_friends`, `fields`, `valid_email`, `valid_phone`, `hashes`, `dwell_s` |
| `location_permission_prior` | `value` (prompt / granted / denied / unknown) |
| `location_softask` | `value` (accepted/declined), `latency_s` |
| `location_system_dialog` | `value` (granted / denied / timeout / position_unavailable / unavailable) |
| `level_start` / `level_end` | level, attempt, outcome, reason, detail, scores, duration |
| `consent_given`, `debrief_acknowledged`, `stage_advance`, … | flow bookkeeping |

**Friends' email addresses and phone numbers are never stored** — only
field-completion flags, syntactic validity, and salted SHA-256 hashes
(per-install salt, truncated to 16 hex chars, for duplicate detection). Entered
friend *names* are retained for one purpose: bot teammates are named after the
invited friends, so those first names appear in the squad assignment and in
exports — flag this to your IRB. If a participant withdraws at the debrief, the
log is deleted on the spot.

## How this build differs from the iOS one

Everything below is a platform difference, not a design change. See the note in
`js/screens/location.js` and §7.3 of the spec.

- **Location.** Native iOS can ask for *authorization* without asking for a
  position. The web has no equivalent: the only way to raise the genuine system
  dialog is `getCurrentPosition()`, whose success callback is handed a position.
  The app calls it exactly once, its success handler **takes no parameter**, and
  no coordinate, accuracy or timestamp is ever read or stored — only the
  decision. Verify with `grep -rn geolocation js/` (one call site). The system
  dialog also names the site rather than showing a custom purpose string, so the
  wording differs from the Info.plist version.
- **Export** goes through the Web Share API rather than a `ShareLink`; same
  destination (AirDrop / Files / Mail), with download and clipboard fallbacks.
- **Storage** is `localStorage` rather than a file in Documents. Home-screen web
  apps are exempt from Safari's 7-day storage eviction, but deleting the icon
  deletes the data — export before removing it.
- **No network requests are made.** The service worker's `fetch` handler only
  serves this app's own files for offline use; nothing is ever uploaded.

## Tests

```
node test/engine-test.mjs
```

Shims enough of the browser to import the real engine, then drives the
simulation on a manual clock: collisions, growth, scoring and bonuses, the
countdown, food spawning, and 30-trial AI survival runs per co-op level.

The survival runs put the player under the bot AI too, so they measure the
collision-avoidance logic rather than an unsteered snake. Current rates of
*bot-caused* squad wipes: **L2 ~3%, L3 ~10%, L4 ~23%, L5 ~23–43%.** SPEC §5.3
wants bots to "rarely crash"; L4 and L5 are worth a tuning decision before
running participants. The cause is visible in `chooseBotDirections` in
`js/game/engine.js`: bots treat every snake's tail as blocked even though it
vacates on the same tick, so they box themselves in as the snakes grow. This
behaviour is a faithful port of `BotAI.swift` — it is not a regression — so
changing it is a study-design call, not a bug fix.
