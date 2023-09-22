import '@total-typescript/ts-reset';
import { expect, test } from 'bun:test';
import { getAllFiles } from './get-all-files';
import { join as joinPath } from 'path';

test('returns a list of all the files in a directory', async () => {
    expect(getAllFiles(joinPath(import.meta.dir, '../../examples')).length).toBe(6);
});
