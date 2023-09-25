import { RouteWithParams } from '../../../src/index';

type Route = RouteWithParams<'GET', '/:id'>;

const contact: Route = (_r, _n) => {
    return {
        a: () => { }, // will be dropped
        b: 1, // will be kept
    } satisfies ReturnType<Route>;
};

contact.before = [((request, next) => {
    console.log('HERE!!!!!');
    request.headers.started = new Date().getTime().toString();
    return next();
})];

contact.after = [((request, next) => {
    console.log('HERE22222');
    console.log(`${request.path} took ${new Date().getTime() - Number(request.headers.started)}ms`);
    return next();
})];

export default contact;
