import '@total-typescript/ts-reset';
import { expect, test } from 'bun:test';
import { join as joinPath } from 'path';
import { getPages } from './get-pages';

test('returns a list of all the pages in a directory', async () => {
    const pages = await getPages(joinPath(import.meta.dir, '../../examples/pages'));
    const paths = pages.map(page => page.path);
    expect(pages.length).toBe(5);
    expect(paths).toContain('/:page');
    expect(paths).toContain('/contact');
    expect(paths).toContain('/about');
    expect(paths).toContain('/nested/:directory/in/:here');
});
