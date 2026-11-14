# Custom sports integration

## Attribution

Original player, interface and platform support: **[Knikt (Gero Corp.) and APL TV contributors](https://github.com/Knikt/APL-TV)**. Original copyright and MIT license are retained. This is an independent fork, not an official Knikt release. ESPN and TheSportsDB data, artwork and third-party names belong to their respective owners.

## MMA

- MMA is the sport; UFC and PFL are selectable promotions. Only verified feeds are offered.
- UFC can be filtered to all events, numbered events, or Fight Nights.
- The sports list has one tile per event. Opening it shows the full card. Selecting a bout opens its details and the original player/channel selection flow.
- Main-card/prelim section labels are used only if supplied by the data source; otherwise all bouts appear under Fight Card. No section membership is guessed.
- Bout artwork is used when available, falling back to the event artwork. ESPN images take precedence; TheSportsDB lookups match dates and event numbers or both fighters. Missing artwork uses a neutral branded tile. Lookups are queued below the free API rate limit and cached on the TV.
- Event and bout IDs are separate; summary requests retain their source event and promotion. Live state is aggregated from bouts.

## Cricket

- Cricket national teams appear in the National Teams step. Follow a country for senior Test, ODI and T20I matches; men's/women's match settings still apply.
- Clubs are franchise teams under IPL, BBL, PSL, CPL, SA20, ILT20 and LPL. Teams/logos come from ESPN season data, with previous-season fallback when a new roster is unpublished.
- International series are discovered from ESPN's directory for the selected countries and major international tournaments. Youth, academy and unofficial A-team fixtures are excluded.
- Live multi-day Tests remain visible after their first day. Cricket's score strings and results are retained.
- The old Sri Lanka-only competition is migrated to International Cricket plus Sri Lanka in National Teams. Other sports, clubs, countries and match-type choices are retained. New users are not automatically subscribed to UFC or Sri Lanka.

## Ordering

There is **no fixed UFC priority** and no extra ranking setting. Live events appear first, then upcoming selected events in time order. The default Live & Upcoming view includes the next 16 calendar days; Tomorrow, Upcoming, Calendar and Results remain available. UFC does not outrank live cricket or an earlier selected event. Favorite teams are still available in My Teams.

## Android and phone setup

The app is APL TV Sports (`com.siddeekazeez.apltv`), separate from the official app. It keeps its own provider settings. Subsequent custom APKs use the same signing key and update it in place. The official app's hard-coded APL Launcher Continue Watching authority is not used by this separate package.

The custom phone helper uses port **8766**, separate from the official app's 8765. The web client reads the port from the native Android host, so phone QR links, submission, editing and guide access stay consistent. Older hosts and other platforms retain 8765. Rescan the current QR code after an app update if an old phone tab stops working.

## Updates and signing

Custom Android release runs daily at 03:23 UTC and supports manual Actions runs. It merges the latest official release tag locally, regenerates manifests, runs upstream and custom tests, builds and verifies a signed APK, then publishes source and a release. Source conflicts stop publication for manual review. Only generated version/build manifests are resolved automatically. Unchanged source is not rebuilt on the daily check.

Install `apl-tv-sports-android.apk` from this fork's Releases. Android version codes increase with each workflow build. Signing uses encrypted Actions secrets `ANDROID_KEYSTORE_B64` and `ANDROID_KEYSTORE_PASS`; the key/password are never committed. Keep the offline signing backup: a replacement key cannot update existing installations in place. GitHub may disable schedules in inactive forks; check Actions if a long-inactive fork stops checking upstream.

## Validation

```
python3 tools/check.py
node tools/test-custom-sports.cjs
```

Tests cover preference migration, country and club filtering, promotion IDs, event grouping/full-card retention, UFC event-type filters, live-first chronology, multi-day Tests, winner flags, season fallback, artwork identity/date checks and fallback, source caching/outages, and phone-helper isolation. `SPORTS_FIXTURE_DIR` optionally checks downloaded public ESPN samples (`ufc.json`, `apl-pfl.json`, `apl-iplschedule.json`) without publishing personal playlists or credentials.

## Data limits

The public sports endpoints are not a contracted API. Coverage depends on their published fixtures, team directories and artwork. Some future card details, exact bout times, section labels, individual artwork or smaller-country tours may be missing. Published times are shown without inventing precise bout times. A data-schema change can require maintenance.

This adds schedules and browsing, not broadcast rights or streams. Playback needs a configured provider carrying the event and identifiable channel/guide information. No channels, playlists or provider credentials are distributed. No custom Samsung or LG packages are published.
