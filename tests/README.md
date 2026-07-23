# NeoPot test strategy

`npm run test` is the local release-confidence gate. It runs formatting, lint, type checking,
behavior coverage, static contracts, the production build, Electron journeys, and the performance
report. A correctness failure returns a non-zero exit code. Performance budget overruns are printed
as warnings and recorded under `test-results/`.

## Commands

- `npm run test`: complete local gate before committing or creating a release tag.
- `npm run test:fast`: executable unit, component, and integration behavior tests.
- `npm run test:coverage`: the fast suite plus full-source V8 coverage reports.
- `npm run test:contracts`: cross-file static invariants that cannot be proved by one runtime test.
- `npm run test:e2e`: Windows Electron journeys against the built `out/` application.

## Test layers

- `unit/`: business rules and adapters with controlled dependencies.
- `component/`: React behavior observed through accessible user interactions.
- `integration/`: real neighboring boundaries such as localhost sockets and temporary files.
- `e2e/`: compiled Main, preload, renderer, IPC, and window behavior in Electron.
- `contract/`: exact cross-file or security invariants only. A contract test must not claim that a
  runtime behavior works merely because a function name or source string exists.
- `shared/`: helpers used by durable tests.

## Test quality rules

1. Name the user behavior, business rule, failure contract, or security invariant being defended.
2. Cover independently breakable success, boundary, error, and state-transition paths.
3. Assert observable output or side effects, not internal symbol names or file existence.
4. Provider tests verify NeoPot request/response handling with controlled responses. They do not
   test whether DeepL, Google, Ollama, or Lingva is currently online.
5. A bug fix needs a regression test that fails against the broken implementation.
6. When executable behavior coverage replaces an implementation-shaped contract, remove or narrow
   the weaker contract instead of keeping duplicate confidence signals.

Coverage includes all applicable `src/**/*.{ts,tsx}` files, including files that no test imports.
An unexecuted file therefore appears as zero coverage instead of disappearing from the denominator.
