# Contributing to chaos-atlas

Contributions are genuinely welcome, and that includes the ones that are not
code. A bug report, a system whose parameters are wrong, a plot that renders
badly on your screen, an explanatory paragraph that did not explain — all of
those are worth opening an
[issue](https://github.com/openfluids/chaos-atlas/issues) for.

If you are unsure whether something is worth reporting, it probably is. Open the
issue.

## Getting set up

chaos-atlas is a Next.js site with a small Python component that generates the
data behind the figures.

```bash
git clone https://github.com/openfluids/chaos-atlas.git
cd chaos-atlas
npm ci
npm run dev
```

For the Python side:

```bash
cd python
uv venv
uv pip install -e ".[dev]"
```

Most contributions touch only one of the two. You do not need the Python
environment to fix a component, or Node to fix a solver.

## Before you open a pull request

The same checks CI runs:

```bash
npx tsc --noEmit
npm run lint
npm run test:ci
npm run build
```

End-to-end tests use Playwright, and need browsers installed once:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

If you changed anything under `python/`:

```bash
cd python && uv run pytest
```

If one fails for a reason you think is unrelated to your change, say so in the
pull request rather than working around it — that is useful information, and
sometimes it is CI that is wrong.

## What makes a pull request easy to review

- **One thing at a time.** A focused change gets reviewed quickly. A change that
  also reformats fifty unrelated lines is hard to read and slow to merge.
- **Say what you verified.** For a visual change, a before/after screenshot says
  more than a paragraph.
- **Ask early.** For anything substantial, open an issue first. It is much
  better to disagree about an approach before you have written it than after.
- **Draft PRs are fine.** Opening one early to ask "is this the right
  direction?" is welcome and costs nothing.

Reviews may take a few days — one maintainer, research alongside. A nudge on a
quiet pull request is welcome, not annoying.

## Conventions

Only the ones that are actually enforced:

- TypeScript must pass `tsc --noEmit`; no `any` added to escape it.
- Formatting and import order are handled by `eslint` — do not hand-tune them.
- A new dynamical system needs its parameters sourced to a paper or textbook,
  cited in the entry. An attractor that merely looks right is not enough.
- Keep the site static-exportable. `next build` must succeed without a server
  runtime, since it deploys as static output.

## Conduct and licence

Everyone taking part is asked to follow the
[openfluids Code of Conduct](https://github.com/openfluids/.github/blob/main/CODE_OF_CONDUCT.md).
It is short.

chaos-atlas is licensed under Apache-2.0, and contributions are accepted under
the same licence. See `LICENSE` and `NOTICE`.

Found a security problem? Please do not open a public issue — see the
[security policy](https://github.com/openfluids/chaos-atlas/security/policy).
