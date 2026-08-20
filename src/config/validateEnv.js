/**
 * Fail-fast environment validation — called once at startup, before
 * anything else runs. A missing JWT_SECRET is the single most dangerous
 * silent failure this app could have: without this check, jwt.sign() would
 * still "work" (jsonwebtoken accepts undefined and produces a token signed
 * with the literal string "undefined"), meaning every token issued would
 * be forgeable by anyone who read this file on GitHub. Better to refuse to
 * start than to start insecurely.
 */
function validateEnv() {
  const problems = [];

  if (!process.env.JWT_SECRET) {
    problems.push('JWT_SECRET is not set.');
  } else if (process.env.JWT_SECRET === 'change_this_to_a_long_random_string') {
    problems.push('JWT_SECRET is still the .env.example placeholder value — generate a real random secret before running anywhere real users can reach.');
  } else if (process.env.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET is shorter than 32 characters — use a longer random value.');
  }

  if (!process.env.MONGO_URI) {
    problems.push('MONGO_URI is not set — refusing to silently fall back to localhost, since that\'s almost never what you want outside local development.');
  }

  if (problems.length > 0) {
    console.error('\n✗ Refusing to start — environment configuration problems:\n');
    problems.forEach((p) => console.error(`  - ${p}`));
    console.error('\nSee .env.example for the required variables.\n');
    process.exit(1);
  }
}

module.exports = { validateEnv };
