import '@total-typescript/ts-reset';
import { expect, test } from 'bun:test';
import { Application } from './index';
import { Logger } from '@imlunahey/logger';
import { JsonValue } from 'type-fest';

test('json', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
    });

    const body = {
        a: 1,
        b: {
            c: '2',
        },
        d: true,
    } satisfies JsonValue;

    app.get('/', () => body);

    const server = await app.start();
    const response = await fetch(`http://localhost:${server.port}/`).then(response => response.json());
    expect(response).toStrictEqual(body);
    await app.stop();
});

test('jsx', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
    });

    const AnotherComponent = () => <span>World!</span>
    const body = <div>Hello<AnotherComponent /></div>;

    app.get('/', () => body);

    const server = await app.start();
    const response = await fetch(`http://localhost:${server.port}/`).then(response => response.text());
    expect(response).toStrictEqual('<div>Hello<span>World!</span></div>');
    await app.stop();
});

test('custom response', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
    });

    const body = new Response('https://google.com', {
        status: 301,
    });

    app.get('/', () => body);

    const server = await app.start();
    const response = await fetch(`http://localhost:${server.port}/`);
    expect(await response.text()).toStrictEqual('https://google.com');
    expect(response.status).toStrictEqual(301);
    await app.stop();
});

// See: https://github.com/oven-sh/bun/issues/6021
test.skip('custom method', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
        web: {
            port: 0,
        }
    });

    app.use('/:param', ({ method, params: { param } }) => ({
        method,
        param,
    }));

    const server = await app.start();
    expect(await fetch(`http://localhost:${server.port}/GET`, { method: 'GET' }).then(response => response.json())).toStrictEqual({ method: 'GET', param: 'GET' });
    expect(await fetch(`http://localhost:${server.port}/POST`, { method: 'POST' }).then(response => response.json())).toStrictEqual({ method: 'POST', param: 'POST' });
    expect(await fetch(`http://localhost:${server.port}/PUT`, { method: 'PUT' }).then(response => response.json())).toStrictEqual({ method: 'PUT', param: 'PUT' });
    expect(await fetch(`http://localhost:${server.port}/PATCH`, { method: 'PATCH' }).then(response => response.json())).toStrictEqual({ method: 'PATCH', param: 'PATCH' });
    expect(await fetch(`http://localhost:${server.port}/DELETE`, { method: 'DELETE' }).then(response => response.json())).toStrictEqual({ method: 'DELETE', param: 'DELETE' });
    expect(await fetch(`http://localhost:${server.port}/OPTIONS`, { method: 'OPTIONS' }).then(response => response.json())).toStrictEqual({ method: 'OPTIONS', param: 'OPTIONS' });
    await app.stop();
});

test('allows param + named routes at same position', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
    });

    app.get('/google-redirect.txt1', () => 'google-redirect.txt1');
    app.get('/:userId', request => ({
        userId: request.params.userId,
    }));
    app.get('/google-redirect.txt2', () => 'google-redirect.txt2');

    const server = await app.start();

    // First route
    const googleRedirectResponse1 = await fetch(`http://localhost:${server.port}/google-redirect.txt1`);
    expect(await googleRedirectResponse1.text()).toStrictEqual('google-redirect.txt1');
    expect(googleRedirectResponse1.status).toStrictEqual(200);

    // Second route
    const userIdResponse = await fetch(`http://localhost:${server.port}/123`);
    expect(await userIdResponse.json()).toStrictEqual({
        userId: '123',
    });
    expect(userIdResponse.status).toStrictEqual(200);

    // Third route
    const googleRedirectResponse2 = await fetch(`http://localhost:${server.port}/google-redirect.txt2`);
    expect(await googleRedirectResponse2.text()).toStrictEqual('google-redirect.txt2');
    expect(googleRedirectResponse2.status).toStrictEqual(200);

    await app.stop();
});
