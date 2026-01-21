export type RideType = "XC" | "Trail" | "Enduro" | "Gravel" | "Road";
export type SkillLevel = "Beginner" | "Intermediate" | "Advanced";
export type Pace = "Slow" | "Moderate" | "Fast";
export type JoinMode = "express" | "approval";

export type CreateRideDraft = {
  start_at?: string; // ISO string
  duration_hours?: number; // Ride duration in hours (1-12)
  start_name?: string | null; // Meeting point description (required)
  start_lat?: number; // Required - latitude of meeting point
  start_lng?: number; // Required - longitude of meeting point

  ride_type?: RideType;
  skill_level?: SkillLevel;
  pace?: Pace | null;

  distance_km?: number | null;
  elevation_m?: number | null;

  join_mode?: JoinMode;
  max_participants?: number;
  gender_preference?: "all" | "men" | "women";

  notes?: string | null; // Route description (optional)
};

export function draftIsStepValid(step: number, d: CreateRideDraft): boolean {
  switch (step) {
    case 0: // When
      return !!d.start_at && !!d.duration_hours;
    case 1: // Where - need meeting point text AND coordinates
      return !!d.start_name && d.start_name.trim().length > 0
        && d.start_lat !== undefined && d.start_lng !== undefined
        && d.start_lat !== 0 && d.start_lng !== 0;
    case 2: // Details
      return !!d.ride_type && !!d.skill_level && !!d.pace;
    case 3: // Group
      return !!d.join_mode && typeof d.max_participants === "number" && d.max_participants >= 2 && d.max_participants <= 6;
    case 4: // Review
      return true;
    default:
      return false;
  }
}