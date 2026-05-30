// VENDED by @voila/content-registry — you own this file.
export type ClassValue = string | false | null | undefined;

/** Join truthy class strings. (Swap for clsx + tailwind-merge if you need
 *  conflict resolution; the admin's class usage doesn't require it.) */
export const cn = (...classes: ClassValue[]): string => classes.filter(Boolean).join(" ");
