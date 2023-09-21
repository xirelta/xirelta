import { ReactNode } from 'react';
import { Simplify, JsonValue } from 'type-fest';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type Handler<Params extends Record<string, unknown> = Record<string, unknown>, Method extends HttpMethod = HttpMethod> = (request: {
    params?: Simplify<Params>;
    query?: Record<string, unknown>;
    path: string;
    method: Method;
    body?: JsonValue;
}) => ReactNode | Response | JsonValue;
