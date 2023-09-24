import { Handler, HttpMethod } from './common/types';

export { Application } from './application';

export type StrictRouteWithParams<
    Method extends HttpMethod | "*",
    Path extends string,
> = Handler<Method, Path, true>;

export type RouteWithParams<
    Method extends HttpMethod | "*",
    Path extends string,
> = Handler<Method, Path, false>;
