import { normalizeRoleCode, isStudentRole } from "@/lib/roles";

export type UserRoleFlags = {
  roleCode: string;
  isOrganizer: boolean;
  isExpert: boolean;
  isTutor: boolean;
  isStudent: boolean;
  canAccessConferences: boolean;
  canAccessAssignments: boolean;
  canAccessApply: boolean;
  canAccessScores: boolean;
  canAccessAdminCatalogs: boolean;
  canAccessGlobalUsers: boolean;
  canAccessCatalogs: boolean;
};

export function useUserRole(rawRoleCode?: string | null): UserRoleFlags {
  const roleCode = normalizeRoleCode(rawRoleCode ?? "");
  const isOrganizer = roleCode === "organizer";
  const isExpert = roleCode === "expert";
  const isTutor = roleCode === "tutor";
  const isStudent = isStudentRole(roleCode);

  const canAccessConferences = isOrganizer || isExpert || isTutor || isStudent;
  const canAccessAssignments = isOrganizer || isExpert;
  const canAccessApply = isOrganizer || isTutor || isStudent;
  const canAccessScores = isOrganizer || isExpert;
  const canAccessAdminCatalogs = isOrganizer;
  // Пока глобальный список пользователей и справочники не включены для интерфейса.
  const canAccessGlobalUsers = false;
  const canAccessCatalogs = false;

  return {
    roleCode,
    isOrganizer,
    isExpert,
    isTutor,
    isStudent,
    canAccessConferences,
    canAccessAssignments,
    canAccessApply,
    canAccessScores,
    canAccessAdminCatalogs,
    canAccessGlobalUsers,
    canAccessCatalogs,
  };
}

