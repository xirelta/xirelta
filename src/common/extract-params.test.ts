import '@total-typescript/ts-reset';
import { expect, test } from 'bun:test';
import { extractPathParams } from './extract-params';

test('extracts all the params', async () => {
    expect(extractPathParams('/123/456/789', '/:a/:b/:c')).toStrictEqual({
        a: '123',
        b: '456',
        c: '789',
    });
});
