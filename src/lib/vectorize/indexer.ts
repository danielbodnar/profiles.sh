/**
 * Batch Vectorize upsert for repo embeddings.
 *
 * After R2 repo objects are written, this indexes each repo into
 * Vectorize with metadata for filtered semantic search.
 *
 * Embeddings are generated in parallel batches via Workers AI
 * (multiple texts per call) for performance.
 */

import type { GitHubRepo } from "../github/types";
import { buildRepoText, generateEmbeddings } from "./embeddings";

const EMBED_BATCH_SIZE = 20;
const UPSERT_BATCH_SIZE = 100;

/** Metadata stored alongside each vector in the Vectorize index. */
interface RepoVectorMetadata {
  full_name: string;
  owner: string;
  language: string;
  description: string;
  starred_by: string;
}

/**
 * Index a list of repos into Vectorize.
 * Generates embeddings via Workers AI in batches and upserts to Vectorize.
 * Non-fatal: logs warnings on failure but does not throw.
 */
export async function indexRepos(
  ai: Ai,
  vectorize: VectorizeIndex,
  repos: GitHubRepo[],
  username: string,
  readmeMap?: Map<string, string>,
): Promise<void> {
  const vectors: VectorizeVector[] = [];

  // Generate embeddings in batches for performance
  for (let i = 0; i < repos.length; i += EMBED_BATCH_SIZE) {
    const batch = repos.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map((repo) => {
      const readme = readmeMap?.get(repo.full_name) ?? readmeMap?.get(repo.name) ?? null;
      return buildRepoText(repo, readme);
    });

    try {
      const embeddings = await generateEmbeddings(ai, texts);

      for (let j = 0; j < batch.length; j++) {
        const repo = batch[j];
        vectors.push({
          id: repo.full_name,
          values: embeddings[j],
          metadata: {
            full_name: repo.full_name,
            owner: repo.owner.login,
            language: repo.language ?? "",
            description: (repo.description ?? "").slice(0, 200),
            starred_by: username,
          } satisfies RepoVectorMetadata,
        });
      }
    } catch (err) {
      console.warn(`[vectorize/indexer] Embedding batch failed (offset ${i}, ${batch.length} repos):`, err);
    }
  }

  // Upsert in batches
  for (let i = 0; i < vectors.length; i += UPSERT_BATCH_SIZE) {
    const batch = vectors.slice(i, i + UPSERT_BATCH_SIZE);
    try {
      await vectorize.upsert(batch);
    } catch (err) {
      console.warn(`[vectorize/indexer] Batch upsert failed (offset ${i}):`, err);
    }
  }

  console.log(`[vectorize/indexer] Indexed ${vectors.length}/${repos.length} repos for ${username}`);
}
