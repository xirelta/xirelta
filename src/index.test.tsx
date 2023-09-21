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

test('server can be stopped (stop method)', async () => {
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
    await app.stop();
    expect(await fetch(`http://localhost:${server.port}/`).catch(error => error instanceof Error ? error.message : error)).toBe('Unable to connect. Is the computer able to access the url?');
});

// @TODO: This is currently broken
// test('server can be stopped (CTRL+C)', async () => {
//     const exits = [];

//     const app = new Application({
//         logger: new Logger({
//             service: 'test',
//         }),
//         web: {
//             port: 3000,
//         }
//     });

//     app.get('/', () => 'ok');

//     const server = await app.start();
//     expect(await fetch(`http://localhost:${server.port}/`).then(response => response.text())).toStrictEqual('"ok"');
//     // @ts-expect-error bun-types are out of date
//     process.emit('SIGINT');
//     expect(exits.length).toBe(1);
//     expect(await fetch(`http://localhost:${server.port}/`).catch(error => error instanceof Error ? error.message : error)).toBe('Unable to connect. Is the computer able to access the url?');
// });
