export const stripTrailingSlash = (string: string) => {
    // Exactly "/" return "/"
    if (string === '/') return string;
    // Otherwise remove last character if it's a "/"
    return string.endsWith('/') ? string.substring(0, string.length - 1) : string;
};
