import '@total-typescript/ts-reset';
import { expect, test } from 'bun:test';
import { Application, RouteWithParams } from '.';
import { Logger } from '@imlunahey/logger';
import queryString from 'query-string';

test('Logger works', () => {
    const app = new Application();
    app.logger.info('hi', {});
    app.logger.debug('hi', {});
    app.logger.error('hi', {});
});

test('server can be stopped (stop method)', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
    });

    app.get('/', () => 'ok');

    const server = await app.start();
    expect(await fetch(`http://localhost:${server.port}/`).then(response => response.text())).toStrictEqual('ok');
    await app.stop();
    expect(await fetch(`http://localhost:${server.port}/`).catch(error => error instanceof Error ? error.message : error)).toBe('Unable to connect. Is the computer able to access the url?');
});

// @TODO: This is currently broken
test.skip('server can be stopped (CTRL+C)', async () => {
    const exits = [];

    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
        web: {
            port: 3000,
        }
    });

    app.get('/', () => 'ok');

    const server = await app.start();
    expect(await fetch(`http://localhost:${server.port}/`).then(response => response.text())).toStrictEqual('"ok"');
    // @ts-expect-error bun-types are out of date
    process.emit('SIGINT');
    expect(exits.length).toBe(1);
    expect(await fetch(`http://localhost:${server.port}/`).catch(error => error instanceof Error ? error.message : error)).toBe('Unable to connect. Is the computer able to access the url?');
});

test('use', async () => {
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
    await app.stop();
});

test('get', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
        web: {
            port: 0,
        }
    });

    app.get('/:param', ({ method, params: { param } }) => ({
        method,
        param,
    }));

    const server = await app.start();
    expect(await fetch(`http://localhost:${server.port}/GET`, { method: 'GET' }).then(response => response.json())).toStrictEqual({ method: 'GET', param: 'GET' });
    await app.stop();
});

test('post', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
        web: {
            port: 0,
        }
    });

    app.post('/:param', ({ method, params: { param }, body }) => ({
        method,
        param,
        body,
    }));

    const server = await app.start();
    expect(await fetch(`http://localhost:${server.port}/POST`, { method: 'POST', body: JSON.stringify({ hello: 'world' }) })
        .then(response => response.json()))
        .toStrictEqual({ method: 'POST', param: 'POST', body: JSON.stringify({ hello: 'world' }) });
    await app.stop();
});

test('put', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
        web: {
            port: 0,
        }
    });

    app.put('/:param', ({ method, params: { param }, body }) => ({
        method,
        param,
        body,
    }));

    const server = await app.start();
    expect(await fetch(`http://localhost:${server.port}/PUT`, { method: 'PUT', body: JSON.stringify({ hello: 'world' }) })
        .then(response => response.json()))
        .toStrictEqual({ method: 'PUT', param: 'PUT', body: JSON.stringify({ hello: 'world' }) });
    await app.stop();
});

test('delete', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
        web: {
            port: 0,
        }
    });

    app.delete('/:param', ({ method, params: { param }, body }) => ({
        method,
        param,
        body,
    }));

    const server = await app.start();
    expect(await fetch(`http://localhost:${server.port}/DELETE`, { method: 'DELETE', body: JSON.stringify({ hello: 'world' }) })
        .then(response => response.json()))
        .toStrictEqual({ method: 'DELETE', param: 'DELETE', body: JSON.stringify({ hello: 'world' }) });
    await app.stop();
});

test('application/x-www-form-urlencoded', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
        web: {
            port: 0,
        }
    });

    app.use('/', ({ body }) => ({
        body,
    }));

    const server = await app.start();
    const form = { username: 'JohnDoe', password: '123456', email: 'john@example.com', a: ['123', '456'] };
    const toUrlEncoded = (obj: Record<string, unknown>) => queryString.stringify(obj, { arrayFormat: 'colon-list-separator' });
    const sendForm = await fetch(`http://localhost:${server.port}`, {
        method: 'POST',
        body: toUrlEncoded(form),
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        }
    }).then(response => response.json());
    expect(sendForm).toStrictEqual({ body: form });
    await app.stop();
});

test('middleware', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
        web: {
            port: 0,
        }
    });

    type Route = RouteWithParams<'GET', '/:param'>;

    const route: Route = ({ method, params: { param } }) => ({
        method,
        param,
    });

    route.before = [((request, stop) => {
        request.context.started = new Date().getTime().toString();
        return stop();
    })];

    route.after = [((request, stop) => {
        console.log(`${request.path} took ${new Date().getTime() - Number(request.context.started)}ms`);
        return stop();
    })];

    app.get('/:param', route);

    const server = await app.start();
    expect(await fetch(`http://localhost:${server.port}/GET`, { method: 'GET' }).then(response => response.json())).toStrictEqual({ method: 'GET', param: 'GET' });
    await app.stop();
});

test('throwing stops middleware', async () => {
    const app = new Application({
        logger: new Logger({
            service: 'test',
        }),
        web: {
            port: 0,
        }
    });

    type Route = RouteWithParams<'GET', '/:param'>;

    let a = 1;

    const route: Route = ({ method, params: { param } }) => {
        a = 2;
        return {
            method,
            param,
        };
    };

    route.before = [((request, stop) => {
        throw new Error('123');
    })];

    route.after = [((request, stop) => {
        a = 3;
        return {
            a,
        };
    })];

    app.get('/:param', route);

    const server = await app.start();
    expect(await fetch(`http://localhost:${server.port}/GET`, { method: 'GET' }).then(response => response.text())).toBe('500 - 123');
    expect(a).toBe(1);
    await app.stop();
});
