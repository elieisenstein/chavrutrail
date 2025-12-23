export type RideType = "XC" | "Trail" | "Enduro" | "Gravel";
export type SkillLevel = "Beginner" | "Intermediate" | "Advanced";
export type Pace = "Slow" | "Moderate" | "Fast";
export type JoinMode = "express" | "approval";

export type CreateRideDraft = {
  start_at?: string; // ISO string
  start_lat?: number;
  start_lng?: number;
  start_name?: string | null;

  ride_type?: RideType;
  skill_level?: SkillLevel;
  pace?: Pace | null;

  distance_km?: number | null;
  elevation_m?: number | null;

  join_mode?: JoinMode;
  max_participants?: number;

  notes?: string | null;
};

export function draftIsStepValid(step: number, d: CreateRideDraft): boolean {
  switch (step) {
    case 0: // When
      return !!d.start_at;
    case 1: // Where
      return typeof d.start_lat === "number" && typeof d.start_lng === "number";
    case 2: // Details
      return !!d.ride_type && !!d.skill_level;
    case 3: // Group
      return !!d.join_mode && typeof d.max_participants === "number" && d.max_participants >= 1 && d.max_participants <= 6;
    case 4: // Review
      return true;
    default:
      return false;
  }
}
