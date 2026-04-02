# CI/CD Guide

## How it works

Two GitHub Actions workflows handle builds and releases automatically.

### Build workflow (`build.yml`)

- **Trigger**: Every push to `main`
- **What it does**: Builds for Windows, Linux, macOS (both Intel + Apple Silicon)
- **Where**: Artifacts appear on the Actions tab → click a run → scroll down to "Artifacts"
- **Artifacts expire after 30 days**

### Release workflow (`release.yml`)

- **Trigger**: Push a `v*` tag (e.g. `v0.1.0`, `v1.2.3`)
- **What it does**: Builds + creates a **draft** GitHub Release
- **Draft means**: It's not public until YOU review and publish it

## Creating a release

### 1. Bump the version

Edit `src-tauri/tauri.conf.json` and update the version:

```json
{
  "version": "0.2.0"
}
```

Also update `package.json` if you want them to match:

```json
{
  "version": "0.2.0"
}
```

### 2. Commit and push

```sh
git add .
git commit -m "bump version to 0.2.0"
git push
```

### 3. Tag and push the tag

```sh
git tag v0.2.0
git push origin v0.2.0
```

### 4. Wait for the build

Go to your repo → **Actions** tab → watch the release workflow run.

### 5. Review and publish

Go to **Releases** → you'll see a draft release with auto-generated release notes.

- Review the notes (edit if needed)
- Attach any extra files if you want
- Click **Publish release**

That's it.

## Getting artifacts from main builds

1. Go to your repo → **Actions** tab
2. Click the latest successful "Build" run
3. Scroll down to **Artifacts**
4. Download the platform you need

## Labels for release notes

The `.github/release.yml` file controls how release notes are auto-generated.
Use these labels on PRs to categorize them:

| Label | Category |
|-------|----------|
| `feature`, `enhancement` | Features |
| `bug`, `bugfix`, `fix` | Bug Fixes |
| `breaking-change` | Breaking Changes |
| `improvement`, `refactor`, `performance` | Improvements |
| `dependencies` | Dependencies |

PRs without a label go into "Other Changes".

## Useful commands

```sh
# See current tags
git tag

# Delete a local tag (if you made a mistake)
git tag -d v0.2.0

# Delete a remote tag
git push origin --delete v0.2.0

# Check what version is set
cat src-tauri/tauri.conf.json | grep version
```
