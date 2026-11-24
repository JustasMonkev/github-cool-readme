// What a run on GitHub Actions says when it can't start: the error in the log, and again as an
// annotation, shown on the run's page and summary (at its line in the settings when it has one).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const CLI = resolve('src/cli.ts');
const temp = mkdtempSync(join(tmpdir(), 'cool-readme-cli-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

/** Runs the CLI as the action does, with no token, in a folder holding `settings` as cool-readme.yml. */
function inActions(settings: string) {
  const dir = mkdtempSync(join(temp, 'run-'));
  writeFileSync(join(dir, 'cool-readme.yml'), settings);
  const env = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_TOKEN: '', GH_TOKEN: '' };
  const r = spawnSync(process.execPath, [CLI, '--out', 'stats'], { cwd: dir, env, encoding: 'utf8' });
  return { status: r.status, log: r.stderr, annotation: r.stdout.trim() };
}

describe('on GitHub Actions', () => {
  it('names the missing secret, and both ways to add it', () => {
    const { status, log, annotation } = inActions('show: [summary]\n');
    expect(status).toBe(1);
    expect(log).toMatch(/^error: no token: .*missing the CARDS_TOKEN secret/);
    expect(log).toContain('Add it by hand');
    expect(log).toContain('run setup again');
    expect(annotation).toMatch(/^::error title=Cool README cards::no token: [^\n]*%0AAdd it by hand/);
  });

  it("points at the line that isn't YAML", () => {
    const { status, log, annotation } = inActions('cards:\n  about:\n    lines:\n      - "a <a href="x">link</a>"\n');
    expect(status).toBe(1);
    expect(log).toMatch(/^error: cool-readme.yml isn't valid YAML at line 4, column \d+/);
    expect(annotation).toMatch(/^::error file=cool-readme.yml,line=4,col=\d+,title=Cool README cards::cool-readme.yml isn't valid YAML/);
    expect(annotation).not.toContain('\n');
  });
});

describe('collecting the contribution calendar', () => {
  const run = (settings: string, args: string[] = []) => {
    const dir = mkdtempSync(join(temp, 'calendar-'));
    writeFileSync(join(dir, 'cool-readme.yml'), settings);
    const res = spawnSync(process.execPath, ['--import', resolve('tests/fixtures/calendar-api.mjs'), CLI, ...args], {
      cwd: dir, env: { ...process.env, GITHUB_TOKEN: 'fixture' }, encoding: 'utf8',
    });
    expect(res.status, res.stderr).toBe(0);
    const calls = readFileSync(join(dir, 'queries.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    return { dir, calls, log: res.stderr };
  };

  it('renders the same calendar cards without collecting the rest of a reusable snapshot', () => {
    const settings = 'show: [weekly, streaks]\nuser: another-user\ncount: { orgs: false }\n';
    const full = run(settings, ['--snapshot', 'snapshot.json']);
    const live = run(settings);
    const snapshot = JSON.parse(readFileSync(join(full.dir, 'snapshot.json'), 'utf8'));
    expect(snapshot.allTime.length).toBeGreaterThan(1);
    expect(snapshot.calendar).toEqual([{ date: '2026-03-02', count: 3 }]);
    for (const card of ['weekly', 'streaks']) for (const mode of ['light', 'dark']) {
      const name = join('stats', card + '-' + mode + '.svg');
      expect(readFileSync(join(live.dir, name), 'utf8')).toBe(readFileSync(join(full.dir, name), 'utf8'));
    }
    expect(live.log).toContain("only another-user's public work is visible");
    expect(live.log).toContain('count settings cannot filter the contribution calendar');
    expect(live.calls).toHaveLength(2);
    const calendar = live.calls[1];
    expect(calendar.variables.login).toBe('another-user');
    expect(calendar.query).toContain('contributionCalendar');
    expect(calendar.query).not.toMatch(/totalCommitContributions|ByRepository|pullRequests\(|stargazers\(/);
  });

  it('keeps the full collection when a selected card needs repository data', () => {
    const { calls, dir } = run('show: [weekly, summary]');
    expect(calls.some(({ query }) => query.includes('commitContributionsByRepository'))).toBe(true);
    expect(readFileSync(join(dir, 'stats', 'summary-light.svg'), 'utf8')).toContain('Commits');
  });
});
