const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');

        // This script posts a minimal coverage summary to the PR using GITHUB_TOKEN.
        // It is optional and will not fail CI if missing token or errors.

        async function main() {
          try {
            const lcovPath = path.resolve(process.cwd(), 'coverage/lcov.info');
            if (!fs.existsSync(lcovPath)) {
              console.log('lcov.info not found, skipping coverage comment');
              return;
            }

            const lcov = fs.readFileSync(lcovPath, 'utf8');
            // Very small parser to extract overall lines coverage
            const match = lcov.match(/LH:\d+[\n\r]+LF:\d+[\n\r]+end_of_record/s);

            // As a simple approach, run jest --coverage --coverageReporters=text to get text summary
            let coverageText;
            try {
              coverageText = execSync('npm run test:coverage -- --coverageReporters=text --testPathPattern=^$', { stdio: 'pipe' }).toString();
            } catch (e) {
              coverageText = 'Coverage summary not available in CI run.';
            }

            // Post comment using GitHub CLI if available
            if (process.env.GITHUB_TOKEN) {
              const pr = process.env.GITHUB_REF || process.env.GITHUB_HEAD_REF || '';
              // Try gh (GitHub CLI)
              try {
                const cmd = `gh pr view --json number -q .number || true`;
                const prNumber = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
                if (prNumber) {
                  const body = `### Test coverage\n\n<details><summary>Coverage output</summary>\n\n${coverageText}\n\n</details>`;
                  execSync(`gh pr comment ${prNumber} --body "${body}"`, { stdio: 'inherit' });
                }
              } catch (e) {
                // ignore
              }
            }

            console.log('Coverage comment script completed.');
          } catch (err) {
            console.error('Error posting coverage comment:', err);
          }
        }

        main();