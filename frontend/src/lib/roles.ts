import type { Role } from "@/lib/types";

const STUDENT_ALIASES = new Set(["student2", "student3"]);

export const normalizeRoleCode = (code?: string | null) => {
  const normalized = (code ?? "").toLowerCase();
  return STUDENT_ALIASES.has(normalized) ? "student" : normalized;
};

export const isStudentRole = (code?: string | null) => normalizeRoleCode(code) === "student";

export const getRoleLabel = (role?: Role | null) => {
  const normalized = normalizeRoleCode(role?.code ?? "");
  if (normalized === "student") return "Ученик";
  return role?.name || "Без роли";
};
