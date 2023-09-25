import { RouteWithParams } from '../../../src/index';

type Route = RouteWithParams<'GET', '/:id'>;

const contact: Route = (_r, _n) => {
    return {
        a: () => { }, // will be dropped
        b: 1, // will be kept
    } satisfies ReturnType<Route>;
};

const sleep = (ms: number) => new Promise<void>(resolve => {
    setTimeout(() => {
        resolve();
    }, ms);
});

contact.before = [(request, stop) => {
    request.context.started = new Date().getTime().toString();
    console.log(1);
}, () => {
    console.log(2);
}, () => {
    console.log(3);
}, async () => {
    await sleep(2_000);
    console.log(4);
}, () => {
    console.log(5);
}];

contact.after = [(request, stop, error) => {
    console.log(`${request.path} took ${new Date().getTime() - Number(request.context.started)}ms`);
    throw new Error('1234');
    // return stop();
}, (r, s, error) => {
    return new Response(`AN ERROR!!!!! ${error?.message}`);
}];

export default contact;
