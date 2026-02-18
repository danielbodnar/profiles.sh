/**
 * README template for the persona-cards repository.
 */

export function generateReadme(username: string): string {
  return `# persona-cards

Self-hosted [profiles.sh](https://profiles.sh) persona cards for **@${username}**.

## How it works

A GitHub Actions workflow runs weekly (and on manual dispatch) to:

1. Fetch your public GitHub data (profile, repos, stars)
2. Run the deterministic persona engine to score and classify your work
3. Commit \`profile.json\` and \`index.html\` to this repo

No AI or LLM calls — scoring is 100 % deterministic based on language, topic,
and keyword matching.

## View your profile

- **GitHub Pages**: [${username}.github.io/persona-cards](https://${username}.github.io/persona-cards)
- **profiles.sh**: [profiles.sh/${username}](https://profiles.sh/${username})

## Manual refresh

Go to **Actions → Generate Profile → Run workflow** to regenerate immediately.

## Files

| File | Description |
|------|-------------|
| \`profile.json\` | Cached profile data (JSON schema v1.0.0) |
| \`index.html\` | Static HTML page for GitHub Pages |
| \`generate.mjs\` | Standalone profile generation script |
| \`.github/workflows/generate-profile.yml\` | Scheduled workflow |

## Customization

Edit \`generate.mjs\` to tweak scoring weights, add new categories, or change
the HTML template.

## License

[MIT](https://opensource.org/licenses/MIT)
`;
}
