# Fridgeplan

Fridge-as-interface inventory and recipe app. See `README.md` for what it does
and how to deploy it.

## Read `context.md` first

`context.md` at the repo root is the working source of truth for decisions
already made: architecture invariants, domain choices, conventions, and the
traps that have already cost a debugging cycle. **Read it before starting work**
and follow what it settles rather than re-deciding it.

It is **gitignored on purpose** — it is a scratchpad for this project's history,
not documentation for people using the repo. That also means a fresh clone will
not have it: if `context.md` is missing, say so and ask whether to reconstruct
it before relying on memory.

## Keep `context.md` up to date

Update it when something in it would otherwise become wrong or incomplete:

- after completing a meaningful piece of work — a new decision, a changed
  invariant, a convention established, a trap discovered;
- **before ending a session or letting the context window compact**, so nothing
  learned is lost with the transcript.

Keep it accurate and short. It is read in full every session, so every line
should earn its tokens: prefer the constraint that forced a decision over a
narration of what was built. Delete what has stopped being true instead of
appending corrections.

## Working rules

- Develop on `main` and push directly; do not open a pull request unless asked.
  Every push to `main` builds and publishes a GHCR image.
- **Run `npm run build:nodb` before pushing.** It builds with `DATABASE_URL`
  unset, which is the environment the Docker image builds in; a database read
  during prerender passes locally and fails only inside Docker.
- Also run `npm run lint` and `npm run typecheck`.
- Verify by running the thing, not by assuming it works because it compiled.
- Comments explain *why*, not *what* — especially the constraint that forced a
  choice.
