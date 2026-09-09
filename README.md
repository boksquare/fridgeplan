# Fridgeplan

An app where the fridge *is* the interface. Pick your real fridge type and
configuration, click doors and drawers to see what is inside, and get recipe
suggestions from what you actually have.

The same codebase runs two ways:

- **Personal self-host** — no login, single implicit user, you pick your own AI provider.
- **Public hosted** — accounts, households that share a fridge, AI provider locked to the instance's config.

Which one an instance is gets decided once, in the first-run setup wizard.

## Status

**Phase 0 (scaffold)** — Next.js + TypeScript + Tailwind app shell, Prisma
schema for the full v1 data model, Auth.js email/password skeleton,
deployment-mode wizard, Docker/compose deployment.

**Phase 1 (fridges and inventory)** — fridge-type selection with illustrated
options, the French-door drawer-count builder with a live preview,
dynamically generated compartments, add/rename/delete/replace of fridges, and
inventory CRUD: ingredient typeahead, structured amount + unit, optional
purchase and expiry dates, "used up" without losing history, and expiry flags
(amber three days out, red on or after the date — always tint plus icon plus
words).

Replacing a fridge asks what should happen to the inventory inside: move it
across (matching compartment where there is one, main fridge or freezer section
otherwise), or delete it — the latter behind two further confirmations.

**Phase 2 (recipes and AI)** — "Suggest meals" matches every fridge you can
reach against the configured recipe sources; "Search recipes" does free-text and
cuisine search over the same sources. Both show what you have and what you are
missing, and can ask the configured AI provider for substitutions — preferring
things already in your fridges. "Mark as cooked" asks you to confirm what was
actually used before decrementing inventory, and never guesses when units do not
reconcile. You can add your own recipes with an optional photo; those are
private to your household. Recipe sources and AI providers are both swappable
adapters behind one interface.

**Phase 3 (the fridge itself)** — the appliance is drawn in CSS 3D: a cabinet
with real side and top faces, doors that swing out on their own hinge with
spring physics, drawers that travel towards you, the light coming on inside,
and your items shown on the shelves and in the drawer trays. Handles meet in
the middle the way they do on a French-door or side-by-side unit, and the
cabinet turns towards whichever door you open so you can see in.

Panels are the doors and drawers the appliance actually has, which is not the
same as its storage locations: door bins and crisper drawers sit *behind* a
door, so opening one offers the storage behind it rather than pretending each
is a door of its own. Proportions come from the capacity split of a common
model of each type — see `src/lib/fridge-layout.ts` for the models and
numbers. It respects
`prefers-reduced-motion`, works by keyboard, and fits a 390px screen without
horizontal scroll. Hosted instances also get browser-only guest mode.

## Stack

| Piece | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript |
| Styling / animation | Tailwind CSS + Framer Motion |
| Database | PostgreSQL via Prisma |
| Auth | Auth.js (NextAuth) — email/password for v1, OAuth drop-in later |
| Deployment | Dockerfile + docker-compose (app + postgres + uploads volume) |

## Run it with Docker

```bash
cp .env.example .env
# set AUTH_SECRET (openssl rand -base64 32) and a POSTGRES_PASSWORD
docker compose up --build
```

The app comes up on http://localhost:3000 and sends you to `/setup` to choose
the deployment mode. Migrations are applied automatically on container start by
`docker/entrypoint.sh`; seeding the ingredient dictionary is a separate,
explicit step:

```bash
docker compose exec app npx prisma db seed
```

(`tsx` and the Prisma CLI are runtime dependencies precisely so migrating and
seeding work inside the container.)

Reverse proxies, TLS termination and tunnels are deliberately out of scope here
— compose publishes a plain HTTP port and any proxy in front of it is your
choice.

## Run it locally for development

```bash
npm install
cp .env.example .env        # point DATABASE_URL at a Postgres you can reach,
                            # and set AUTH_SECRET
npx prisma generate         # generate the client into src/generated/prisma
npx prisma migrate dev      # create the schema
npm run db:seed             # load the ingredient dictionary
npm run dev
```

Then open http://localhost:3000 — an un-set-up instance redirects to `/setup`.

Useful scripts: `npm run typecheck`, `npm run lint`, `npm run build`,
`npm run prisma:generate`, `npm run prisma:deploy`.

A few things worth knowing:

- Prisma 7 keeps the connection URL in `prisma.config.ts`, not in
  `schema.prisma`, and the client reaches Postgres through the `pg` driver
  adapter (`src/lib/prisma.ts`).
- The Prisma client is generated as source into `src/generated/prisma` and is
  not committed — run `npx prisma generate` after a fresh clone or a schema
  change. `npm run build` does it for you.
- `output: 'standalone'` is only switched on for the Docker image (via
  `NEXT_OUTPUT_STANDALONE=true`), because `next start` refuses to serve a
  standalone build. A non-Docker deploy is a plain `npm run build && npm start`.
- Auth.js needs `AUTH_TRUST_HOST=true` whenever the app runs behind a proxy or
  in a container.

## Deployment modes

Which mode an instance runs in is chosen once, at `/setup`, and stored in the
database — not in an env var.

| | Personal self-host | Public hosted |
| --- | --- | --- |
| Accounts | none; one implicit user | email + password (OAuth is a drop-in later) |
| Sharing | — | households share fridges and private recipes |
| Guest use | not applicable | browser-only guest mode, see below |
| AI provider | the user picks it in settings | the operator sets it in config; locked for users |
| Claude Code adapter | available | refused |

### Guest mode (hosted only)

A visitor without an account gets a fridge that lives entirely in their
browser's `localStorage`. Nothing about it reaches the database: no rows, no
cache, no identity. Recipe lookups post the inventory to a stateless proxy
(`/api/guest/recipes`) that queries the sources in memory and returns whole
recipes, because there is no cached row for a guest to re-open later. Clearing
browser data clears the fridge, and there is no server-side copy to recover.
Cook-confirmation and AI substitutions need an account, since both depend on
persistent state.

## Recipes and AI

Recipe sources are adapters behind one interface (`src/lib/recipes/`), so a
self-hoster can point the app at their own provider:

| Source | Key | Caching |
| --- | --- | --- |
| TheMealDB | none | stored indefinitely, with attribution |
| Spoonacular | yours, optional | pass-through only — rows expire after 1 hour |

Spoonacular's terms allow caching for at most an hour and require deleting
everything obtained from them if you stop using the API. Rows from it carry an
expiry that is swept on every search, and `npm run purge:provider spoonacular`
removes the lot.

AI providers work the same way (`src/lib/ai/`): NVIDIA NIM, Google Gemini, any
OpenAI-compatible endpoint, the Anthropic API, and — on personal self-host
instances only — the `claude` CLI already signed in on the host. On a hosted
instance the operator sets the provider in config and it is locked for users,
who see which one is answering; on self-host the user picks it in
Settings → AI provider. Stored keys are encrypted at rest.

## Data model

See `prisma/schema.prisma` — it is commented. In short: `User` and `Household`
(joined by `HouseholdMember`) own `Fridge`es; each fridge generates its
`Compartment`s from a config JSON rather than from fixed presets;
`InventoryItem`s live in compartments and reference the canonical `Ingredient`
dictionary; `Recipe`s are either cached from a source API or private to a user;
`AIProviderConfig` is scoped per instance or per user; `DeploymentMode` is a
single row written by first-run setup.

## Attribution

Recipe data and photos come from [TheMealDB](https://www.themealdb.com/) and,
when an operator configures it, [Spoonacular](https://spoonacular.com/food-api).
Spoonacular results are only ever cached for up to an hour, per their terms.

## Self-hosting notes

**Backups.** Everything durable is in Postgres, plus the uploads volume for
private-recipe photos. A `pg_dump` of the database and a copy of the volume is
a complete backup:

```bash
docker compose exec db pg_dump -U fridgeplan fridgeplan > fridgeplan.sql
docker run --rm -v fridgeplan_uploads:/data -v "$PWD:/backup" alpine \
  tar czf /backup/uploads.tar.gz -C /data .
```

**Upgrading.** Pull, rebuild, and restart — the entrypoint applies any new
migrations before the app starts serving:

```bash
git pull && docker compose up --build -d
```

**The production build must not need a database.** `next build` evaluates every
route module to collect its config, and the Docker build has no Postgres — so
`src/lib/prisma.ts` connects on first *use* rather than on import. Anything that
opens a connection at module scope will break `docker compose build` while
passing locally, where `.env` happens to supply `DATABASE_URL`. Check with:

```bash
env -u DATABASE_URL npm run build
```

**Secrets.** `AUTH_SECRET` signs sessions and, unless `AI_ENCRYPTION_KEY` is
set, also derives the key that encrypts stored AI provider keys. Changing it
signs everyone out and makes stored provider keys unreadable, so set it once
and keep it.

**Reverse proxies and TLS** are deliberately out of scope: compose publishes a
plain HTTP port and whatever sits in front of it is your choice. Set
`AUTH_TRUST_HOST=true` (compose does) and point `NEXTAUTH_URL` at the public
URL so auth callbacks resolve.

**Recipe sources.** TheMealDB needs no key. If you configure Spoonacular,
remember that its terms cap caching at an hour and require deleting what you
obtained if you stop using it — `npm run purge:provider spoonacular` does that.

**Not built yet:** email/push notifications for expiry, an admin panel for
hosted operators to change the AI provider without editing config, and
automatic unit reconciliation when a recipe's units do not match what is in the
fridge (you are asked to confirm instead).

## License

TBD.
