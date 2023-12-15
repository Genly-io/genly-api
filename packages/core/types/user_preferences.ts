export interface WorkspaceUserPreferences {
  userId: string;
  workspaceId: string;
  timeZone?: string;
  calendarDaysPerWeek?: number;
  calendarDayStartsAt?: number;
  calendarShowHours?: number;
  postQueuesOrder?: string[];
}

export interface UserPreferences {
  userId: string;
  activeWorkspaceId?: string;
  calendarDaysPerWeek?: number;
  calendarDayStartsAt?: number;
  calendarShowHours?: number;
  workspaces?: {
    [workspaceId: string]: WorkspaceUserPreferences;
  };
}

export interface WorkspaceUserPreferencesUpdateProps {
  timeZone?: string | null;
  calendarDaysPerWeek?: number | null;
  calendarDayStartsAt?: number | null;
  calendarShowHours?: number | null;
  postQueuesOrder?: string[] | null;
}

export interface UserPreferencesUpdateProps {
  activeWorkspaceId?: string | null;
  calendarDaysPerWeek?: number | null;
  calendarDayStartsAt?: number | null;
  calendarShowHours?: number | null;
  workspaces?: {
    [workspaceId: string]: WorkspaceUserPreferencesUpdateProps | null;
  } | null;
}
