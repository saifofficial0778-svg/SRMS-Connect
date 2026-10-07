# Test-data seed (development / test only)

```bash
npm run seed:test-data -- --dry-run   # show what would be preserved and removed; changes nothing
npm run seed:test-data                # reset the database and fill it with synthetic test data
npm run seed:test-data -- --analytics-only   # keep everything; only rebuild analytics history
```

**This deletes data.** It is meant for a local development database and refuses to run when
`NODE_ENV=production` or when `DB_HOST` is not this machine. It is not part of the migrations
and nothing in the application calls it.

## What it does, in order

1. **Checks the schema.** Every table must be listed in the script (`WIPE_TABLES`,
   `FILTERED_TABLES`, `UNTOUCHED_TABLES`). An unknown table stops the run before anything is deleted.
2. **Resolves the three preserved identities from the database** (no hard-coded ids) and prints them:
   - the student master record with enrollment `2025107452` and the account registered from it,
   - the one existing `ADMIN` account,
   - the account whose name starts with "Shakshi"/"Sakshi" (set `SEED_KEEP_ENROLLMENT` to pin it).

   If any of them does not resolve to exactly one row, the script stops without changing anything.
3. **Backs up every table** to `seed-output/backups/backup-run-<time>.json` (the newest 5 are kept).
4. **Cleans up in one transaction** (plain `DELETE`s in foreign-key order, verified before commit,
   rolled back on any problem). Kept: the three accounts, their master records, their profiles
   (with skills, projects, Open-to) and their login sessions, plus the reference tables
   `skills`, `skill_aliases` and `schema_migrations`.
5. **Inserts master data** in one transaction: 50 rows in `student_master`, 50 in `alumni_master`.
6. **Registers all 100 people through the application's own services**:
   `AuthService.register` -> OTP (captured in memory, no e-mail is sent) -> `verifyRegisterOtp` ->
   admin approval with `UserService.updateUserStatus`. Passwords are hashed by the auth service.
7. **Creates activity through the services**, so every business rule and notification applies:
   profiles, skills, projects, Open-to, connections, posts, likes, comments, conversations,
   messages, jobs, referrals, resume reviews, questions, mentor profiles, mentorships with goals
   and sessions, and warm introductions. Input is validated with each module's zod schema first.
8. **Spreads timestamps** of the seeded rows over the last weeks (direct `UPDATE`s), then inserts two
   months of **analytics history** (post impressions, profile views, search appearances). History is
   inserted directly because the recording services only ever write "today"; today's profile views go
   through the real service so the notifications exist. `--analytics-only` runs just this step: it
   clears and refills the three analytics tables and touches nothing else.
9. **Verifies**: the preserved rows are compared with their state before the run, and smoke checks
   run for auth, search, directory, notifications (privacy + unread counts), jobs, referrals,
   resume reviews, questions, mentorship, warm introductions, skill gap, industry pulse, posts,
   connections, chat and analytics. The exit code is non-zero if a check fails.
10. **Writes `seed-output/SEED_REPORT.md`** with the preserved accounts, all test logins, row counts
    per table, check results and any adjustments.

## Running it again

Every run starts with the cleanup, so it is safe to repeat and always ends in the same state:
the people, their profiles and the amount of activity are generated from a fixed random seed.
If a run fails half-way, run it again.

## Test logins

All generated accounts share one password (default `SrmsSeed@2026`, override with
`SEED_TEST_PASSWORD`). Log in with the enrollment number and password. Their e-mail addresses end
in `@srms-seed.test`, which can never receive mail, so use password login rather than OTP login.
The preserved accounts keep their own passwords; the script never reads or changes them.

## What is synthetic

Names are random first/last-name combinations, companies are fictional, phone numbers are
placeholders and every link points at `example.com`. No real person's data is used.

## Files

- `seedTestData.js` - the script
- `data.js` - names, companies, skill tracks and text templates
- `../../seed-output/` - report and backups (ignored by git; backups contain password hashes)
