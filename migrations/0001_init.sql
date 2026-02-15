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
  created_at TEXT,
  computed_at TEXT,
  github_data_hash TEXT,
  raw_profile TEXT,
  UNIQUE(username)
);

CREATE TABLE personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  title TEXT NOT NULL,
  tagline TEXT,
  accent_color TEXT,
  icon TEXT,
  experience_label TEXT,
  years_active TEXT,
  confidence REAL,
  stats TEXT,
  stack TEXT,
  details TEXT,
  starred_repos TEXT,
  employers TEXT,
  links TEXT,
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
  tech TEXT,
  persona_map TEXT,
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
  value INTEGER NOT NULL,
  color TEXT,
  sort_order INTEGER,
  FOREIGN KEY (username) REFERENCES profiles(username)
);

CREATE TABLE star_interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  label TEXT NOT NULL,
  count TEXT,
  examples TEXT,
  sort_order INTEGER,
  FOREIGN KEY (username) REFERENCES profiles(username)
);

CREATE TABLE customizations (
  username TEXT PRIMARY KEY,
  custom_taglines TEXT,
  custom_details TEXT,
  custom_employers TEXT,
  hidden_personas TEXT,
  theme_overrides TEXT,
  FOREIGN KEY (username) REFERENCES profiles(username)
);
