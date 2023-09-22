import '@total-typescript/ts-reset';
import { expect, test } from 'bun:test';
import { matchesPattern } from './matches-pattern';

test('creates regex to match pattern', async () => {
    expect(matchesPattern('/random-endpoint', '/random-endpoint')).toBe(true);
    expect(matchesPattern('/random-endpoint/abc123', '/random-endpoint/:with-param')).toBe(true);
    expect(matchesPattern('/random-endpoint', '/404')).toBe(false);
});
