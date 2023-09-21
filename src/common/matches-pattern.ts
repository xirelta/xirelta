export const matchesPattern = (url: string, pattern: string) => {
    const regexPattern = pattern
        .replace(/:[^/]+/g, '([^/]+)')
        .replace(/\*/g, '.*') // Replace * with .* to match multiple segments
        .replace(/\//g, '\\/');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
};
