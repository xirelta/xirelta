import { expect, test } from 'bun:test';
import { getHandlerForURL } from './get-handler-for-url';

test('returns a handler for the matching URL', () => {
    const handlers = new Map();
    expect(getHandlerForURL('/', handlers)).toBe(undefined);

    const exactMatchHandler = () => 1;
    handlers.set('/this-is-an-exact-match', exactMatchHandler);
    expect(getHandlerForURL('/this-is-an-exact-match', handlers)).toStrictEqual({
        handler: exactMatchHandler,
        pattern: '/this-is-an-exact-match',
    });
    expect(getHandlerForURL('/this-will-not-match', handlers)).toStrictEqual(undefined);

    const paramMatchHandler = () => 2;
    handlers.set('/:this-is-a-param-match', paramMatchHandler);
    expect(getHandlerForURL('/abc123', handlers)).toStrictEqual({
        handler: paramMatchHandler,
        pattern: '/:this-is-a-param-match',
    });
    expect(getHandlerForURL('/this-will-also-match', handlers)).toStrictEqual({
        handler: paramMatchHandler,
        pattern: '/:this-is-a-param-match',
    });
    expect(getHandlerForURL('/this/will/not/match', handlers)).toStrictEqual(undefined);

    // Strict mode
    expect(getHandlerForURL('/abc123/', handlers, true)).toStrictEqual(undefined);
    expect(getHandlerForURL('/abc123', handlers, true)).toStrictEqual({
        handler: paramMatchHandler,
        pattern: '/:this-is-a-param-match',
    });
});
