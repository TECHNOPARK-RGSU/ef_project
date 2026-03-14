export type Conference = {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  location?: string | null;
  is_online: boolean;
  format?: "online" | "offline" | "hybrid";
  description?: string | null;
  winners_count?: number | null;
  prizes_count?: number | null;
  results_published?: boolean;
};

export type AgeCategory = {
  id: number;
  name: string;
  min_age: number;
  max_age: number;
};

export type Section = {
  id: number;
  name: string;
  conference?: {
    id?: number;
    title?: string;
    start_date?: string;
    end_date?: string;
  } | null;
  category?: { id?: number; name?: string } | null;
};

export type Role = {
  id: number;
  name: string;
  code: string;
};

export type EducationalOrganization = {
  id: number;
  name: string;
  short_name?: string | null;
  city?: string | null;
  address?: string | null;
  website?: string | null;
};

export type ProjectStatus = {
  id: number;
  name: string;
  code: string;
};

export type ConferenceStatusFlowItem = {
  id: number;
  conference?: { id?: number; title?: string } | null;
  status?: ProjectStatus | null;
  order: number;
  is_enabled: boolean;
};

export type ParticipationStage = {
  id: number;
  name: string;
  code: string;
};

export type ConferenceStageAvailability = {
  id: number;
  conference?: { id?: number; title?: string } | null;
  stage?: ParticipationStage | null;
  is_enabled: boolean;
};

export type ConferenceExpert = {
  id: number;
  conference?: { id?: number; title?: string } | null;
  expert?: User | null;
  sections?: Section[] | null;
};

export type Place = {
  id: number;
  name: string;
  address?: string | null;
};

export type PresentationType = {
  id: number;
  name: string;
  code: string;
  place?: Place | null;
};

export type User = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  role?: Role | null;
  educational_organization?: EducationalOrganization | null;
  allowed_student_ids?: number[];
  scientific_supervisor_id?: number | null;
  peer_student_ids?: number[];
};

export type EvaluationCriterion = {
  id: number;
  conference?: Conference | null;
  name: string;
  description?: string | null;
  max_score: number;
  stage: "online" | "offline";
};

export type Project = {
  id: number;
  title: string;
  description?: string | null;
  additional_info?: string | null;
  files?: string | null;
  members?: User[];
  leader?: User | null;
  tutor?: User | null;
  section?: Section | null;
  status?: ProjectStatus | null;
  stage?: ParticipationStage | null;
  presentation_type?: PresentationType | null;
  created_at?: string;
  updated_at?: string;
};

export type ProjectScore = {
  id: number;
  project: Project;
  criterion: EvaluationCriterion;
  evaluator?: User | null;
  score: number;
};

export type ProjectResult = {
  id: number;
  project: Project;
  section: Section;
  total_score: number;
  online_score: number;
  offline_score: number;
  rank: number;
  is_winner: boolean;
  is_prize: boolean;
};

export type Comment = {
  id: number;
  text: string;
  project: Project;
  author?: User | null;
  created_at?: string;
  updated_at?: string;
};

export type AssignmentPlace = {
  id: number;
  name: string;
  address?: string | null;
};

export type ExpertAssignmentItem = {
  id: number;
  project: Project;
  place?: AssignmentPlace | null;
};

export type ExpertAssignment = {
  id: number;
  conference: Conference;
  expert: User;
  stage: "online" | "offline";
  max_projects: number;
  items?: ExpertAssignmentItem[];
};
