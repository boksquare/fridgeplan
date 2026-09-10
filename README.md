# Fridgeplan

Your fridge is the interface. Pick the fridge you actually own, click its doors
and drawers to see what is inside, and get recipe suggestions from what you
really have.

It is a self-hostable web app: a 3D model of your appliance on the front page,
an inventory behind each compartment, expiry tracking, and recipe matching
against the ingredients in your fridges. Optionally, an AI provider of your
choice can read a photo of a grocery receipt into your inventory and suggest
substitutions for what you are missing.

---

## Features

**The fridge**
- Four appliance types — French door, top freezer, bottom freezer, side-by-side —
  with proportions taken from real models, and a drawer-count builder for
  French-door units.
- A 3D model whose doors swing and drawers slide, showing your items on the
  shelves. Keyboard accessible, works at phone width, respects
  `prefers-reduced-motion`.
- Compartments are generated from the fridge's shape, so door bins and crispers
  live *behind* a door rather than pretending to be doors of their own.

**Inventory**
- Ingredient autocomplete, structured amount + unit, optional purchase and
  expiry dates.
- Expiry flags — amber three days out, red on or after the date — always colour
  *plus* icon *plus* words.
- "Used up" keeps the history instead of deleting the row.
- Units in three families: mass (g, kg, oz, lb), volume (ml, l, tsp, tbsp,
  fl oz, cup, pint, gallon) and `count`. Volumes are **US customary**, and the
  pickers say so — a US pint is 473 ml, a UK one 568 ml.
- Typing an ingredient prefills the unit it is usually bought in: milk by the
  gallon, ground beef in lb, olive oil by the tablespoon.
- Replacing a fridge asks what to do with what is inside — move it across, or
  delete it behind two further confirmations.

**Recipes**
- "Suggest meals" matches every fridge you can reach against the configured
  recipe sources; "Search recipes" does free-text and cuisine search.
- Matching only counts an item when it really is the ingredient: chicken
  nuggets do not satisfy a recipe wanting chicken. Near misses are shown beside
  the line as something you *do* have, without inflating the count.
- "Mark as cooked" asks you to confirm what was actually used before
  decrementing, and converts within a unit family (a cup of milk decrements a
  gallon). It never guesses across families — grams to millilitres needs a
  density, so it asks.
- Add your own recipes with a photo; those stay private to your household.

**Sharing and accounts**
- Two deployment modes, chosen once at first run: **personal self-host** (no
  login, one implicit user) or **public hosted** (accounts and households).
- Households share fridges. Invite by unguessable link — single use, expires in
  seven days, revocable.
- Guest mode (hosted only): a fridge that lives entirely in the visitor's
  browser, with nothing written to the database.

**AI (optional)** — see [Setting up AI](#setting-up-ai).

---

## Quick start

You need Docker and somewhere to run it. There is nothing to clone and nothing
to build: images are published to GHCR for `linux/amd64` and `linux/arm64`, so
the same tag works on a server, an Apple Silicon Mac, or a Raspberry Pi.

```bash
mkdir fridgeplan && cd fridgeplan
curl -O https://raw.githubusercontent.com/boksquare/fridgeplan/HEAD/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/boksquare/fridgeplan/HEAD/.env.example

# Set AUTH_SECRET and POSTGRES_PASSWORD in .env, at minimum:
#   openssl rand -base64 32

docker compose up -d
```

Open http://localhost:3000. It sends you to `/setup` to choose the deployment
mode — that choice is stored in the database, not an env var, and is made once.

Then load the ingredient dictionary, which powers autocomplete and matching:

```bash
docker compose exec app npx prisma db seed
```

Migrations are applied automatically on every container start.

### Updating

```bash
docker compose pull && docker compose up -d
```

The new container applies any migrations the release needs before serving. This
only goes forwards — rolling back to an older image does not undo a migration,
so take a dump first if you are updating something you cannot lose.

By default you track `latest`, which moves with every push to `main`. To decide
when you move, pin a release in `.env`:

```bash
FRIDGEPLAN_TAG=v1.2.0
```

### Building it yourself instead

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build
```

---

## Configuration

Everything is environment variables, read from `.env` next to
`docker-compose.yml`. Only two are required.

| Variable | Required | What it does |
| --- | --- | --- |
| `AUTH_SECRET` | **yes** | Signs sessions, and derives the key that encrypts stored AI keys. Set once and keep it — changing it signs everyone out and makes stored provider keys unreadable. |
| `POSTGRES_PASSWORD` | **yes** | Password for the bundled Postgres container. |
| `APP_PORT` | no | Host port to publish on. Default `3000`. |
| `NEXTAUTH_URL` | no | **Best left unset.** With `AUTH_TRUST_HOST` on, the origin is taken from the request, which is right behind any proxy. Setting it to anything other than the URL people actually visit breaks redirects. |
| `AUTH_TRUST_HOST` | no | Already `true` in compose. Needed behind a proxy or in a container. |
| `FRIDGEPLAN_TAG` / `FRIDGEPLAN_IMAGE` | no | Pin a release, or run a fork's image. |
| `UPLOAD_DIR` | no | Where recipe photos are written. Compose mounts a volume here. |
| `SPOONACULAR_API_KEY` | no | Adds Spoonacular as a recipe source. TheMealDB needs no key. |
| `RECIPE_PROVIDERS` | no | Which sources to use, in order. Defaults to every configured source. |
| `AI_PROVIDER` etc. | no | See [Setting up AI](#setting-up-ai). |

`.env.example` in this repo is the annotated version of the same list — copy it
and uncomment what you need.

### Example `.env`

A hosted instance behind a reverse proxy, with Gemini for the AI features:

```bash
# Required
AUTH_SECRET="paste-openssl-rand-base64-32-here"
POSTGRES_PASSWORD="a-long-random-password"

# Optional
APP_PORT="3000"

# Recipe sources — TheMealDB is on by default and needs no key
# SPOONACULAR_API_KEY="..."

# AI — see the section below
AI_PROVIDER="gemini"
AI_MODEL="gemini-2.0-flash"
AI_API_KEY="..."
```

Leave `NEXTAUTH_URL` commented out unless the app genuinely cannot see its own
public host in the request headers.

---

## Setting up AI

AI is entirely optional. Without it everything works except substitutions and
receipt scanning; unit prefill quietly falls back to a built-in table.

**What uses it**

| Feature | What it does |
| --- | --- |
| Ingredient substitutions | On a recipe, suggests what to use for what you are missing — preferring things already in your fridges. |
| Receipt scanning | Photograph a grocery receipt and it becomes a reviewable draft of inventory items. Needs a **vision** model. |
| Unit suggestions | Only for an ingredient the built-in table does not know, and the answer is cached on that ingredient — so an unknown name costs one call ever, not one per keystroke. |

**Providers**

| `AI_PROVIDER` | Key needed | Vision (receipts) |
| --- | --- | --- |
| `gemini` | yes | yes |
| `anthropic` | yes | yes |
| `openai_compatible` | yes | yes |
| `nvidia_nim` | yes | only with a vision model, e.g. `meta/llama-3.2-11b-vision-instruct` |
| `claude_code` | no — uses the `claude` CLI on the host (`CLAUDE_CODE_BIN` if it is not on `PATH`) | no; refused in hosted mode |

Set it in `.env`:

```bash
AI_PROVIDER="nvidia_nim"
AI_MODEL="meta/llama-3.1-70b-instruct"   # the provider's own model id
AI_API_KEY="nvapi-..."
# AI_BASE_URL=""                          # only to override the default endpoint
```

Two things that bite people:

- **Uncomment the lines.** A leading `#` leaves them comments and the app
  correctly reports no provider configured.
- **NVIDIA NIM namespaces model ids** as `publisher/model`. `llama-3.1-70b-instruct`
  will not resolve; `meta/llama-3.1-70b-instruct` will.

In **personal self-host** mode this config is a fallback and each user can pick
their own provider in Settings → AI provider; keys stored that way are encrypted
at rest, with `AI_ENCRYPTION_KEY` if set and `AUTH_SECRET` otherwise. In
**public hosted** mode the operator's config is the only source and users cannot
change it.

**Check it actually works:** Settings → Diagnostics (or `GET /api/diagnostics`)
makes a real call to each recipe source and to the AI provider and shows the
error text when one fails, including whether your provider can accept images.
That is much faster than reading container logs.

### Scanning a receipt

"Scan a receipt" sits beside any compartment; on a phone it opens the camera.
The photo is shrunk in the browser, sent once, and **never written to disk,
stored in the database, or logged**. What comes back is a draft you check line
by line, with the printed text shown beside each reading — each line has its own
amount, unit and destination compartment, and unticking one leaves it out. The
whole batch is added in a single transaction. Limited to 20 scans an hour per
user.

---

## Recipe sources

| Source | Key | Caching |
| --- | --- | --- |
| [TheMealDB](https://www.themealdb.com/) | none | stored indefinitely, with attribution |
| [Spoonacular](https://spoonacular.com/food-api) | yours, optional | pass-through only — rows expire after 1 hour |

Either source can be pointed elsewhere — at a mirror, or your own API — with
`THEMEALDB_BASE_URL` and `SPOONACULAR_BASE_URL`.

Spoonacular's terms allow caching for at most an hour and require deleting
everything obtained from them if you stop using the API:

```bash
docker compose exec app npm run purge:provider spoonacular
```

---

## Running it

**Backups.** Everything durable is Postgres plus the uploads volume:

```bash
docker compose exec db pg_dump -U fridgeplan fridgeplan > fridgeplan.sql
docker run --rm -v fridgeplan_uploads:/data -v "$PWD:/backup" alpine \
  tar czf /backup/uploads.tar.gz -C /data .
```

**Reverse proxies and TLS** are deliberately out of scope. Compose publishes a
plain HTTP port; whatever sits in front of it is your choice. `AUTH_TRUST_HOST`
is already set, so the app takes its origin from the proxy's headers.

**Something remote not working?** Settings → Diagnostics, before the logs.

---

## Development

```bash
npm install
cp .env.example .env         # point DATABASE_URL at a Postgres you can reach,
                             # and set AUTH_SECRET
npx prisma generate          # the client is generated into src/generated/prisma
npx prisma migrate dev
npm run db:seed
npm run dev
```

Scripts: `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run build:nodb`, `npm run prisma:deploy`, `npm run purge:provider`.

**Run `npm run build:nodb` before pushing.** It builds with `DATABASE_URL`
unset, which is the environment the Docker image builds in. A page that reads
the database while being prerendered builds fine on a machine with a database in
reach and fails only inside Docker. CI runs it too. (It sets an env var inline,
so it wants a POSIX shell.)

A few things worth knowing:

- Prisma 7 keeps the connection URL in `prisma.config.ts`, not `schema.prisma`,
  and reaches Postgres through the `pg` driver adapter. The client is generated
  source in `src/generated/prisma` and is **not** committed — run
  `npx prisma generate` after a fresh clone or a schema change.
- `output: 'standalone'` is only switched on for the Docker image, via
  `NEXT_OUTPUT_STANDALONE=true`, because `next start` refuses to serve a
  standalone build.
- Optional env vars must go through `src/lib/env.ts`, never
  `process.env.X ?? fallback`. Compose passes unset optional variables as `""`,
  and `??` does not fall through for an empty string — that mismatch silently
  disabled every recipe source in Docker while working fine locally.
- Commands that run *inside* the container need their files in the runtime
  image, which is not the whole repo. Add a script that runs in the container
  and you must copy what it imports too.

**Publishing** is automatic: `.github/workflows/publish.yml` builds and pushes on
every push to `main` and on any `v*` tag. Each architecture is built on its own
native runner and the two are joined into one manifest. Authentication uses the
`GITHUB_TOKEN` Actions provides — there is no secret to create or rotate.

**Data model:** see `prisma/schema.prisma`, which is commented.

---

## Not built yet

- Email or push notifications for expiring items.
- An admin panel for hosted operators to change the AI provider without editing
  config.
- Automatic unit reconciliation across families at cook time — you are asked to
  confirm instead.

## Attribution

Recipe data and photos come from [TheMealDB](https://www.themealdb.com/) and,
where an operator configures it, [Spoonacular](https://spoonacular.com/food-api).

## License

TBD.
