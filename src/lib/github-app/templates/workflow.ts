/**
 * GitHub Actions workflow template for the persona-cards repository.
 *
 * This workflow:
 *  1. Runs weekly and on manual dispatch
 *  2. Fetches the user's GitHub data (stars, repos, profile)
 *  3. Runs the persona engine to generate profile data
 *  4. Commits the results as `profile.json`
 *  5. Optionally builds a static HTML page for GitHub Pages
 */

/**
 * Returns the workflow YAML content for the generate-profile action.
 *
 * @param username  GitHub username the workflow generates a profile for.
 */
export function generateWorkflowYaml(username: string): string {
  return `# profiles.sh — Self-hosted persona card generation
# https://profiles.sh
#
# This workflow fetches your public GitHub data and runs the deterministic
# persona engine to produce profile.json (and optionally a static HTML page).
#
# Schedule: weekly (Sunday 00:00 UTC) + manual dispatch.

name: Generate Profile

on:
  schedule:
    - cron: "0 0 * * 0" # Every Sunday at midnight UTC
  workflow_dispatch: # Allow manual runs

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Fetch GitHub data & generate profile
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GITHUB_USERNAME: "${username}"
        run: |
          set -euo pipefail

          API="https://api.github.com"
          AUTH="Authorization: token $GITHUB_TOKEN"
          ACCEPT="Accept: application/vnd.github.v3+json"
          UA="User-Agent: persona-cards-action/1.0"

          echo "::group::Fetching profile"
          curl -sf -H "$AUTH" -H "$ACCEPT" -H "$UA" \\
            "$API/users/$GITHUB_USERNAME" > /tmp/profile.json
          echo "::endgroup::"

          echo "::group::Fetching repos"
          page=1; > /tmp/repos.json; echo "[" > /tmp/repos_all.json
          while true; do
            curl -sf -H "$AUTH" -H "$ACCEPT" -H "$UA" \\
              "$API/users/$GITHUB_USERNAME/repos?per_page=100&page=$page&sort=pushed" \\
              > /tmp/repos_page.json
            COUNT=$(jq length /tmp/repos_page.json)
            if [ "$COUNT" -eq 0 ]; then break; fi
            if [ "$page" -gt 1 ]; then echo "," >> /tmp/repos_all.json; fi
            jq -c '.[]' /tmp/repos_page.json >> /tmp/repos_all.json
            page=$((page + 1))
            if [ "$page" -gt 5 ]; then break; fi
          done
          echo "]" >> /tmp/repos_all.json
          # Fix JSON array formatting
          jq -s '[ .[][] ]' /tmp/repos_all.json > /tmp/repos.json 2>/dev/null || echo "[]" > /tmp/repos.json
          echo "::endgroup::"

          echo "::group::Fetching stars"
          page=1; > /tmp/stars.json; echo "[" > /tmp/stars_all.json
          while true; do
            curl -sf -H "$AUTH" -H "$ACCEPT" -H "$UA" \\
              "$API/users/$GITHUB_USERNAME/starred?per_page=100&page=$page" \\
              > /tmp/stars_page.json
            COUNT=$(jq length /tmp/stars_page.json)
            if [ "$COUNT" -eq 0 ]; then break; fi
            if [ "$page" -gt 1 ]; then echo "," >> /tmp/stars_all.json; fi
            jq -c '.[]' /tmp/stars_page.json >> /tmp/stars_all.json
            page=$((page + 1))
            if [ "$page" -gt 30 ]; then break; fi
          done
          echo "]" >> /tmp/stars_all.json
          jq -s '[ .[][] ]' /tmp/stars_all.json > /tmp/stars.json 2>/dev/null || echo "[]" > /tmp/stars.json
          echo "::endgroup::"

          echo "::group::Running persona engine"
          node generate.mjs
          echo "::endgroup::"

      - name: Commit profile data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add profile.json index.html
          git diff --cached --quiet && echo "No changes" && exit 0
          git commit -m "chore: update profile data [skip ci]"
          git push
`;
}
