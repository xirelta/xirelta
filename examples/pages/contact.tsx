import { RouteWithParams } from '../../src/index';

const contact: RouteWithParams<'GET', '/:id'> = request => {
    return {
        a: () => { }, // will be dropped
        b: 1, // will be kept
    };
};

export default contact;
