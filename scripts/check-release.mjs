import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** No side effects: fail closed before any production artifact can be uploaded. */
export function validateRelease({ event, repository, ref, confirmation, expectedSha, runSha, checkoutSha }) {
  if (event !== 'workflow_dispatch') throw new Error('Production release requires an explicit workflow_dispatch.');
  if (repository !== 'skc649339-gif/csk' || ref !== 'refs/heads/feature/iphone-pwa') throw new Error('Wrong repository or release branch.');
  if (confirmation !== 'PUBLISH_CSK') throw new Error('Explicit production confirmation is missing.');
  if (typeof expectedSha !== 'string' || !/^[a-f0-9]{40}$/.test(expectedSha)) throw new Error('A reviewed full 40-character commit SHA is required.');
  if (expectedSha !== runSha || expectedSha !== checkoutSha) throw new Error('The reviewed SHA, workflow SHA and checked-out SHA must match exactly.');
  return expectedSha;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const approved = validateRelease({
      event: process.env.GITHUB_EVENT_NAME, repository: process.env.GITHUB_REPOSITORY,
      ref: process.env.GITHUB_REF, confirmation: process.env.CSK_RELEASE_CONFIRMATION,
      expectedSha: process.env.CSK_EXPECTED_SHA, runSha: process.env.GITHUB_SHA, checkoutSha,
    });
    console.log(`Explicit release guard passed for ${approved}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Release guard failed.');
    process.exitCode = 1;
  }
}
