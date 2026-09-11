# Fridgeplan — working context

Source of truth for decisions already made. Read at the start of a session;
update it after meaningful work and before the context window compacts.
Committed to the repo, so it travels with a clone and survives an ephemeral
cloud session.

Last updated: 2026-09-11

---

## The project

Fridge-as-interface inventory + recipe app. A 3D model of your actual fridge on
the front page; click doors/drawers to see and edit what is inside; recipes are
matched against what you really have.

- Repo: `boksquare/fridgeplan` (public), default branch **`main`**
- Deployed by the user at **https://fridge.boksquare.com** (public_hosted mode)
- Image: `ghcr.io/boksquare/fridgeplan:latest`, public, multi-arch
- Work is pushed **directly to `main`**; no PRs unless asked

## Stack and version constraints

Next.js 16 (App Router, Turbopack) · React 19.2 · TypeScript · Tailwind 4 ·
Prisma 7 + Postgres · Auth.js v5 beta · three.js 0.186 · zod 4

Constraints that are load-bearing — do not "fix" these:
- **Plain three.js, not react-three-fiber.** R3F 9.x peer-pins React `<19.3`.
- **Prisma 7**: connection URL lives in `prisma.config.ts`, *not* `schema.prisma`;
  reaches Postgres via the `pg` driver adapter. Client is generated **source**
  into `src/generated/prisma` and is gitignored — run `npx prisma generate`
  after a fresh clone or schema change.
- **`next lint` was removed in Next 16** — ESLint flat config, `npm run lint`.
- **`output: 'standalone'`** is gated on `NEXT_OUTPUT_STANDALONE=true` (Docker
  only), because `next start` refuses to serve a standalone build.

## Architecture invariants

- **Two deployment modes**, chosen once at `/setup`, stored in the
  `DeploymentMode` singleton row (never an env var):
  `personal_self_host` (no login, one implicit user) and `public_hosted`
  (accounts, households, operator-locked AI provider).
- **Fridge access** always goes through `fridgeAccessFilter()` in
  `src/lib/fridges.ts`. A fridge belongs to a household **or** a user, never
  both — sharing means *moving* it.
- **Optional env vars must go through `src/lib/env.ts`**, never
  `process.env.X ?? fallback`. See Traps.
- **Nothing may read the database at build time.** See Traps.
- **Compartments are generated** from a fridge's config JSON, not from presets.
  Door bins/crispers live *behind* a door (`src/lib/fridge-layout.ts`).
- **Guest mode is 100% client-side** (localStorage + `useSyncExternalStore`),
  stateless recipe proxy, zero DB writes. Guests get no AI.

## Domain decisions

**Units** — three families in `src/lib/recipes/units.ts`: mass (g/kg/oz/lb),
volume (ml/l/tsp/tbsp/floz/cup/pt/gal), `count`. Each unit knows its size in
g or ml; conversion is a ratio *within* a family. Cross-family (g↔ml) is
**refused**, not guessed — the user is asked. Volumes are **US customary** and
labelled `(US)` in pickers; `formatAmount()` gives the short form for display.

**Ingredient matching** (`src/lib/recipes/matching.ts`) — an item only counts
when the names agree or one is the other narrowed by a word from the
`SPECIFIERS` allowlist ("chicken breast" is chicken; "chicken nuggets" is not).
Anything sharing only a word is `possible` — shown as a hint, never counted.
The list is deliberately short: under-matching is visible and correctable,
over-matching hides a shopping trip. Colours/varieties are excluded on purpose.

**Households** — invite by unguessable link (no email; the app sends no mail).
Single-use, 7-day expiry, revocable. Redemption uses a conditional `updateMany`
so two people opening one link cannot both join. Only owners invite/remove/
change roles; the last owner cannot leave or demote while others remain; the
last member out takes the fridges and the household dissolves.

**AI** — optional, three callsites only: substitutions
(`src/lib/ai/substitutions.ts`), receipt scanning (`src/lib/receipts/scan.ts`),
unit suggestions (`src/lib/units/suggest.ts`, cached per ingredient so an
unknown name costs one call ever). Providers: `nvidia_nim`, `gemini`,
`openai_compatible`, `anthropic`, `claude_code`. `claude_code` is self-host-only
and **cannot** do vision. NIM needs a vision model for receipts. Keys encrypted
at rest with `AI_ENCRYPTION_KEY` or `AUTH_SECRET`.

**Receipt scanning** — the photo is never written to disk, stored, or logged.
Always a reviewable draft with the printed line beside each reading. Shrunk
client-side to ~120 KB (NIM's inline limit). Batch insert is one transaction.
20 scans/hour/user.

**Recipe sources** — TheMealDB (no key, cacheable indefinitely, needs
attribution) and Spoonacular (optional key, **1-hour cache max per their
terms**, `npm run purge:provider spoonacular` deletes it all).

## Conventions

- **Comments explain *why*, not what** — especially the non-obvious constraint
  that forced a choice. Match surrounding density.
- **Verify by running, not by assuming.** Real Postgres, and a headless browser
  for anything with a UI. Never claim something works because it compiled.
- **Commit messages**: imperative subject, body explains *why* and what was
  verified. End with the `Co-Authored-By:` / `Claude-Session:` lines the session
  provides.
- British-leaning prose in UI copy and docs; plain, non-hyped tone.
- Accessibility is not optional: colour *plus* icon *plus* words; keyboard
  reachable; `prefers-reduced-motion` respected; 390px width with no horizontal
  scroll.

## Traps already hit (each cost a real cycle)

1. **`${VAR:-}` in docker-compose yields an empty string, not absence.**
   `??` does not fall through for `""`. This silently disabled every recipe
   source in Docker while working locally. → `src/lib/env.ts`.
2. **The production build has no database.** `next build` prerenders
   `/_not-found`; anything the root layout touches runs then. The root layout is
   `force-dynamic` because `AppHeader` reads the DB. **Run `npm run build:nodb`
   before pushing** — CI runs it too.
3. **`NEXTAUTH_URL` must stay unset.** Auth.js resolves redirects against it;
   compose used to default it to `localhost:3000`, which broke sign-out on the
   real host. `AUTH_TRUST_HOST=true` derives the origin from the request.
   Sign-out now does `signOut({ redirect: false })` then Next's relative
   `redirect('/signin')`.
4. **The runtime image is not the whole repo.** It carries `prisma/`,
   `prisma.config.ts`, `scripts/`, `src/generated/`. Add a script that runs in
   the container and you must copy what it imports.
5. **App-router directories starting with `_` are private** and produce no
   route (cost me a debugging detour with a probe route).
6. **`prisma migrate deploy` runs on every container start** via
   `docker/entrypoint.sh`. Migrations only go forwards.
7. **`AUTH_SECRET` is load-bearing** — changing it signs everyone out and makes
   stored AI keys unreadable.
8. `normalizeIngredientName()` **strips descriptor words** ("ground", "fresh"),
   so it must not be used for exact-identity checks — `resolveIngredient()`
   matches the raw name case-insensitively.

## Open / not built

- Email or push notifications for expiry.
- Admin panel for hosted operators to change the AI provider without editing config.
- Automatic cross-family unit reconciliation at cook time (user confirms instead).
- Suggested-but-not-requested AI ideas: shelf-life/expiry prefill, natural-language
  add, semantic ingredient matching, recipe-from-inventory, meal plan / shopping list.
