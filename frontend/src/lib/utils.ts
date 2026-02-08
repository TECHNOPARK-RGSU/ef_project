import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Делает путь к ассету от корня сайта, чтобы не ломаться на вложенных маршрутах SPA (/conferences/7 и т.д.) */
export function getAssetUrl(path: string): string {
  if (path.startsWith("http") || path.startsWith("//")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}
