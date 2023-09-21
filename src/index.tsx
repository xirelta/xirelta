import { Handler, HttpMethod } from './common/types';

export { Application } from './application';

export type RouteWithParams<Path extends string, Params extends Record<string, unknown> = Record<string, unknown>, Method extends HttpMethod | "*" = HttpMethod | "*"> = Handler<Path, Params, Method>;
