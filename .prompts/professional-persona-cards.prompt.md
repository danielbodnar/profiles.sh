# Identity Deck — Professional Persona Profile Cards

## Project Overview

Build a multi-tenant SaaS platform called **Identity Deck** that generates beautiful, interactive professional persona profile cards for any GitHub user. The system analyzes a user's GitHub starred repos, owned repos, and profile data to automatically generate a set of "career persona" trading cards — each representing a facet of their professional identity.

**Live reference implementation (React prototype):** The original prototype was built as a single-user React artifact. This prompt contains the complete data model, design system, algorithms, and architecture to rebuild it as a multi-tenant SaaS deployed entirely on Cloudflare's developer platform.

**Critical constraint: NO AI/LLM agents.** All persona detection, skill scoring, and categorization must be done through deterministic algorithms — topic matching, language analysis, repo metadata parsing, and star pattern clustering. No API calls to OpenAI, Anthropic, or any LLM service.

---

## Architecture Overview

### Cloudflare Products to Use

| Product | Purpose |
|---------|---------|
| **Workers** | API endpoints, GitHub data fetching, persona computation engine, SSR |
| **KV** | Cache GitHub API responses (stars, repos, profile) with TTL |
| **D1** | Persistent storage for generated user profiles, persona data, customizations |
| **R2** | Store generated OG images, exported card images (PNG/SVG) |
| **Workers Static Assets** | Serve the frontend (Astro/Svelte/Solid static build) |
| **Durable Objects** | Rate limiting per GitHub user, job deduplication for concurrent requests |
| **Queues** | Background processing for users with 1000+ stars (paginated fetching) |
| **Pages Functions** (optional) | If using Astro adapter for Cloudflare |

### System Flow

```
User visits /:username
  → Worker checks D1 for cached profile
  → If stale/missing:
    → Enqueue background job (Queue)
    → Worker fetches GitHub API (paginated):
      - GET /users/:username (profile)
      - GET /users/:username/repos?per_page=100 (owned repos, paginate)
      - GET /users/:username/starred?per_page=100 (stars, paginate up to 30 pages)
    → Cache raw responses in KV (TTL: 24h)
    → Run Persona Engine (deterministic algorithms)
    → Store computed profile in D1
    → Generate OG image → R2
  → Return rendered page with persona cards
```

---

## Data Model

### GitHub Raw Data (cached in KV)

```
KV key: github:profile:{username}     → GitHub user profile JSON
KV key: github:repos:{username}       → Array of owned repos
KV key: github:stars:{username}:{page} → Paginated star pages
KV key: github:stars:{username}:meta   → { totalPages, fetchedAt, complete }
```

### Computed Profile (stored in D1)

```sql
CREATE TABLE profiles (
  username TEXT PRIMARY KEY,
  display_name TEXT,
  bio TEXT,
  location TEXT,
  email TEXT,
  blog TEXT,
  company TEXT,
  avatar_url TEXT,
  followers INTEGER,
  following INTEGER,
  public_repos INTEGER,
  created_at TEXT,           -- GitHub account creation
  computed_at TEXT,           -- When we last ran the persona engine
  github_data_hash TEXT,     -- Hash of raw data to detect changes
  raw_profile JSON,          -- Full GitHub profile response
  UNIQUE(username)
);

CREATE TABLE personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  persona_id TEXT NOT NULL,      -- e.g. "systems", "platform", "cloud"
  title TEXT NOT NULL,
  tagline TEXT,
  accent_color TEXT,
  icon TEXT,
  experience_label TEXT,         -- e.g. "25+ years", "Lifetime"
  years_active TEXT,             -- e.g. "2005 - Present"
  confidence REAL,               -- 0.0-1.0 how strong this persona is
  stats JSON,                    -- [[label, value], ...]
  stack JSON,                    -- [tech1, tech2, ...]
  details JSON,                  -- [detail1, detail2, ...]
  starred_repos JSON,            -- [repo1, repo2, ...] relevant stars
  employers JSON,                -- [employer1, ...] if provided
  links JSON,                    -- [{label, url}, ...]
  sort_order INTEGER,
  FOREIGN KEY (username) REFERENCES profiles(username),
  UNIQUE(username, persona_id)
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  tech JSON,                     -- [tech1, tech2, ...]
  persona_map JSON,              -- [persona_id1, persona_id2, ...]
  language TEXT,
  stars INTEGER,
  forks INTEGER,
  sort_order INTEGER,
  FOREIGN KEY (username) REFERENCES profiles(username)
);

CREATE TABLE radar_axes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  label TEXT NOT NULL,
  value INTEGER NOT NULL,        -- 0-100
  color TEXT,
  sort_order INTEGER,
  FOREIGN KEY (username) REFERENCES profiles(username)
);

CREATE TABLE star_interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  label TEXT NOT NULL,
  count TEXT,                    -- "15+ repos"
  examples TEXT,                 -- comma-separated repo names
  sort_order INTEGER,
  FOREIGN KEY (username) REFERENCES profiles(username)
);

CREATE TABLE customizations (
  username TEXT PRIMARY KEY,
  custom_taglines JSON,          -- {persona_id: "custom tagline"}
  custom_details JSON,           -- {persona_id: ["detail1", ...]}
  custom_employers JSON,         -- {persona_id: ["employer1", ...]}
  hidden_personas JSON,          -- ["persona_id1", ...]
  theme_overrides JSON,          -- {darkMode: true, ...}
  FOREIGN KEY (username) REFERENCES profiles(username)
);
```

---

## Persona Engine — The Core Algorithm

This is the heart of the system. It takes raw GitHub data and produces persona assignments with confidence scores. **No AI involved** — purely deterministic topic/language/metadata matching.

### Step 1: Build a Topic Vector from Stars

Each starred repo contributes signals via its `language`, `topics[]`, `description`, and repo name. Map these to a set of **domain buckets**.

#### Domain Bucket Definitions

```javascript
const DOMAIN_SIGNALS = {
  systems: {
    languages: ["C", "C++", "Rust", "Assembly", "Zig"],
    topics: ["kernel", "systems-programming", "embedded", "bare-metal", "systemd",
             "operating-system", "os", "hypervisor", "virtualization", "qemu",
             "kvm", "proxmox", "esxi", "zfs", "filesystem", "database",
             "postgresql", "performance", "profiling", "ebpf", "io-uring",
             "memory-management", "real-time", "driver", "firmware"],
    descriptionKeywords: ["kernel", "syscall", "bare metal", "hypervisor",
                          "low-level", "systems", "performance", "database",
                          "postgresql", "embedded", "firmware"],
  },
  platform: {
    languages: ["HCL", "Jsonnet", "Starlark", "Dhall"],
    topics: ["kubernetes", "k8s", "helm", "terraform", "ansible", "pulumi",
             "docker", "container", "ci-cd", "github-actions", "gitlab-ci",
             "jenkins", "argocd", "gitops", "infrastructure-as-code", "iac",
             "devops", "cdk", "cloudformation", "deployment", "pipeline",
             "buildpack", "nix", "nixos", "guix", "buildroot"],
    descriptionKeywords: ["deploy", "pipeline", "infrastructure", "orchestrat",
                          "ci/cd", "gitops", "provisioning", "automation",
                          "kubernetes", "helm", "terraform"],
  },
  software: {
    languages: ["TypeScript", "JavaScript", "Rust", "Go", "Python", "Ruby",
                "Java", "Kotlin", "Swift", "Scala", "Elixir", "Haskell",
                "OCaml", "F#", "Clojure"],
    topics: ["framework", "library", "sdk", "api", "web-framework", "orm",
             "testing", "compiler", "language", "parser", "ast", "wasm",
             "webassembly", "full-stack", "backend", "frontend", "react",
             "vue", "svelte", "solid", "angular", "nextjs", "nuxt", "astro",
             "bun", "deno", "node", "runtime"],
    descriptionKeywords: ["framework", "library", "compiler", "runtime",
                          "programming language", "web app", "full-stack",
                          "frontend", "backend", "api"],
  },
  cloud: {
    languages: [],
    topics: ["aws", "gcp", "azure", "cloudflare", "cloud", "serverless",
             "lambda", "edge", "cdn", "load-balancer", "vpn", "wireguard",
             "networking", "multi-cloud", "hybrid-cloud", "cloud-native",
             "saas", "paas", "iaas", "s3", "r2", "workers"],
    descriptionKeywords: ["cloud", "aws", "serverless", "edge", "cdn",
                          "distributed", "multi-cloud", "cloudflare",
                          "scalable", "load balanc", "vpn", "tunnel"],
  },
  linux: {
    languages: ["Shell", "Bash", "Nushell", "Fish", "Zsh", "Nix"],
    topics: ["linux", "unix", "shell", "bash", "zsh", "fish", "nushell",
             "terminal", "cli", "tui", "dotfiles", "rice", "ricing",
             "hyprland", "wayland", "sway", "i3", "window-manager", "wm",
             "desktop-environment", "gtk", "systemd", "arch", "debian",
             "ubuntu", "alpine", "nixos", "gentoo", "freebsd"],
    descriptionKeywords: ["linux", "terminal", "shell", "command-line", "cli",
                          "tui", "dotfiles", "window manager", "wayland",
                          "hyprland", "nushell", "systemd", "desktop"],
  },
  solutions: {
    languages: [],
    topics: ["documentation", "technical-writing", "api-design", "openapi",
             "json-schema", "graphql", "rest", "grpc", "protobuf",
             "architecture", "design-patterns", "microservices", "ddd",
             "event-driven", "cqrs", "consulting"],
    descriptionKeywords: ["documentation", "api design", "architecture",
                          "pattern", "microservice", "schema", "openapi",
                          "specification", "integration", "workflow"],
  },
  sre: {
    languages: [],
    topics: ["monitoring", "observability", "grafana", "prometheus", "alerting",
             "incident", "sre", "reliability", "uptime", "chaos-engineering",
             "load-testing", "benchmark", "tracing", "logging", "elk",
             "datadog", "newrelic", "pagerduty", "on-call", "runbook",
             "security", "vulnerability", "cve", "penetration-testing",
             "zero-trust", "authentication", "oauth", "sso"],
    descriptionKeywords: ["monitoring", "observability", "reliability",
                          "incident", "alert", "uptime", "chaos", "security",
                          "vulnerability", "penetration", "zero-trust",
                          "authentication"],
  },
  tinkerer: {
    languages: [],
    topics: ["side-project", "experiment", "prototype", "hack", "maker",
             "iot", "raspberry-pi", "arduino", "fpga", "3d-printing",
             "e-ink", "eink", "hardware", "robotics", "generative-art",
             "creative-coding", "procedural", "hobby", "weekend-project",
             "ai", "machine-learning", "llm", "gpt", "embeddings",
             "vector-database", "semantic-search", "ai-agent", "ai-coding",
             "stable-diffusion", "image-generation"],
    descriptionKeywords: ["experiment", "prototype", "toy", "hobby",
                          "weekend", "fun", "hack", "tinkering", "ai",
                          "llm", "embedding", "semantic", "machine learning",
                          "agent", "generative"],
  },
  hacker: {
    languages: ["Vim Script", "Lua", "Vimscript"],
    topics: ["neovim", "vim", "nvim", "editor", "ide", "terminal-emulator",
             "tmux", "zellij", "screen", "ghostty", "alacritty", "kitty",
             "wezterm", "helix", "kakoune", "emacs", "dotfiles",
             "command-line", "old-school", "retro", "vintage", "browser",
             "web-browser", "rss", "feed-reader", "bookmarks"],
    descriptionKeywords: ["neovim", "vim", "editor", "terminal", "browser",
                          "old school", "retro", "hacker", "rss", "feed",
                          "bookmark", "knowledge"],
  },
};
```

#### Scoring Algorithm

```javascript
function computeDomainScores(stars, ownedRepos) {
  const scores = {};
  for (const domain of Object.keys(DOMAIN_SIGNALS)) {
    scores[domain] = 0;
  }

  for (const repo of stars) {
    const lang = (repo.language || "").toLowerCase();
    const topics = (repo.topics || []).map(t => t.toLowerCase());
    const desc = (repo.description || "").toLowerCase();
    const name = (repo.full_name || "").toLowerCase();

    for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
      let repoScore = 0;

      // Language match: +2 points
      if (signals.languages.some(l => l.toLowerCase() === lang)) {
        repoScore += 2;
      }

      // Topic match: +3 points per matching topic
      const topicMatches = topics.filter(t =>
        signals.topics.some(st => t.includes(st) || st.includes(t))
      ).length;
      repoScore += topicMatches * 3;

      // Description keyword match: +1.5 per keyword
      const descMatches = signals.descriptionKeywords.filter(kw =>
        desc.includes(kw)
      ).length;
      repoScore += descMatches * 1.5;

      // Repo name match: +1 per keyword
      const nameMatches = signals.descriptionKeywords.filter(kw =>
        name.includes(kw)
      ).length;
      repoScore += nameMatches * 1;

      scores[domain] += repoScore;
    }
  }

  // Owned repos get 3x weight
  for (const repo of ownedRepos) {
    const lang = (repo.language || "").toLowerCase();
    const topics = (repo.topics || []).map(t => t.toLowerCase());
    const desc = (repo.description || "").toLowerCase();

    for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
      let repoScore = 0;
      if (signals.languages.some(l => l.toLowerCase() === lang)) repoScore += 2;
      const topicMatches = topics.filter(t =>
        signals.topics.some(st => t.includes(st) || st.includes(t))
      ).length;
      repoScore += topicMatches * 3;
      const descMatches = signals.descriptionKeywords.filter(kw =>
        desc.includes(kw)
      ).length;
      repoScore += descMatches * 1.5;

      scores[domain] += repoScore * 3; // 3x multiplier for owned repos
    }
  }

  return scores;
}
```

### Step 2: Normalize Scores to 0-100 Radar Values

```javascript
function normalizeToRadar(scores) {
  const values = Object.values(scores);
  const max = Math.max(...values);
  if (max === 0) return scores;

  const normalized = {};
  for (const [domain, score] of Object.entries(scores)) {
    // Scale to 40-100 range (minimum 40 if any signal detected)
    if (score > 0) {
      normalized[domain] = Math.round(40 + (score / max) * 60);
    } else {
      normalized[domain] = 0;
    }
  }
  return normalized;
}
```

### Step 3: Determine Active Personas

A persona is "active" if its normalized score exceeds a threshold (default: 45). Personas are ranked by confidence score.

```javascript
const PERSONA_THRESHOLD = 45;

function determinePersonas(normalizedScores) {
  return Object.entries(normalizedScores)
    .filter(([_, score]) => score >= PERSONA_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([domain, score], index) => ({
      persona_id: domain,
      confidence: score / 100,
      sort_order: index,
    }));
}
```

### Step 4: Cluster Stars into Interest Groups

Group starred repos by detected themes to create the "Star Interests" tiles.

```javascript
const INTEREST_CLUSTERS = {
  "Nushell Ecosystem": {
    match: (repo) => {
      const name = (repo.full_name || "").toLowerCase();
      const topics = (repo.topics || []).map(t => t.toLowerCase());
      const lang = (repo.language || "").toLowerCase();
      return name.includes("nushell") || name.includes(".nu") ||
             topics.includes("nushell") || lang === "nushell";
    }
  },
  "Neovim & Editor": {
    match: (repo) => {
      const n = (repo.full_name || "").toLowerCase();
      const t = (repo.topics || []).map(x => x.toLowerCase());
      return t.some(x => ["neovim", "nvim", "vim", "helix", "editor", "kakoune"].includes(x)) ||
             n.includes("nvim") || n.includes("neovim") || n.includes("helix");
    }
  },
  "React / Frontend": {
    match: (repo) => {
      const t = (repo.topics || []).map(x => x.toLowerCase());
      return t.some(x => ["react", "vue", "svelte", "solid", "frontend", "nextjs", "nuxt", "astro"].includes(x));
    }
  },
  "Rust Ecosystem": {
    match: (repo) => (repo.language || "").toLowerCase() === "rust"
  },
  "Security & Hacking": {
    match: (repo) => {
      const t = (repo.topics || []).map(x => x.toLowerCase());
      const d = (repo.description || "").toLowerCase();
      return t.some(x => ["security", "cve", "vulnerability", "penetration-testing",
                           "hacking", "exploit", "ctf", "cybersecurity"].includes(x)) ||
             d.includes("security") || d.includes("vulnerability") || d.includes("exploit");
    }
  },
  "AI & LLM": {
    match: (repo) => {
      const t = (repo.topics || []).map(x => x.toLowerCase());
      const d = (repo.description || "").toLowerCase();
      return t.some(x => ["ai", "llm", "machine-learning", "gpt", "embeddings",
                           "ai-agent", "openai", "anthropic"].includes(x)) ||
             d.includes("ai ") || d.includes("llm") || d.includes("machine learning");
    }
  },
  "DevOps & Infrastructure": {
    match: (repo) => {
      const t = (repo.topics || []).map(x => x.toLowerCase());
      return t.some(x => ["kubernetes", "docker", "terraform", "ansible", "devops",
                           "ci-cd", "infrastructure", "helm", "gitops"].includes(x));
    }
  },
  "CLI Tools": {
    match: (repo) => {
      const t = (repo.topics || []).map(x => x.toLowerCase());
      const d = (repo.description || "").toLowerCase();
      return t.some(x => ["cli", "command-line", "terminal", "tui"].includes(x)) ||
             d.includes("cli") || d.includes("command-line") || d.includes("terminal tool");
    }
  },
  "Desktop Apps": {
    match: (repo) => {
      const t = (repo.topics || []).map(x => x.toLowerCase());
      return t.some(x => ["tauri", "electron", "desktop", "gtk", "qt",
                           "cross-platform", "native-app"].includes(x));
    }
  },
  "Cloud & Edge": {
    match: (repo) => {
      const t = (repo.topics || []).map(x => x.toLowerCase());
      const d = (repo.description || "").toLowerCase();
      return t.some(x => ["cloudflare", "aws", "serverless", "edge", "workers",
                           "lambda", "vercel", "cloud"].includes(x)) ||
             d.includes("cloudflare") || d.includes("serverless") || d.includes("edge function");
    }
  },
  "Linux / Desktop": {
    match: (repo) => {
      const t = (repo.topics || []).map(x => x.toLowerCase());
      return t.some(x => ["linux", "wayland", "hyprland", "sway", "i3",
                           "window-manager", "desktop-environment", "systemd",
                           "dotfiles", "rice"].includes(x));
    }
  },
  "Static Sites & Blogs": {
    match: (repo) => {
      const t = (repo.topics || []).map(x => x.toLowerCase());
      const d = (repo.description || "").toLowerCase();
      return t.some(x => ["zola", "hugo", "jekyll", "static-site", "blog",
                           "astro", "ssg", "11ty"].includes(x)) ||
             d.includes("static site") || d.includes("blog theme");
    }
  },
};

function clusterStarInterests(stars) {
  const clusters = {};
  for (const [label, config] of Object.entries(INTEREST_CLUSTERS)) {
    const matching = stars.filter(config.match);
    if (matching.length >= 2) { // Only show clusters with 2+ repos
      clusters[label] = {
        count: matching.length >= 15 ? "15+ repos" :
               matching.length >= 10 ? "10+ repos" :
               matching.length >= 5 ? "5+ repos" :
               matching.length + " repos",
        examples: matching.slice(0, 5).map(r =>
          r.full_name.split("/")[1]
        ).join(", "),
        repos: matching,
      };
    }
  }
  // Sort by count descending
  return Object.entries(clusters)
    .sort((a, b) => b[1].repos.length - a[1].repos.length)
    .slice(0, 12); // Max 12 clusters
}
```

### Step 5: Generate Persona Details

For each active persona, generate the card content:

```javascript
const PERSONA_TEMPLATES = {
  systems: {
    title: "Systems Engineer",
    titlePrefixes: ["Principal", "Senior", "Staff", "Lead"],
    taglines: [
      "I speak fluent syscall.",
      "Closer to the metal than your bootloader.",
      "The kernel whisperer.",
    ],
    icon: "⚙️",
    accentColor: "#4A90D9",
    bgGradient: "linear-gradient(135deg, #0a1628 0%, #132744 100%)",
    statLabels: ["Architecture", "Debugging", "Scale", "Uptime"],
    stackPool: ["Linux", "systemd", "PostgreSQL", "ZFS", "Bare Metal",
                "Kernel Tuning", "Proxmox", "QEMU", "KVM", "InfiniBand",
                "NVMe", "io_uring", "eBPF", "Zig", "C"],
  },
  platform: {
    title: "Platform Engineer",
    titlePrefixes: ["Staff", "Senior", "Principal", "Lead"],
    taglines: [
      "Your deploy pipeline is my canvas.",
      "Infrastructure as Code, chaos as a service.",
      "I automate the automators.",
    ],
    icon: "🔗",
    accentColor: "#7C4DFF",
    bgGradient: "linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 100%)",
    statLabels: ["Pipelines", "Automation", "Tooling", "DX"],
    stackPool: ["Kubernetes", "Helm", "Terraform", "Ansible", "Docker",
                "GitLab CI/CD", "GitHub Actions", "AWS CDK", "Pulumi",
                "ArgoCD", "Nix", "Buildroot"],
  },
  software: {
    title: "Software Engineer",
    titlePrefixes: ["Staff", "Senior", "Principal", "Full Stack"],
    taglines: [
      "Types are a love language.",
      "I write code that writes code.",
      "Compilers fear me, runtimes love me.",
    ],
    icon: "λ",
    accentColor: "#00E676",
    bgGradient: "linear-gradient(135deg, #0a1a0f 0%, #132e1a 100%)",
    statLabels: ["Backend", "Frontend", "Systems", "Unix Phil."],
    stackPool: [], // Derived from user's actual languages
  },
  cloud: {
    title: "Cloud Architect",
    titlePrefixes: ["Principal", "Senior", "Lead", "Staff"],
    taglines: [
      "The cloud is just someone else's bare metal.",
      "Distributed by design, resilient by nature.",
      "Multi-cloud native, single-cloud fluent.",
    ],
    icon: "☁️",
    accentColor: "#40C4FF",
    bgGradient: "linear-gradient(135deg, #071825 0%, #0d2b45 100%)",
    statLabels: ["Design", "Security", "Scale", "Vision"],
    stackPool: ["AWS", "Cloudflare", "GCP", "Azure", "EKS", "Lambda",
                "Workers", "Multi-cloud", "VPN", "WireGuard", "E2E Encryption",
                "Serverless", "CDN", "Edge"],
  },
  linux: {
    title: "Linux Enthusiast",
    titlePrefixes: ["Crazy", "Passionate", "Devoted", "Obsessive"],
    taglines: [
      "btw, I use Linux.",
      "I don't use Linux. Linux uses me.",
      "Have you heard about our lord and savior, Tux?",
    ],
    icon: "🐧",
    accentColor: "#FFEB3B",
    bgGradient: "linear-gradient(135deg, #1a1800 0%, #2e2a05 100%)",
    statLabels: ["Passion", "Shell", "systemd", "Evangelism"],
    stackPool: [], // Derived from user's actual Linux stars
  },
  solutions: {
    title: "Solutions Engineer",
    titlePrefixes: ["Principal", "Senior", "Lead"],
    taglines: [
      "I translate between humans and machines.",
      "The bridge between what you want and what's possible.",
      "Architecture is a conversation.",
    ],
    icon: "🌉",
    accentColor: "#FF9800",
    bgGradient: "linear-gradient(135deg, #1a1005 0%, #2e1f0a 100%)",
    statLabels: ["Communication", "Problem Solving", "Empathy", "Breadth"],
    stackPool: ["OpenAPI", "JSON Schema", "REST", "GraphQL", "gRPC",
                "CQRS", "Event-Driven", "Microservices", "Service Mesh"],
  },
  sre: {
    title: "SRE",
    titlePrefixes: ["Principal", "Senior", "Staff", "Lead"],
    taglines: [
      "Sleep is for the well-monitored.",
      "Uptime is a lifestyle, not a metric.",
      "I break things professionally, so production doesn't.",
    ],
    icon: "📟",
    accentColor: "#FF5252",
    bgGradient: "linear-gradient(135deg, #1a0505 0%, #2e0f0f 100%)",
    statLabels: ["Reliability", "Incident Mgmt", "Observability", "Automation"],
    stackPool: ["Grafana", "Prometheus", "VictoriaMetrics", "Jaeger",
                "ELK", "Datadog", "PagerDuty", "Chaos Engineering"],
  },
  tinkerer: {
    title: "Chronic Tinkerer",
    titlePrefixes: [""],
    taglines: [
      "What if I just tried one more thing...",
      "My side projects have side projects.",
      "Focus score: 42.",
    ],
    icon: "🔧",
    accentColor: "#FFD54F",
    bgGradient: "linear-gradient(135deg, #1a1508 0%, #2e2510 100%)",
    statLabels: ["Curiosity", "Side Projects", "Focus", "Ambition"],
    stackPool: [], // Derived from user's eclectic stars
  },
  hacker: {
    title: "Old School Hacker",
    titlePrefixes: [""],
    taglines: [
      "The terminal is home.",
      "Learned by breaking things. Still does.",
      "Pre-cloud, pre-container, pre-everything.",
    ],
    icon: ">_",
    accentColor: "#00FF41",
    bgGradient: "linear-gradient(135deg, #000000 0%, #0a0a0a 100%)",
    statLabels: ["Grit", "Nostalgia", "Root Access", "Lore"],
    stackPool: ["Bare Metal", "The Terminal", "Shell", "Neovim",
                "vim", "Helix", "tmux", "Zellij", "Ghostty"],
  },
};
```

### Step 6: Map Owned Repos to Personas (Project Cards)

For each owned repo, determine which personas it maps to:

```javascript
function mapRepoToPersonas(repo, domainSignals) {
  const mapped = [];
  const lang = (repo.language || "").toLowerCase();
  const topics = (repo.topics || []).map(t => t.toLowerCase());
  const desc = (repo.description || "").toLowerCase();

  for (const [domain, signals] of Object.entries(domainSignals)) {
    let score = 0;
    if (signals.languages.some(l => l.toLowerCase() === lang)) score += 2;
    const topicHits = topics.filter(t =>
      signals.topics.some(st => t.includes(st) || st.includes(t))
    ).length;
    score += topicHits * 3;
    const descHits = signals.descriptionKeywords.filter(kw => desc.includes(kw)).length;
    score += descHits * 1.5;

    if (score >= 2) {
      mapped.push({ domain, score });
    }
  }

  return mapped.sort((a, b) => b.score - a.score).map(m => m.domain);
}
```

### Step 7: Estimate Experience Level

Use GitHub account age + activity signals:

```javascript
function estimateExperience(profile, domainScore, maxScore) {
  const accountAge = new Date().getFullYear() -
    new Date(profile.created_at).getFullYear();
  const ratio = domainScore / maxScore;

  if (ratio > 0.85 && accountAge > 8) return { prefix: "Principal", years: accountAge + "+ years" };
  if (ratio > 0.7 && accountAge > 5) return { prefix: "Staff", years: accountAge + "+ years" };
  if (ratio > 0.5 && accountAge > 3) return { prefix: "Senior", years: accountAge + "+ years" };
  if (ratio > 0.3) return { prefix: "", years: accountAge + "+ years" };
  return { prefix: "", years: "Active" };
}
```

---

## API Routes (Workers)

### Public API

```
GET /api/:username
  → Returns full computed profile as JSON
  → Triggers background computation if stale

GET /api/:username/personas
  → Returns persona cards only

GET /api/:username/projects
  → Returns project cards only

GET /api/:username/radar
  → Returns radar chart data

GET /api/:username/interests
  → Returns star interest clusters

GET /api/:username/og.png
  → Returns OG image from R2 (generate if missing)

POST /api/:username/refresh
  → Force re-computation (rate limited: 1/hour per user via Durable Object)

GET /api/:username/customize
POST /api/:username/customize
  → Read/write customizations (requires GitHub OAuth in future)
```

### Internal Workers

```
Worker: persona-engine
  → Bound to Queue consumer
  → Processes { username } messages
  → Fetches GitHub data, runs algorithm, writes to D1

Worker: og-generator
  → Generates OG images using @cloudflare/pages-plugin-satori
     or similar SVG→PNG pipeline
  → Stores result in R2
```

---

## Frontend Implementation

### Page Routes

```
/                    → Landing page with search box
/:username           → Full Identity Deck for that user
/:username/card/:id  → Single persona card (shareable)
/:username/embed     → Embeddable widget (iframe-friendly)
```

### Design System

The visual design is critical. Here are the exact specifications from the working prototype:

#### Color Palette (per persona)

```javascript
const PERSONA_COLORS = {
  systems:   { accent: "#4A90D9", bg: ["#0a1628", "#132744"] },
  platform:  { accent: "#7C4DFF", bg: ["#1a0a2e", "#2d1b4e"] },
  software:  { accent: "#00E676", bg: ["#0a1a0f", "#132e1a"] },
  cloud:     { accent: "#40C4FF", bg: ["#071825", "#0d2b45"] },
  linux:     { accent: "#FFEB3B", bg: ["#1a1800", "#2e2a05"] },
  solutions: { accent: "#FF9800", bg: ["#1a1005", "#2e1f0a"] },
  sre:       { accent: "#FF5252", bg: ["#1a0505", "#2e0f0f"] },
  dad:       { accent: "#F48FB1", bg: ["#1a0f15", "#2e1a28"] }, // Easter egg persona
  tinkerer:  { accent: "#FFD54F", bg: ["#1a1508", "#2e2510"] },
  hacker:    { accent: "#00FF41", bg: ["#000000", "#0a0a0a"] },
};
```

#### Page Background

```css
background: linear-gradient(180deg, #08080c 0%, #0e0e14 50%, #08080c 100%);
```

#### Typography

- All monospace: system monospace stack
- Headers: weight 200, letter-spacing -0.03em
- Body: weight 400
- Labels/metadata: uppercase, letter-spacing 2-4px

#### Card Dimensions

- Persona cards: 340×540px, border-radius 16px
- Project cards: 340px wide, auto height, border-radius 14px
- Cards have 1px border using `{accent}33` (20% opacity accent color)
- Box shadow: `0 4px 20px rgba(0,0,0,0.5)`

#### Card Front Layout (top to bottom)

1. **Header row**: Icon (42×42, rounded 10px, accent bg at 15% opacity) + card number badge
2. **Title**: 16-17px, bold, white
3. **Tagline**: 10-11px, italic, accent color, monospace, 80% opacity
4. **Stat bars**: Label (9px, right-aligned, 72px wide) → bar (5px tall, accent color fill) → value (8px)
5. **Stack badges**: Inline, 8-9px monospace, accent bg at 12% + accent border at 25%
6. **Starred repos**: 8-9px, bullet-separated, muted color
7. **Footer**: Name, email, location left; years active right; separated by 1px accent border at 15%

#### Card Back Layout

1. **"Field Notes" header**: 10px, accent, uppercase, letter-spacing 2
2. **Detail items**: Rounded boxes with left dot indicator, accent bg at 8%, 11px text
3. **Employers**: Label + bullet-separated list
4. **Links**: Accent-colored badge buttons with → arrow
5. **"tap to flip back"**: Centered at bottom, muted

#### Card Flip Animation

```css
perspective: 900px; /* on container */
transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
transform-style: preserve-3d;
backface-visibility: hidden;
/* Flipped: rotateY(180deg) */
```

#### Radar Chart (SVG)

- Size: 320×320
- Grid: 4 concentric polygons at 25%, 50%, 75%, 100%
- Axis lines from center to each vertex
- Data polygon: fill `rgba(100,200,255,0.12)`, stroke `rgba(100,200,255,0.6)`
- Data points: 3px circles in axis color
- Labels: 9px monospace, positioned at 112% of radius

#### Project Cards

- Left stripe: 6px wide, vertical linear gradient with segments colored per persona
- Each persona segment gets equal height percentage of the stripe
- Tech badges: neutral gray bg, 8-9px monospace
- Persona legend: Small colored squares (7×7) with persona short name

#### Star Interest Tiles

- Grid of 230px-wide tiles
- Subtle background: `rgba(255,255,255,0.03)` with `rgba(255,255,255,0.06)` border
- Label (10px, semibold) + count badge (8px, monospace, muted) on same line
- Examples: 8px, monospace, muted, comma-separated

---

## GitHub API Integration Details

### Rate Limiting

- Unauthenticated: 60 requests/hour (NOT enough for production)
- **You MUST implement GitHub App or OAuth App authentication**
- With auth token: 5,000 requests/hour
- Store token as Worker secret: `GITHUB_TOKEN`

### Pagination Strategy

Stars can be 5,000+ items. Use `Link` header pagination:

```javascript
async function fetchAllStars(username, token) {
  const stars = [];
  let page = 1;
  const maxPages = 30; // Cap at 3000 stars

  while (page <= maxPages) {
    const cacheKey = `github:stars:${username}:${page}`;
    let data = await KV.get(cacheKey, "json");

    if (!data) {
      const res = await fetch(
        `https://api.github.com/users/${username}/starred?per_page=100&page=${page}`,
        {
          headers: {
            "Authorization": `token ${token}`,
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "IdentityDeck/1.0",
          }
        }
      );

      if (res.status === 404) break;
      if (res.status === 403) throw new Error("Rate limited");

      data = await res.json();
      if (data.length === 0) break;

      // Cache for 24 hours
      await KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 86400 });
    }

    stars.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return stars;
}
```

### Queue-Based Processing for Large Profiles

For users with many stars, use Cloudflare Queues to avoid Worker CPU time limits:

```javascript
// Producer (API Worker)
export default {
  async fetch(request, env) {
    const username = getUsername(request);
    const profile = await env.DB.prepare(
      "SELECT * FROM profiles WHERE username = ? AND computed_at > datetime('now', '-24 hours')"
    ).bind(username).first();

    if (profile) {
      return Response.json(profile);
    }

    // Enqueue background job
    await env.PROFILE_QUEUE.send({ username, requestedAt: Date.now() });

    // Return partial response or loading state
    return Response.json({ status: "computing", username }, { status: 202 });
  }
};

// Consumer (Queue Worker)
export default {
  async queue(batch, env) {
    for (const msg of batch.messages) {
      const { username } = msg.body;
      await computeProfile(username, env);
      msg.ack();
    }
  }
};
```

---

## Durable Object: Rate Limiter

```javascript
export class RateLimiter {
  constructor(state, env) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const username = url.searchParams.get("username");
    const action = url.searchParams.get("action"); // "check" or "consume"

    const key = `ratelimit:${username}`;
    const existing = await this.state.storage.get(key);

    if (action === "check") {
      if (existing && Date.now() - existing < 3600000) {
        return Response.json({ allowed: false, retryAfter: 3600 - Math.floor((Date.now() - existing) / 1000) });
      }
      return Response.json({ allowed: true });
    }

    if (action === "consume") {
      await this.state.storage.put(key, Date.now());
      return Response.json({ consumed: true });
    }
  }
}
```

---

## OG Image Generation

Generate shareable preview images stored in R2:

```javascript
// Use @vercel/og-compatible approach with satori + resvg-wasm
// or use Cloudflare Browser Rendering API

async function generateOGImage(profile, personas, env) {
  const key = `og/${profile.username}.png`;

  // Check R2 first
  const existing = await env.R2.get(key);
  if (existing) return existing;

  // Generate SVG using satori or HTML template
  const svg = renderOGTemplate(profile, personas);

  // Convert to PNG (use resvg-wasm or Browser Rendering)
  const png = await svgToPng(svg);

  // Store in R2
  await env.R2.put(key, png, {
    httpMetadata: { contentType: "image/png" },
    customMetadata: { username: profile.username, generatedAt: new Date().toISOString() },
  });

  return png;
}
```

---

## Wrangler Configuration

```toml
name = "identity-deck"
main = "src/worker.ts"
compatibility_date = "2025-02-01"

[vars]
ENVIRONMENT = "production"

[[kv_namespaces]]
binding = "KV"
id = "xxx"

[[d1_databases]]
binding = "DB"
database_name = "identity-deck"
database_id = "xxx"

[[r2_buckets]]
binding = "R2"
bucket_name = "identity-deck-assets"

[[queues.producers]]
binding = "PROFILE_QUEUE"
queue = "profile-computation"

[[queues.consumers]]
queue = "profile-computation"
max_batch_size = 5
max_batch_timeout = 30

[[durable_objects.bindings]]
name = "RATE_LIMITER"
class_name = "RateLimiter"

[[migrations]]
tag = "v1"
new_classes = ["RateLimiter"]

[site]
bucket = "./dist" # Static site build output
```

---

## Implementation Checklist

### Phase 1: Core Engine
- [ ] Set up Wrangler project with D1, KV, R2, Queue bindings
- [ ] Implement GitHub API fetcher with pagination and KV caching
- [ ] Implement domain scoring algorithm (Step 1-2)
- [ ] Implement persona determination (Step 3)
- [ ] Implement star interest clustering (Step 4)
- [ ] Implement persona detail generation (Step 5)
- [ ] Implement repo-to-persona mapping (Step 6)
- [ ] Write D1 schema migrations
- [ ] Queue consumer for background processing

### Phase 2: API Layer
- [ ] GET /api/:username — full profile
- [ ] GET /api/:username/personas — persona cards
- [ ] GET /api/:username/projects — project cards
- [ ] GET /api/:username/radar — radar data
- [ ] POST /api/:username/refresh — force refresh
- [ ] Durable Object rate limiter
- [ ] Error handling and 404s for non-existent users

### Phase 3: Frontend
- [ ] Landing page with username search
- [ ] Profile page (/:username) with all sections
- [ ] Radar chart (SVG component)
- [ ] Star interest tiles grid
- [ ] Persona card component with flip animation
- [ ] Project card component with persona color stripe
- [ ] Color legend bar
- [ ] Loading/computing state UI
- [ ] Responsive design (mobile: single column, desktop: grid)
- [ ] Meta tags and OG image integration

### Phase 4: Polish
- [ ] OG image generation pipeline
- [ ] Embeddable widget route
- [ ] Single card shareable route
- [ ] GitHub OAuth for customizations
- [ ] Custom taglines, hidden personas, theme overrides
- [ ] Cache invalidation strategy
- [ ] Error boundaries and fallback states

---

## Reference Data: Original Prototype

The original prototype for user `danielbodnar` produced these persona cards. Use this as the gold standard for what the algorithm should produce for a user with his GitHub profile (89 repos, 5k+ stars, heavy Linux/Rust/TypeScript/infrastructure orientation):

**Active Personas (10):** Systems Engineer, Platform Engineer, Software Engineer, Cloud Architect, Linux Evangelist, Solutions Engineer, SRE, Dad (easter egg — always lowest confidence, manually opt-in), Chronic Tinkerer, Old School Hacker

**Radar Values:** Rust/Systems: 92, Platform/IaC: 96, TypeScript/JS: 95, Cloud/Infra: 94, Linux/Desktop: 99, Security: 85, AI/LLM: 88, Neovim/Editor: 90

**Star Interest Clusters:** Nushell (15+), Neovim (12+), Hyprland/Wayland (10+), Rust CLI (20+), Security (10+), AI Agent Coding (15+), Tauri (8+), Zola (6+), Cloudflare (8+), RSS/Knowledge (6+)

**Featured Projects (10):** ngfw.sh, BitBuilder Hypervisor, bbctl, cloudx.sh, bbos, bkmr, AnthropicFS, sessions.nu, TrustTunnel, knowledge

Each project card has a left-side multi-color stripe showing which personas it maps to, with a small legend below the tech badges.
