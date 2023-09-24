import { RouteWithParams } from '../../src/index';

type Route = RouteWithParams<'GET', '/:id'>;

const contact: Route = request => {
    return {
        a: () => { }, // will be dropped
        b: 1, // will be kept
    } satisfies ReturnType<Route>;
};

export default contact;
