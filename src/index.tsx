import { JsonValue } from 'type-fest';
import { Handler, HttpMethod, ResponseBody } from './common/types';

export { Application } from './application';

export type StrictRouteWithParams<
    Method extends HttpMethod | "*",
    Path extends string,
    Body extends ResponseBody<true> = JsonValue,
> = Handler<true, Method, Path, Body>;

export type RouteWithParams<
    Method extends HttpMethod | "*",
    Path extends string,
    Body extends ResponseBody<false> = any,
> = Handler<false, Method, Path, Body>;
