# Fridgeplan

An app where the fridge *is* the interface. Pick your real fridge type and
configuration, click doors and drawers to see what is inside, and get recipe
suggestions from what you actually have.

The same codebase runs two ways:

- **Personal self-host** — no login, single implicit user, you pick your own AI provider.
- **Public hosted** — accounts, households that share a fridge, AI provider locked to the instance's config.

Which one an instance is gets decided once, in the first-run setup wizard.

## Status

**Phase 0 (scaffold) is in place:** Next.js + TypeScript + Tailwind app shell,
Prisma schema for the full v1 data model, Auth.js email/password skeleton,
deployment-mode wizard, Docker/compose deployment. Fridge selection, inventory,
recipes and the visual pass follow in Phases 1–3.

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
