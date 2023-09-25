import { Logger } from '@imlunahey/logger';
import { expect, test } from 'bun:test';
import { Application } from '../index';

const oneMB = 1024 * 1024; // 1 MB = 1024 KB * 1024 bytes
const character = "A";

const generateStringInMB = (sizeInMB: number) => {
    let generatedString = '';

    while (generatedString.length < (sizeInMB * oneMB)) {
        generatedString += character;
    }

    return generatedString;
};

// See: https://github.com/oven-sh/bun/issues/1824
const skip = true;

test.skipIf(skip)('without GC', async () => {
    console.log('\nwithout GC');
    console.log('Before server start %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));
    const server = Bun.serve({
        port: 0,
        fetch: () => {
            const response = generateStringInMB(0.2);
            return new Response(response);
        }
    });
    console.log('After server start %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));

    // Give the server some time to get to a idle state
    console.log('Waiting till server is idle');
    await Bun.sleep(2_000);

    // GC so we have a good starting point
    console.log('Before first GC %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));
    Bun.gc(true);
    console.log('After first GC %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));

    // Memory usage before requests
    const memoryUsage = process.memoryUsage().rss;

    // Do a bunch of requests
    for (let i = 0; i < 1_000; i++) {
        if (i !== 0 && i % 100 === 0) console.log('After %s requests %sMB', i, Math.floor(process.memoryUsage().rss / 1024 / 1024));
        await fetch(`http://localhost:${server.port}`);
    }

    console.log('After all requests %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));

    // Memory usage should be the same or lower
    expect(process.memoryUsage().rss).toBeLessThanOrEqual(memoryUsage);

    // Stop server
    server.stop(true);
}, 60_000);

test.skipIf(skip)('GC before response is generated', async () => {
    console.log('\nGC before response is generated');
    console.log('Before server start %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));
    const server = Bun.serve({
        port: 0,
        fetch: () => {
            Bun.gc(true);
            const response = generateStringInMB(0.2);
            return new Response(response);
        }
    });
    console.log('After server start %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));

    // Give the server some time to get to a idle state
    console.log('Waiting till server is idle');
    await Bun.sleep(2_000);

    // GC so we have a good starting point
    console.log('Before first GC %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));
    Bun.gc(true);
    console.log('After first GC %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));

    // Memory usage before requests
    const memoryUsage = process.memoryUsage().rss;

    // Do a bunch of requests
    for (let i = 0; i < 1_000; i++) {
        if (i !== 0 && i % 100 === 0) console.log('After %s requests %sMB', i, Math.floor(process.memoryUsage().rss / 1024 / 1024));
        await fetch(`http://localhost:${server.port}`);
    }

    console.log('After all requests %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));

    // Memory usage should be the same or lower
    expect(process.memoryUsage().rss).toBeLessThanOrEqual(memoryUsage);

    // Stop server
    server.stop(true);
}, 60_000);

test.skipIf(skip)('GC after response is generated', async () => {
    console.log('\nGC after response is generated');
    console.log('Before server start %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));
    const server = Bun.serve({
        port: 0,
        fetch: () => {
            const response = generateStringInMB(0.2);
            Bun.gc(true);
            return new Response(response);
        }
    });
    console.log('After server start %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));

    // Give the server some time to get to a idle state
    console.log('Waiting till server is idle');
    await Bun.sleep(2_000);

    // GC so we have a good starting point
    console.log('Before first GC %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));
    Bun.gc(true);
    console.log('After first GC %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));

    // Memory usage before requests
    const memoryUsage = process.memoryUsage().rss;

    // Do a bunch of requests
    for (let i = 0; i < 1_000; i++) {
        if (i !== 0 && i % 100 === 0) console.log('After %s requests %sMB', i, Math.floor(process.memoryUsage().rss / 1024 / 1024));
        await fetch(`http://localhost:${server.port}`);
    }

    console.log('After all requests %sMB', Math.floor(process.memoryUsage().rss / 1024 / 1024));

    // Memory usage should be the same or lower
    expect(process.memoryUsage().rss).toBeLessThanOrEqual(memoryUsage);

    // Stop server
    server.stop(true);
}, 60_000);
