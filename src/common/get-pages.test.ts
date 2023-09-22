import '@total-typescript/ts-reset';
import { expect, test } from 'bun:test';
import { join as joinPath } from 'path';
import { getPages } from './get-pages';

test('returns a list of all the pages in a directory', async () => {
    const pages = await getPages(joinPath(import.meta.dir, '../../examples/pages'));
    expect(pages.length).toBe(4);
    expect(pages[0].path).toBe('/:page');
    expect(pages[1].path).toBe('/contact');
    expect(pages[2].path).toBe('/about');
    expect(pages[3].path).toBe('/nested/:directory/in/:here');
});
