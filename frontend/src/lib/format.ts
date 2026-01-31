import type { Conference } from "./types";

export const formatDateRange = (start: string, end: string) => {
  const format = (value: string) =>
    new Date(value).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
    });
  return start === end ? format(start) : `${format(start)} — ${format(end)}`;
};

export const formatFormat = (item: Conference) => {
  if (item.format === "hybrid") return "Гибрид";
  if (item.format === "online") return "Онлайн";
  if (item.format === "offline") return "Очный";
  if (item.is_online && item.location) return "Гибрид";
  return item.is_online ? "Онлайн" : "Очный";
};
