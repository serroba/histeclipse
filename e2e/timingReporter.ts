/** Small timing artifacts, including successful runs, to guide the E2E reduction (#645). */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

function scenario(test: TestCase, root: string) {
  return {
    id: test.id,
    project: test.parent.project()?.name ?? '',
    title: test.titlePath().slice(1).join(' › '),
    file: path.relative(root, test.location.file),
    line: test.location.line,
    outcome: test.outcome(),
    expectedStatus: test.expectedStatus,
    durationMs: test.results.reduce((sum, result) => sum + result.duration, 0),
    attempts: test.results.map((result) => ({
      retry: result.retry,
      status: result.status,
      durationMs: result.duration,
    })),
  };
}

type Scenario = ReturnType<typeof scenario>;

/** Plain table text: test titles must not become Markdown links, HTML or table columns. */
function cell(text: string): string {
  return text.replace(/[&<>|`[\]\r\n]/g, (character) => `&#${String(character.charCodeAt(0))};`);
}

function summary(tests: readonly Scenario[], result: FullResult): string {
  const executed = tests.filter((test) => test.attempts.some((run) => run.status !== 'skipped'));
  const attempts = tests.flatMap((test) => test.attempts);
  const seconds = (ms: number) => (ms / 1000).toFixed(1);
  const lines = [
    '## Browser test timings',
    '',
    `Status: **${result.status}**. Playwright wall time: **${seconds(result.duration)} s**.`,
    `Selected: **${String(tests.length)}**; executed: **${String(executed.length)}**; ` +
      `skipped/not run: **${String(tests.length - executed.length)}**; ` +
      `retry attempts: **${String(attempts.filter((run) => run.retry > 0).length)}**.`,
    '',
    '| Project | Selected | Flaky | Unexpected | Summed attempt seconds |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  for (const project of new Set(tests.map((test) => test.project))) {
    const group = tests.filter((test) => test.project === project);
    lines.push(
      `| ${cell(project)} | ${String(group.length)} | ` +
        `${String(group.filter((test) => test.outcome === 'flaky').length)} | ` +
        `${String(group.filter((test) => test.outcome === 'unexpected').length)} | ` +
        `${seconds(group.reduce((sum, test) => sum + test.durationMs, 0))} |`,
    );
  }
  lines.push(
    '',
    '### Slowest scenarios (all attempts, including retries)',
    '',
    '| Project | Scenario | Seconds | Attempts | Outcome |',
    '| --- | --- | ---: | ---: | --- |',
  );
  for (const test of [...executed].sort((a, b) => b.durationMs - a.durationMs).slice(0, 20)) {
    lines.push(
      `| ${cell(test.project)} | ${cell(`${test.file}:${String(test.line)} — ${test.title}`)} | ` +
        `${seconds(test.durationMs)} | ${String(test.attempts.length)} | ${test.outcome} |`,
    );
  }
  lines.push(
    '',
    'Summed attempt time includes parallel work; it is neither wall time nor billed runner time.',
    'Wall time excludes runner setup and queueing. Combine shard artifacts by run, OS and project;',
    'use Actions job timestamps for runner-minutes and workflow latency.',
    '',
  );
  return lines.join('\n');
}

export default class TimingReporter implements Reporter {
  private suite: Suite | undefined;
  private config: FullConfig | undefined;

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
  }

  onEnd(result: FullResult): void {
    if (this.suite === undefined || this.config === undefined) return;
    const tests = this.suite.allTests().map((test) => scenario(test, this.config?.rootDir ?? ''));
    const directory = path.join(
      path.dirname(this.config.configFile ?? path.join(process.cwd(), 'playwright.config.ts')),
      'test-results',
    );
    const name = process.env['TIMING_REPORT_NAME'] ?? 'timings';
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, `${name}.json`),
      JSON.stringify(
        {
          schemaVersion: 1,
          runId: process.env['GITHUB_RUN_ID'] ?? null,
          runAttempt: process.env['GITHUB_RUN_ATTEMPT'] ?? null,
          commit: process.env['GITHUB_SHA'] ?? null,
          platform: process.platform,
          shard: this.config.shard,
          startedAt: result.startTime.toISOString(),
          wallTimeMs: result.duration,
          status: result.status,
          tests,
        },
        null,
        2,
      ) + '\n',
    );
    const markdown = summary(tests, result);
    writeFileSync(path.join(directory, `${name}.md`), markdown);
    const stepSummary = process.env['GITHUB_STEP_SUMMARY'];
    if (stepSummary !== undefined) appendFileSync(stepSummary, markdown);
  }
}
