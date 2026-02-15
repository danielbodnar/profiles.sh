export interface DomainSignal {
  languages: string[];
  topics: string[];
  descriptionKeywords: string[];
}

export const DOMAIN_SIGNALS: Record<string, DomainSignal> = {
  systems: {
    languages: ["C", "C++", "Rust", "Assembly", "Zig"],
    topics: [
      "kernel", "systems-programming", "embedded", "bare-metal", "systemd",
      "operating-system", "os", "hypervisor", "virtualization", "qemu",
      "kvm", "proxmox", "esxi", "zfs", "filesystem", "database",
      "postgresql", "performance", "profiling", "ebpf", "io-uring",
      "memory-management", "real-time", "driver", "firmware",
    ],
    descriptionKeywords: [
      "kernel", "syscall", "bare metal", "hypervisor",
      "low-level", "systems", "performance", "database",
      "postgresql", "embedded", "firmware",
    ],
  },
  platform: {
    languages: ["HCL", "Jsonnet", "Starlark", "Dhall"],
    topics: [
      "kubernetes", "k8s", "helm", "terraform", "ansible", "pulumi",
      "docker", "container", "ci-cd", "github-actions", "gitlab-ci",
      "jenkins", "argocd", "gitops", "infrastructure-as-code", "iac",
      "devops", "cdk", "cloudformation", "deployment", "pipeline",
      "buildpack", "nix", "nixos", "guix", "buildroot",
    ],
    descriptionKeywords: [
      "deploy", "pipeline", "infrastructure", "orchestrat",
      "ci/cd", "gitops", "provisioning", "automation",
      "kubernetes", "helm", "terraform",
    ],
  },
  software: {
    languages: [
      "TypeScript", "JavaScript", "Rust", "Go", "Python", "Ruby",
      "Java", "Kotlin", "Swift", "Scala", "Elixir", "Haskell",
      "OCaml", "F#", "Clojure",
    ],
    topics: [
      "framework", "library", "sdk", "api", "web-framework", "orm",
      "testing", "compiler", "language", "parser", "ast", "wasm",
      "webassembly", "full-stack", "backend", "frontend", "react",
      "vue", "svelte", "solid", "angular", "nextjs", "nuxt", "astro",
      "bun", "deno", "node", "runtime",
    ],
    descriptionKeywords: [
      "framework", "library", "compiler", "runtime",
      "programming language", "web app", "full-stack",
      "frontend", "backend", "api",
    ],
  },
  cloud: {
    languages: [],
    topics: [
      "aws", "gcp", "azure", "cloudflare", "cloud", "serverless",
      "lambda", "edge", "cdn", "load-balancer", "vpn", "wireguard",
      "networking", "multi-cloud", "hybrid-cloud", "cloud-native",
      "saas", "paas", "iaas", "s3", "r2", "workers",
    ],
    descriptionKeywords: [
      "cloud", "aws", "serverless", "edge", "cdn",
      "distributed", "multi-cloud", "cloudflare",
      "scalable", "load balanc", "vpn", "tunnel",
    ],
  },
  linux: {
    languages: ["Shell", "Bash", "Nushell", "Fish", "Zsh", "Nix"],
    topics: [
      "linux", "unix", "shell", "bash", "zsh", "fish", "nushell",
      "terminal", "cli", "tui", "dotfiles", "rice", "ricing",
      "hyprland", "wayland", "sway", "i3", "window-manager", "wm",
      "desktop-environment", "gtk", "systemd", "arch", "debian",
      "ubuntu", "alpine", "nixos", "gentoo", "freebsd",
    ],
    descriptionKeywords: [
      "linux", "terminal", "shell", "command-line", "cli",
      "tui", "dotfiles", "window manager", "wayland",
      "hyprland", "nushell", "systemd", "desktop",
    ],
  },
  solutions: {
    languages: [],
    topics: [
      "documentation", "technical-writing", "api-design", "openapi",
      "json-schema", "graphql", "rest", "grpc", "protobuf",
      "architecture", "design-patterns", "microservices", "ddd",
      "event-driven", "cqrs", "consulting",
    ],
    descriptionKeywords: [
      "documentation", "api design", "architecture",
      "pattern", "microservice", "schema", "openapi",
      "specification", "integration", "workflow",
    ],
  },
  sre: {
    languages: [],
    topics: [
      "monitoring", "observability", "grafana", "prometheus", "alerting",
      "incident", "sre", "reliability", "uptime", "chaos-engineering",
      "load-testing", "benchmark", "tracing", "logging", "elk",
      "datadog", "newrelic", "pagerduty", "on-call", "runbook",
      "security", "vulnerability", "cve", "penetration-testing",
      "zero-trust", "authentication", "oauth", "sso",
    ],
    descriptionKeywords: [
      "monitoring", "observability", "reliability",
      "incident", "alert", "uptime", "chaos", "security",
      "vulnerability", "penetration", "zero-trust",
      "authentication",
    ],
  },
  tinkerer: {
    languages: [],
    topics: [
      "side-project", "experiment", "prototype", "hack", "maker",
      "iot", "raspberry-pi", "arduino", "fpga", "3d-printing",
      "e-ink", "eink", "hardware", "robotics", "generative-art",
      "creative-coding", "procedural", "hobby", "weekend-project",
      "ai", "machine-learning", "llm", "gpt", "embeddings",
      "vector-database", "semantic-search", "ai-agent", "ai-coding",
      "stable-diffusion", "image-generation",
    ],
    descriptionKeywords: [
      "experiment", "prototype", "toy", "hobby",
      "weekend", "fun", "hack", "tinkering", "ai",
      "llm", "embedding", "semantic", "machine learning",
      "agent", "generative",
    ],
  },
  hacker: {
    languages: ["Vim Script", "Lua", "Vimscript"],
    topics: [
      "neovim", "vim", "nvim", "editor", "ide", "terminal-emulator",
      "tmux", "zellij", "screen", "ghostty", "alacritty", "kitty",
      "wezterm", "helix", "kakoune", "emacs", "dotfiles",
      "command-line", "old-school", "retro", "vintage", "browser",
      "web-browser", "rss", "feed-reader", "bookmarks",
    ],
    descriptionKeywords: [
      "neovim", "vim", "editor", "terminal", "browser",
      "old school", "retro", "hacker", "rss", "feed",
      "bookmark", "knowledge",
    ],
  },
};
