// Aircraft task templates define what ground operations are required
// for each aircraft type during turnaround. Wide-body aircraft (A380, A350, B787)
// require cargo handling; narrow-body (B737) do not.

export interface TaskTemplate {
  name: string;
  estimatedDurationMinutes: number;
  requiredCertification?: string;
  order: number;
}

// Wide-body turnaround: 7 tasks including cargo operations
const WIDE_BODY_TASKS: TaskTemplate[] = [
  { name: 'deboarding', estimatedDurationMinutes: 45, order: 1 },
  {
    name: 'fueling',
    estimatedDurationMinutes: 60,
    requiredCertification: 'fueling',
    order: 2,
  },
  { name: 'catering', estimatedDurationMinutes: 40, requiredCertification: 'catering', order: 3 },
  { name: 'cabin_cleaning', estimatedDurationMinutes: 50, requiredCertification: 'cleaning', order: 4 },
  {
    name: 'cargo_unload',
    estimatedDurationMinutes: 55,
    requiredCertification: 'cargo',
    order: 5,
  },
  {
    name: 'cargo_load',
    estimatedDurationMinutes: 55,
    requiredCertification: 'cargo',
    order: 6,
  },
  { name: 'boarding', estimatedDurationMinutes: 50, requiredCertification: 'boarding', order: 7 },
];

// Narrow-body turnaround: 5 tasks, no cargo handling
const NARROW_BODY_TASKS: TaskTemplate[] = [
  { name: 'deboarding', estimatedDurationMinutes: 20, order: 1 },
  {
    name: 'fueling',
    estimatedDurationMinutes: 30,
    requiredCertification: 'fueling',
    order: 2,
  },
  { name: 'catering', estimatedDurationMinutes: 20, requiredCertification: 'catering', order: 3 },
  { name: 'cabin_cleaning', estimatedDurationMinutes: 25, requiredCertification: 'cleaning', order: 4 },
  { name: 'boarding', estimatedDurationMinutes: 25, requiredCertification: 'boarding', order: 5 },
];

// Scale task durations by a factor (aircraft size differences)
function scaleTasks(tasks: TaskTemplate[], factor: number): TaskTemplate[] {
  return tasks.map((t) => ({
    ...t,
    estimatedDurationMinutes: Math.round(t.estimatedDurationMinutes * factor),
  }));
}

// Template lookup: aircraft type → task list with scaled durations
const AIRCRAFT_TEMPLATES: Record<string, TaskTemplate[]> = {
  A380: WIDE_BODY_TASKS, // Full durations — largest aircraft
  A350: scaleTasks(WIDE_BODY_TASKS, 0.85), // 85% of A380 durations
  B787: scaleTasks(WIDE_BODY_TASKS, 0.8), // 80% of A380 durations
  B737: NARROW_BODY_TASKS,
};

// Returns the task template for a given aircraft type.
// Falls back to narrow-body tasks for unknown aircraft.
export function getTasksForAircraft(aircraftType: string): TaskTemplate[] {
  return AIRCRAFT_TEMPLATES[aircraftType] || NARROW_BODY_TASKS;
}
