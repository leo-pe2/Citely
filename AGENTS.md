# Repository Guidelines

## Project Structure & Module Organization
- Electron entry points live in `src/electron` (`main.ts`, `preload.cts`, `util.ts`); gate file-system work and native calls there.
- The renderer app sits in `src/ui`, organized by domain: `pages` for routes, `features` for stateful modules, `components` for shared pieces, `lib` for utilities, and `assets` for static media.
- Tooling configs (Vite, Tailwind, TypeScript) stay at the root, while build output drops into `dist-react` and `dist-electron`; never edit generated files.
- Use the path aliases from `tsconfig.json` (`@/` → `src/ui`, `@features/` → `src/ui/features`) instead of deep relative imports.

## Build, Test, and Development Commands
- `npm install` – install dependencies whenever `package.json` changes.
- `npm run dev` – launch the Vite dev server and Electron shell together for fast feedback.
- `npm run build` – type-check and emit production bundles for the renderer.
- `npm run transpile:electron` – compile main-process TypeScript before testing Electron-specific changes.
- `npm run lint` – apply the ESLint rule set; append `-- --fix` for quick wins.
- `npm run preview` – serve the built renderer outside Electron for smoke-testing.
- `npm run dist:mac|dist:win|dist:linux` – bundle installable artifacts per platform.


## Coding Style & Naming Conventions
- TypeScript is strict; resolve compiler errors promptly and add explicit return types on exported helpers.
- Favor functional React components, PascalCase component files (`MyWidget.tsx`), and camelCase utilities.
- Tailwind 4 handles styling; compose utility classes in JSX and keep custom tokens in `src/ui/styles`.
- ESLint covers modern JS/TS, React Hooks, and Vite refresh rules—lint before opening a PR.

## Testing Guidelines
- No automated suite exists yet; add Vitest or Testing Library coverage in `src/ui/__tests__` or adjacent `*.test.ts(x)` files when introducing logic-heavy changes.
- Document manual verification steps in the PR, especially for Electron flows like screenshot capture or local DB updates.
- Guard regressions by mocking Electron bridges (`window.api` from `preload.cts`) and validating empty or malformed data sets.

## Commit & Pull Request Guidelines
- Follow the existing history: single-sentence, present-tense commit subjects that summarize the behavioral change (e.g., `Improve highlight timeline rendering`).
- Keep commits scoped; split refactors from feature work so reviewers can parse changes quickly.
- PRs should link issues, flag risks, and include screenshots or clips for UI updates.
- Mention any migrations or manual steps required post-merge (e.g., new database schema) in the PR description.
