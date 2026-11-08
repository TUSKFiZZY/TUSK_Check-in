# TUSKFiZZY Guild Board Migration

## Status

This branch is migration work only. The production `main` branch and GitHub Pages deployment are intentionally unchanged. No live installer or user data has been overwritten.

## Target

Use Guild Board as the technical foundation while retaining TUSKFiZZY's identity and existing personal workflows:

- Guild Board dashboard, local Python core, SQLite persistence, and Electron desktop shell.
- TUSKFiZZY purple visual identity, name, icon, and familiar compact interaction patterns.
- Offline-first, single-user defaults. Cloud, Discord, Supabase, friend/social, and presence features remain disabled unless separately approved.
- Preserve the upstream MIT license and `THIRD-PARTY-NOTICES.txt`; retain relevant upstream attribution and notices.

Upstream source: https://github.com/QL1STY/guild-board

The Guild Board author explicitly granted permission to reuse the repository under its MIT terms, with the condition that its LICENSE file (or an equivalent attribution) is retained. A copy is included as `LICENSE-GUILD-BOARD`. Attribute reused work as “Based on Guild Board by QL1STY.” HoYoverse game art is not covered by that permission and must not be copied from Guild Board; use only assets with separate permission or appropriate rights.

## Non-negotiable safety rules

1. Keep this migration on `migration/guild-board-foundation`; do not push migration work to `main` during development.
2. Do not change GitHub Pages or publish a release until the migrated desktop app passes the acceptance checks below.
3. Never commit cookies, HoYoLAB tokens, wish-history URLs containing credentials, local databases, personal account exports, or logs containing secrets. Keep local secrets in ignored files or the upstream DPAPI-backed secret store; verify `.gitignore` and scan the staged tree before every commit.
4. Do not copy Electron session cookies between app origins or profiles. If secure session migration cannot be demonstrated, preserve account records and ask the user to sign in again.
5. Preserve a recoverable backup before converting any localStorage/browser data to SQLite. Import must be repeatable and must not delete the source data.
6. Keep each HoYoLAB account's authentication state isolated. Account profiles and display names must survive re-login.
7. Do not add game-process memory reading, injection, game-file modification, or background actions outside the upstream project's documented safe boundaries.

## Existing TUSKFiZZY behavior to preserve

### Accounts and daily tracking

- Add, edit, and delete multiple Genshin accounts; new installs must not create hard-coded Main/Alternate accounts.
- Per-account HoYoLAB sign-in and session isolation.
- Daily checklist: Login, Commission, Resin.
- Resin automation: check off only when resin falls below 50 after the day begins; do not auto-check merely because resin was already below 50 at the first daily observation; once checked, remain checked for that day even if resin refills.
- Commission automation: check off after the commission bonus reward is claimed.
- Month overview: past days only are interactive; completed past days are green/check, incomplete past days red/cross, future dates neutral; date numbers centered and bold.

### Genshin integrations

- HoYoLAB daily check-in.
- Daily Note on Home: resin, commissions, expeditions.
- Enka profile lookup, accepting the user's 10-digit Asia UID as well as 9-digit UIDs.
- Battle Chronicle.
- Wish-history import and pity display.
- Achievements and refresh without freezing navigation or breaking input focus.

### Interface and branding

- Home, Genshin Profile, Achievements, Wish History + Pity, and Manage Genshin Accounts.
- Account avatar upload and editing; no portrait-URL field.
- Purple TUSKFiZZY theme, existing preferred background, circular app icon, and compact layout.
- Reliable tabs, buttons, text inputs, caret behavior, resizing, and mouse interaction. Typing must not create stray characters or permanently trap focus.

## Migration architecture

- Desktop: adapt the upstream Electron shell; retain TUSKFiZZY product name, app ID, icon, and Windows installer identity.
- Core: use Guild Board's local Python service and SQLite-backed domain services as the system of record.
- UI: port the TUSKFiZZY workflows into the upstream React/TypeScript web app rather than continuing to depend on a remote GitHub Pages `index.html`.
- Bridge: expose narrow, validated local API/IPC operations for TUSKFiZZY-specific account and checklist behavior. Do not expose arbitrary filesystem or shell access to the renderer.
- Data: define versioned import/export schemas. Migrate account metadata, checklist history, preferences, and avatar files; keep authentication material out of the generic export. Prefer upstream DPAPI-backed secret storage.
- Tests: unit-test the resin and commission transitions, account isolation, date-boundary behavior, import idempotency, and UI interaction regressions.

## Work sequence

1. Inventory upstream modules, UI routes, persistence models, and the current TUSKFiZZY storage schema.
2. Create a TUSKFiZZY integration package and versioned data migration/import path.
3. Implement accounts and the daily checklist against SQLite.
4. Port Daily Note, Enka profile, Battle Chronicle, wish-history/pity, and achievements integrations one at a time.
5. Apply TUSKFiZZY theme, branding, navigation, and account-avatar UI.
6. Add regression tests and run upstream plus TUSKFiZZY tests.
7. Build and smoke-test the Windows installer in a clean Windows environment.
8. Open a draft PR for review. Only after explicit approval should the change be merged or published.

## Acceptance checklist

- [ ] Fresh install creates no sample Main/Alternate accounts.
- [ ] Add/edit/delete account works and account records persist after restart.
- [ ] Two accounts cannot read or reuse each other's HoYoLAB session.
- [ ] Login, Commission, Resin checklist works across local midnight.
- [ ] Resin below 50 at first observation does not auto-check; a later drop below 50 does; refill does not uncheck.
- [ ] Commission checks only after bonus reward claim.
- [ ] Month overview past/current/future interaction and colors are correct.
- [ ] Daily Note appears on Home and refreshes without UI lockup.
- [ ] Enka accepts 9- and 10-digit UIDs and displays character data.
- [ ] Battle Chronicle loads for the selected account.
- [ ] Wish-history import and pity calculations work without exposing credentials.
- [ ] Achievements refresh leaves buttons and text inputs responsive.
- [ ] Avatar upload, navigation, focus/caret, and window resizing work.
- [ ] Purple theme, TUSKFiZZY name, and circular icon are retained.
- [ ] Data import is repeatable, backed up, and leaves original data recoverable.
- [ ] Windows installer builds and launches on a clean Windows 11 environment.
- [ ] Upstream license and third-party notices are included.

## Permission and asset boundary

The Guild Board author has explicitly authorized reuse of the MIT-licensed repository and requested retention of its LICENSE file or attribution. This does not grant rights to HoYoverse game art. Do not copy game artwork into the migrated app unless it is separately licensed or permission is obtained.

## Current implementation constraint

This repository's connected GitHub permission allows writing to TUSKFiZZY but only reading Guild Board. The GitHub connector can edit repository text files, but it cannot run the Python/Node toolchain or Windows installer. Therefore this document records the migration contract and protects the existing branch; it is not evidence that the application has already been ported or tested. Full implementation requires a writable copy/fork of Guild Board and a build/test environment.
