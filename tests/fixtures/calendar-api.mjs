// An account with no repositories or pull requests, but a nonempty contribution calendar.
import { appendFileSync } from 'node:fs';

globalThis.fetch = async (_url, init) => {
  const { query, variables } = JSON.parse(init.body);
  appendFileSync('queries.jsonl', JSON.stringify({ query, variables }) + '\n');
  const page = { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
  let data;
  if (query.includes('viewer')) data = { viewer: { login: 'octo' } };
  else if (query.includes('contributionsCollection')) {
    data = { user: { contributionsCollection: {
      ...(variables.calendar === false ? {} : {
        contributionCalendar: { weeks: [{ contributionDays: [{ date: '2026-03-02', contributionCount: 3 }] }] },
      }),
      totalCommitContributions: 0, totalPullRequestContributions: 0, totalPullRequestReviewContributions: 0, totalIssueContributions: 0,
      restrictedContributionsCount: 0, commitContributionsByRepository: [], pullRequestContributionsByRepository: [],
      pullRequestReviewContributionsByRepository: [], issueContributionsByRepository: [],
    } } };
  } else if (query.includes('createdAt organizations')) {
    data = { user: { login: variables.login, name: null, createdAt: '2015-01-01T00:00:00Z', organizations: page } };
  } else if (query.includes('repositories(first:')) data = { user: { repositories: page } };
  else if (query.includes('pullRequests(first:')) data = { user: { pullRequests: page } };
  else throw Error('unexpected query: ' + query);
  return Response.json({ data });
};
