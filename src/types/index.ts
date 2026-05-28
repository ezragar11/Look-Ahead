// ─── Status & Priority Enums ────────────────────────────────────────────────

export type ActivityStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "DELAYED"
  | "MISSED"
  | "BLOCKED"
  | "CANCELLED"
  | "NEEDS_FOLLOW_UP";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ConflictType =
  | "TRADE_OVERLAP"
  | "SEQUENCE_ISSUE"
  | "MATERIAL_DELIVERY"
  | "OUTAGE_REQUIRED"
  | "INSPECTION_NEEDED"
  | "SAFETY"
  | "ACCESS"
  | "CREW_AVAILABILITY"
  | "EQUIPMENT"
  | "DESIGN_RFI"
  | "WEATHER"
  | "PERMIT";

export type ConflictSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ConflictStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "WAITING_ON_OWNER"
  | "WAITING_ON_SUBCONTRACTOR"
  | "RESOLVED"
  | "CLOSED";

// ─── Display Labels ──────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  PLANNED:         "Planned",
  IN_PROGRESS:     "In Progress",
  COMPLETE:        "Complete",
  DELAYED:         "Delayed",
  MISSED:          "Missed",
  BLOCKED:         "Blocked",
  CANCELLED:       "Cancelled",
  NEEDS_FOLLOW_UP: "Needs Follow-Up",
};

export const STATUS_COLORS: Record<ActivityStatus, string> = {
  PLANNED:         "bg-gray-100 text-gray-700 border-gray-300",
  IN_PROGRESS:     "bg-amber-100 text-amber-700 border-amber-300",
  COMPLETE:        "bg-emerald-100 text-emerald-700 border-emerald-300",
  DELAYED:         "bg-orange-100 text-orange-700 border-orange-300",
  MISSED:          "bg-red-100 text-red-700 border-red-300",
  BLOCKED:         "bg-red-100 text-red-800 border-red-400",
  CANCELLED:       "bg-gray-200 text-gray-600 border-gray-400",
  NEEDS_FOLLOW_UP: "bg-purple-100 text-purple-700 border-purple-300",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW:      "Low",
  MEDIUM:   "Medium",
  HIGH:     "High",
  CRITICAL: "Critical",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW:      "bg-gray-100 text-gray-600",
  MEDIUM:   "bg-blue-100 text-blue-700",
  HIGH:     "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export const CONFLICT_SEVERITY_COLORS: Record<ConflictSeverity, string> = {
  LOW:      "bg-gray-100 text-gray-600",
  MEDIUM:   "bg-yellow-100 text-yellow-700",
  HIGH:     "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export const CONFLICT_STATUS_LABELS: Record<ConflictStatus, string> = {
  OPEN:                     "Open",
  UNDER_REVIEW:             "Under Review",
  WAITING_ON_OWNER:         "Waiting on Owner",
  WAITING_ON_SUBCONTRACTOR: "Waiting on Subcontractor",
  RESOLVED:                 "Resolved",
  CLOSED:                   "Closed",
};

// ─── Core Data Types ─────────────────────────────────────────────────────────

export interface Project {
  id:            string;
  projectName:   string;
  client?:       string | null;
  contractor?:   string | null;
  location?:     string | null;
  projectNumber?: string | null;
  createdAt:     string;
  updatedAt:     string;
}

export interface Lookahead {
  id:             string;
  projectId:      string;
  name:           string;
  uploadDate:     string;
  sourceFileName?: string | null;
  startDate?:     string | null;
  endDate?:       string | null;
  notes?:         string | null;
  createdBy?:     string | null;
  createdAt:      string;
  project?:       Project;
  _count?: {
    activities: number;
  };
}

export interface Subcontractor {
  id:          string;
  name:        string;
  trade?:      string | null;
  contactName?: string | null;
  phone?:      string | null;
  email?:      string | null;
  notes?:      string | null;
  createdAt:   string;
  updatedAt:   string;
}

export interface ActivityOccurrence {
  id:                  string;
  activityId:          string;
  plannedDate:         string;
  plannedWeekLabel?:   string | null;
  dayOfWeek?:          string | null;
  isPlanned:           boolean;
  actualWorkCompleted?: string | null;
  actualNotes?:        string | null;
  status:              ActivityStatus;
  createdAt:           string;
  updatedAt:           string;
}

export interface Activity {
  id:                          string;
  projectId:                   string;
  lookaheadId:                 string;
  category?:                   string | null;
  activityDescription:         string;
  responsibleSubcontractorId?:  string | null;
  responsibleSubcontractorRaw?: string | null;
  location?:                   string | null;
  plannedStart?:                string | null;
  plannedFinish?:               string | null;
  actualStart?:                 string | null;
  actualFinish?:                string | null;
  status:                      ActivityStatus;
  percentComplete:             number;
  delayReason?:                 string | null;
  priority:                    Priority;
  needsFollowUp:               boolean;
  inspectionRequired:          boolean;
  outageRequired:              boolean;
  materialRequired:            boolean;
  safetyConcern:               boolean;
  notes?:                      string | null;
  createdAt:                   string;
  updatedAt:                   string;
  subcontractor?:              Subcontractor | null;
  occurrences?:                ActivityOccurrence[];
  lookahead?:                  Lookahead;
  project?:                    Project;
  _count?: {
    occurrences: number;
  };
}

export interface Conflict {
  id:              string;
  projectId:       string;
  title:           string;
  description?:    string | null;
  conflictType:    ConflictType;
  severity:        ConflictSeverity;
  status:          ConflictStatus;
  owner?:          string | null;
  location?:       string | null;
  dateIdentified:  string;
  neededBy?:       string | null;
  resolutionNotes?: string | null;
  isAutoDetected:  boolean;
  createdAt:       string;
  updatedAt:       string;
}

// ─── Parser Types ─────────────────────────────────────────────────────────────

export interface ParsedActivity {
  category:                    string;
  activityDescription:         string;
  responsibleSubcontractorRaw: string;
  location:                    string;
  plannedStart?:               Date;
  plannedFinish?:              Date;
  actualStart?:                Date;
  actualFinish?:               Date;
  occurrences:                 ParsedOccurrence[];
}

export interface ParsedOccurrence {
  plannedDate:      Date;
  plannedWeekLabel: string;
  dayOfWeek:        string;
}

export interface ParsedLookahead {
  projectName:   string;
  lookaheadName: string;
  startDate:     Date;
  endDate:       Date;
  activities:    ParsedActivity[];
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalActivities:      number;
  planned:              number;
  inProgress:           number;
  complete:             number;
  delayed:              number;
  missed:               number;
  blocked:              number;
  needsFollowUp:        number;
  openConflicts:        number;
  todayActivities:      Activity[];
  thisWeekActivities:   Activity[];
  recentLookaheads:     Lookahead[];
  subcontractorWorkload: SubcontractorWorkload[];
}

export interface SubcontractorWorkload {
  name:        string;
  total:       number;
  complete:    number;
  delayed:     number;
  planned:     number;
}
