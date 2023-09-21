export type ExtractParam<Path, NextPart> = Path extends `:${infer Param}` ? Record<Param, string> & NextPart : NextPart;

export type ExtractParams<Path> = Path extends `${infer Segment}/${infer Rest}` ? ExtractParam<Segment, ExtractParams<Rest>> : ExtractParam<Path, {}>;

export const extractPathParams = <T extends string>(path: string, pattern: T): ExtractParams<T> | undefined => {
    const paramNames = (pattern.match(/:[^/]+/g) || []).map((param) => param.slice(1));
    const regexPattern = pattern
        .replace(/:[^/]+/g, '([^/]+)')
        .replace(/\*/g, '(.*)') // Replace * with (.*) to capture wildcard segments
        .replace(/\//g, '\\/');
    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);

    if (!match) return;
    if (paramNames.length === 0) return;

    let params: any = {};
    paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
    });

    return params;
};
