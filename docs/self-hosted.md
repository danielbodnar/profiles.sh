# Self-Hosted Persona Cards

Host your [profiles.sh](https://profiles.sh) persona cards from your own GitHub
repository. Your profile data stays under your control and can be served via
GitHub Pages — no external services required.

## Quick Start (GitHub App)

The easiest path is the one-click GitHub App:

1. Go to [profiles.sh/app/setup](https://profiles.sh/app/setup)
2. Click **Install GitHub App**
3. The app creates a `persona-cards` repo in your account with everything
   pre-configured
4. Enable GitHub Pages in the repo settings (Settings → Pages → main branch)
5. Visit `https://<username>.github.io/persona-cards`

## Manual Setup

If you prefer not to use the GitHub App, follow these steps.

### 1. Create the repository

```bash
gh repo create persona-cards --public --clone
cd persona-cards
```

### 2. Add the workflow

Create `.github/workflows/generate-profile.yml`:

```yaml
name: Generate Profile

on:
  schedule:
    - cron: "0 0 * * 0" # Every Sunday at midnight UTC
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Fetch GitHub data & generate profile
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_USERNAME: "<YOUR_USERNAME>"
        run: |
          set -euo pipefail
          API="https://api.github.com"
          AUTH="Authorization: token $GITHUB_TOKEN"
          ACCEPT="Accept: application/vnd.github.v3+json"
          UA="User-Agent: persona-cards-action/1.0"

          # Fetch profile
          curl -sf -H "$AUTH" -H "$ACCEPT" -H "$UA" \
            "$API/users/$GITHUB_USERNAME" > /tmp/profile.json

          # Fetch repos (up to 500)
          page=1; echo "[" > /tmp/repos_all.json
          while true; do
            curl -sf -H "$AUTH" -H "$ACCEPT" -H "$UA" \
              "$API/users/$GITHUB_USERNAME/repos?per_page=100&page=$page&sort=pushed" \
              > /tmp/repos_page.json
            COUNT=$(jq length /tmp/repos_page.json)
            [ "$COUNT" -eq 0 ] && break
            [ "$page" -gt 1 ] && echo "," >> /tmp/repos_all.json
            jq -c '.[]' /tmp/repos_page.json >> /tmp/repos_all.json
            page=$((page + 1))
            [ "$page" -gt 5 ] && break
          done
          echo "]" >> /tmp/repos_all.json
          jq -s '[ .[][] ]' /tmp/repos_all.json > /tmp/repos.json 2>/dev/null || echo "[]" > /tmp/repos.json

          # Fetch stars (up to 3000)
          page=1; echo "[" > /tmp/stars_all.json
          while true; do
            curl -sf -H "$AUTH" -H "$ACCEPT" -H "$UA" \
              "$API/users/$GITHUB_USERNAME/starred?per_page=100&page=$page" \
              > /tmp/stars_page.json
            COUNT=$(jq length /tmp/stars_page.json)
            [ "$COUNT" -eq 0 ] && break
            [ "$page" -gt 1 ] && echo "," >> /tmp/stars_all.json
            jq -c '.[]' /tmp/stars_page.json >> /tmp/stars_all.json
            page=$((page + 1))
            [ "$page" -gt 30 ] && break
          done
          echo "]" >> /tmp/stars_all.json
          jq -s '[ .[][] ]' /tmp/stars_all.json > /tmp/stars.json 2>/dev/null || echo "[]" > /tmp/stars.json

          # Run persona engine
          node generate.mjs

      - name: Commit profile data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add profile.json index.html
          git diff --cached --quiet && echo "No changes" && exit 0
          git commit -m "chore: update profile data [skip ci]"
          git push
```

Replace `<YOUR_USERNAME>` with your GitHub username.

### 3. Add the generator script

Create `generate.mjs` in the repo root. The script reads the raw API data from
`/tmp` and produces `profile.json` + `index.html`. You can copy the reference
implementation from:

```
https://profiles.sh/api/github-app/manifest
```

Or write your own — the only requirement is that `profile.json` conforms to the
[self-hosted profile schema](#json-schema).

### 4. Enable GitHub Pages

1. Go to **Settings → Pages**
2. Set the source to the **main** branch
3. Save

Your profile will be live at `https://<username>.github.io/persona-cards`.

## JSON Schema

The `profile.json` file follows this structure:

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2025-01-15T00:00:00.000Z",
  "username": "octocat",
  "data": {
    "profile": {
      "username": "octocat",
      "display_name": "The Octocat",
      "bio": "...",
      "location": "San Francisco",
      "email": "",
      "blog": "https://github.blog",
      "company": "@github",
      "avatar_url": "https://avatars.githubusercontent.com/u/...",
      "followers": 1000,
      "following": 10,
      "public_repos": 50,
      "created_at": "2011-01-25T18:44:36Z"
    },
    "personas": [...],
    "projects": [...],
    "radar_axes": [...],
    "star_interests": [...],
    "aggregates": [...]
  }
}
```

The full JSON Schema definition is available at:

```
GET /api/github-app/manifest → default_permissions
```

Or in the source code at `src/lib/github-app/schema.ts`.

## How Scoring Works

The persona engine is fully deterministic — no AI or LLM calls:

| Signal            | Points | Source         |
|-------------------|--------|---------------|
| Language match    | +2     | Repo language  |
| Topic match       | +3     | Repo topics    |
| Description keyword | +1.5 | Repo description |
| Name keyword      | +1     | Repo name      |

Owned repos receive a **3× multiplier**. Scores are normalized to a 40–100
range, and personas with a score ≥ 45 are activated.

## Consuming Self-Hosted Data

The main profiles.sh app can fetch your `profile.json` as an alternative data
source:

```
https://<username>.github.io/persona-cards/profile.json
```

This means your profile stays available even if the profiles.sh service is down.

## Uninstalling

- **Keep the repo**: Simply uninstall the GitHub App from your settings. The
  `persona-cards` repo and all generated data remain yours.
- **Remove everything**: Delete the `persona-cards` repo from your GitHub
  settings, then uninstall the app.

## Troubleshooting

**Workflow fails with 403**: The `GITHUB_TOKEN` provided by Actions has limited
scope. For fetching stars of other users, you may need to create a personal
access token and add it as a repo secret.

**No personas generated**: You need at least a few repos or stars that match the
scoring signals. Check the [scoring table](#how-scoring-works) above.

**Pages not updating**: Make sure GitHub Pages is set to deploy from the `main`
branch and that the workflow commit pushed successfully.
