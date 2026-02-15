export interface ExperienceLevel {
  prefix: string;
  years: string;
}

/**
 * Estimate experience level from GitHub account age and domain score ratio.
 *
 * Rules (evaluated in order):
 *   - ratio > 0.85 && age > 8  => prefix "Principal"
 *   - ratio > 0.7  && age > 5  => prefix "Staff"
 *   - ratio > 0.5  && age > 3  => prefix "Senior"
 *   - ratio > 0.3              => prefix "" (no prefix), years shown
 *   - else                     => prefix "", years "Active"
 */
export function estimateExperience(
  profile: { created_at: string },
  domainScore: number,
  maxScore: number,
): ExperienceLevel {
  const accountAge =
    new Date().getFullYear() - new Date(profile.created_at).getFullYear();
  const ratio = domainScore / maxScore;

  if (ratio > 0.85 && accountAge > 8) {
    return { prefix: "Principal", years: accountAge + "+ years" };
  }
  if (ratio > 0.7 && accountAge > 5) {
    return { prefix: "Staff", years: accountAge + "+ years" };
  }
  if (ratio > 0.5 && accountAge > 3) {
    return { prefix: "Senior", years: accountAge + "+ years" };
  }
  if (ratio > 0.3) {
    return { prefix: "", years: accountAge + "+ years" };
  }
  return { prefix: "", years: "Active" };
}
