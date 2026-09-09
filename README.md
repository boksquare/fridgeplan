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

**Phase 3** is the full visual and animation pass, expiry-flag polish, guest
mode for hosted instances, and the self-host docs.

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

## License

TBD.
