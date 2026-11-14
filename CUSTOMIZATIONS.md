# Custom sports fork

## Attribution

Original project: [Knikt/APL-TV](https://github.com/Knikt/APL-TV), created by **Knikt (Gero Corp.)** and its contributors. The original MIT license and copyright are unchanged. This fork adds sports support and release automation; it does not claim authorship of the original app. ESPN data, third-party logos and names belong to their respective owners.

## Changes

- UFC: all two-fighter bouts supplied by ESPN, with fighter names, event names, status and venue. Bouts use distinct IDs while summary requests retain the original event ID.
- UFC has highest priority in the featured banner, a dedicated first sports row, and live listings. The selected day, sport filter and result visibility still apply; it does not replace today's schedule with distant events.
- Sri Lanka senior national cricket teams: ESPN's series directory discovers bilateral tours, World Cups, Champions Trophy, Asia Cup and the World Test Championship. Only international Test, ODI and T20I class IDs and exact senior Sri Lanka team names are retained. A teams, youth, academy and domestic cricket are excluded.
- Live multi-day Tests remain in today's list after the first day. Cricket score text is retained.
- Existing explicit favorites receive UFC and Sri Lanka cricket once. Existing sports, leagues, teams and match types remain intact. Later edits are respected. A skipped setup keeps its broad default behavior.
- Android package `com.siddeekazeez.apltv`, named APL TV Sports, avoids uninstalling the official app or losing its data. The custom app's later APKs share one private signing key.
- The web updater points to this fork, so it cannot silently replace custom code with unmodified upstream code.

## Phone setup fix

The custom Android helper uses port **8766**, separate from the official app's 8765. The web app reads the port from its native Android host, including phone QR links, playlist submissions, playlist editing, guide access and embedded video summaries. Older Android hosts and other platforms retain 8765. After installing this fix, rescan the TV's current QR code rather than reusing an old phone page.

## Updates

The Custom Android release workflow runs daily at 03:23 UTC and can be run manually from Actions. It merges the latest official release tag into the fork, regenerates manifests, runs upstream checks and sports regression tests, builds and verifies the signed APK, then publishes merged source and a GitHub Release. Unchanged source is not rebuilt on the daily check. Manual runs can rebuild.

Source conflicts stop the workflow for manual review; it never guesses how to resolve custom sports code. Only generated build/version manifests are regenerated automatically. Failed merges, tests or builds do not publish a new release. GitHub may disable schedules in inactive forks after 60 days: re-enable the workflow in Actions if needed.

Install the newest APK from this fork's Releases to update the custom Android app. The stable asset is `apl-tv-sports-android.apk`. Each build increments Android's version code. Do not install the original APK over the custom app expecting its settings to transfer: they are separate applications.

Signing uses repository Actions secrets `ANDROID_KEYSTORE_B64` and `ANDROID_KEYSTORE_PASS`; neither key nor password is in Git. Keep an offline backup: losing the key prevents in-place APK updates. Never regenerate it for routine updates.

## Validation

```
python3 tools/check.py
node tools/test-custom-sports.cjs
```

The tests cover existing-favorite retention, one-time migration, all UFC bouts, fighter identity, Sri Lanka filtering, international classes, winner flags, live multi-day Test visibility, series discovery, source summary IDs and UFC priority. `SPORTS_FIXTURE_DIR` optionally runs the adapters against separately downloaded `ufc.json` and `sri-lanka.json` ESPN responses.

## Limits

ESPN's public endpoints are not a contracted API. Listings depend on its published schedules, series directory and availability; a source outage or schema change may need maintenance. Exact bout start times can be estimates shared across an event. Not every international tournament may appear in the directory. Women's fixtures still follow the existing match-type selections. Cricket and MMA-specific scorecards are limited by the original generic match-detail UI. This fork adds schedule discovery, not broadcast rights or streams: playback still requires a configured provider carrying the event.

The separate Android package does not use the official app's hard-coded APL Launcher Continue Watching provider authority. Other original player functionality is retained; no custom Samsung or LG packages are published.
