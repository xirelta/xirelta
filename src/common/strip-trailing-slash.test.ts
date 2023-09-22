import '@total-typescript/ts-reset';
import { expect, test } from 'bun:test';
import { stripTrailingSlash } from './strip-trailing-slash';

test('removes slash', async () => {
    expect(stripTrailingSlash('/')).toBe('/');
    expect(stripTrailingSlash('/a')).toBe('/a');
    expect(stripTrailingSlash('/a/')).toBe('/a');
    expect(stripTrailingSlash('/a/b/c/d/e')).toBe('/a/b/c/d/e');
    expect(stripTrailingSlash('/a/b/c/d/e/')).toBe('/a/b/c/d/e');
});
