# Releasing

The packages in `packages/` that aren't private (`guardrails`, `vite-config`,
`start-hono` and `hook-form-query`) are published to npm under `@arsw`. A
release is a pull request from `main` merged into `release`.

## Branches

- **`main`** is where all development happens, by pull request, with **CI
  Result** required.
- **`release`** is what's published. It moves only by a pull request from `main`
  (the **From Main** check), merged with a merge commit, so it keeps `main`'s
  history.

## Releasing a version

1. **Bump the versions on `main`,** in the last pull request before the release:
   - `version` in each changed package's `package.json`;
   - a `## <version>` section in its `CHANGELOG.md`, saying what's new (for
     guardrails, which rules).
2. **Merge `main` into `release`** by pull request:

   ```sh
   gh pr create --base release --head main --title "[release] start-hono 0.2.0" --body "Releases @arsw/start-hono 0.2.0."
   ```

   Merging it starts the release workflow.

3. **Approve the run:** it waits in the `npm-publish` environment until a
   reviewer approves it (Actions → the run → **Review deployments**).
4. **The workflow stages** each package whose version hasn't been released:
   - it builds and packs them, with no credentials;
   - it stages each tarball on npm as the package's trusted publisher, so no
     token is stored anywhere, and npm adds provenance;
   - it tags each version (`start-hono@0.2.0`) and creates its GitHub Release,
     with that version's changelog section as its notes.
5. **Approve each staged version on npm,** which publishes it. npm asks for 2FA,
   so the workflow alone can't publish:

   ```sh
   npm stage list @arsw/<name>
   npm stage approve <stage-id>
   ```

   Or on npmjs.com, the package's **Staged Packages** tab → **Approve**.

## A new package

npm sets up a trusted publisher only for a package that already exists, so a
package's first version can't come from the workflow. Once per package:

1. **Publish an empty placeholder by hand,** signed in to npm (`npm login`):

   ```sh
   dir=$(mktemp -d)
   printf '{\n  "name": "@arsw/<name>",\n  "version": "0.0.0",\n  "license": "MIT"\n}\n' > "$dir/package.json"
   (cd "$dir" && npm publish --access public)
   ```

2. **Trust the workflow:** on npmjs.com, the package → **Settings** → **Trusted
   Publisher** → **GitHub Actions**: user `arsw-dev`, repository `starter`,
   workflow `release.yml`, environment `npm-publish`. Leave **Allow
   `npm publish`** unchecked: the workflow only stages.
3. **Deprecate the placeholder:**

   ```sh
   npm deprecate "@arsw/<name>@0.0.0" "A placeholder: use 0.1.0 or later"
   ```

4. **Release its first version** as above.

## The first release

`release` doesn't exist until the first release. Once every package has its
placeholder and its trusted publisher (above), create it at `main`'s head.
Creating it is a push to `release`, so it starts the release workflow:

```sh
gh api repos/arsw-dev/starter/git/refs -f ref=refs/heads/release \
  -f sha="$(gh api repos/arsw-dev/starter/commits/main -q .sha)"
```

Then approve the run, and each staged version on npm. Every release after it is
a pull request from `main`.

## Good to know

- **Forgot a version bump?** A package whose version already has its GitHub
  Release is skipped, and when none is new, the workflow ends after packing.
- **A run that fails** can be re-run once the cause is fixed, its failed jobs or
  all of them: a version with its GitHub Release is skipped, and one npm already
  has live isn't staged again.
- **A staged version you reject** keeps its tag and GitHub Release, so the
  workflow won't stage it again: release the fix as a new version.
- **One package depending on another** goes live after it: approve `guardrails`
  before `vite-config`, which depends on it.
- **Before 1.0,** a minor version may break what it exports; a patch never does.
- **A new version reaches other repos 3 days later.** A repo that holds releases
  back (`minimumReleaseAge`) can take a version once it's 3 days old: add it
  then, by its exact version. Before that, `pnpm add @arsw/<name>` takes the
  newest version old enough, which right after a package's first release is its
  empty placeholder.
