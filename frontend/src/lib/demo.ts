import type { Conference } from "./types";

export const FEATURES = [
  {
    title: "Единая заявка",
    description: "Форма для очных и заочных проектов с единым набором полей.",
  },
  {
    title: "Секции и статусы",
    description: "Прозрачные этапы от подачи до итогового протокола.",
  },
  {
    title: "Площадки",
    description: "Сценарии для аудиторий, стендов и онлайн-докладов.",
  },
];

export const STEPS = [
  {
    title: "Создаём конференцию",
    text: "Даты, роли и секции — всё в одном месте.",
  },
  {
    title: "Открываем приём",
    text: "Участники подают проекты и получают статус.",
  },
  {
    title: "Подводим итоги",
    text: "Экспертные комментарии и финальные протоколы.",
  },
];

export const FALLBACK_TRACKS = [
  {
    name: "Научные исследования",
    age: "14-18 лет",
    format: "Очный + онлайн",
  },
  {
    name: "Проектная инженерия",
    age: "16-22 года",
    format: "Очный",
  },
  {
    name: "Гуманитарные практики",
    age: "14-20 лет",
    format: "Заочный",
  },
];

export const FALLBACK_CONFERENCES: Conference[] = [
  {
    id: 1,
    title: "Межвузовские дни науки",
    start_date: "2026-04-24",
    end_date: "2026-04-26",
    location: "Москва, кампус РГСУ",
    is_online: true,
    format: "hybrid",
  },
  {
    id: 2,
    title: "Инженерный трек",
    start_date: "2026-05-12",
    end_date: "2026-05-12",
    location: "Инж. корпус",
    is_online: false,
    format: "offline",
  },
  {
    id: 3,
    title: "Гуманитарная школа",
    start_date: "2026-05-20",
    end_date: "2026-05-22",
    location: "Онлайн",
    is_online: true,
    format: "online",
  },
];

export const FALLBACK_STATUSES = ["Новый", "На доработку", "Согласован", "В финал"];
export const FALLBACK_ROLES = [
  "Организатор — управляет расписанием.",
  "Эксперт — оставляет комментарии.",
  "Участник — подаёт проект.",
];
