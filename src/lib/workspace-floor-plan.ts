export const workspaceFloors = {
  general: { label: 'General Layout' },
  mezzanine: { label: 'Mezzanine Floor' },
} as const;

export type WorkspaceFloor = keyof typeof workspaceFloors;
export const workspaceFloorIds = Object.keys(workspaceFloors) as WorkspaceFloor[];

type PlanPoint = readonly [x: number, y: number];
export type WorkspaceSeat = { id: string; point: PlanPoint };
export type WorkspaceUnit = {
  id: string;
  displayId: string;
  floor: WorkspaceFloor;
  point: PlanPoint;
  seats: WorkspaceSeat[];
};

// Points correspond to the original 827 × 1169 drawings.
const generalChairs: (PlanPoint | null)[] = [
  ...[188, 241, 294].map((y): PlanPoint => [235, y]),
  ...[287, 373, 447, 535].flatMap((x) => [178, 232, 286, 340].map((y): PlanPoint => [x, y])),
  ...[190, 246, 301, 357].map((y): PlanPoint => [602, y]),
  null, // G-24 was removed. Keep later chair IDs stable for existing allocations.
  ...[494, 561, 652, 705, 758].map((y): PlanPoint => [383, y]),
  [510, 553], [569, 510], [620, 510], [569, 598], [620, 598],
  [510, 720], [569, 677], [620, 677], [569, 765], [620, 765],
];

const cubicleChairs: PlanPoint[][] = [
  [[265, 172], [228, 196], [308, 196], [226, 241], [308, 241]],
  [[409, 172], [365, 196], [447, 196], [364, 241], [447, 241]],
  [[564, 172], [515, 196], [619, 196], [515, 241], [619, 241]],
];

const formatNumber = (index: number) => String(index + 1).padStart(2, '0');
const originalGeneralChairs = generalChairs.flatMap((point, index) =>
  point ? [{ id: `G-${formatNumber(index)}`, point }] : [],
);
const activeGeneralChairs = [
  ...originalGeneralChairs.slice(0, 3),
  // The chair below G-03 gets a new storage ID and the next visible number.
  { id: 'G-40', point: [235, 340] as const },
  ...originalGeneralChairs.slice(3),
];

export const workspaceUnits: WorkspaceUnit[] = [
  ...activeGeneralChairs.map(({ id, point }, index): WorkspaceUnit => ({
    id, displayId: `G-${formatNumber(index)}`, floor: 'general', point, seats: [{ id, point }],
  })),
  ...cubicleChairs.map((points, index): WorkspaceUnit => {
    const id = `M-${formatNumber(index)}`;
    return {
      id,
      displayId: id,
      floor: 'mezzanine',
      point: [points[0][0], 221],
      seats: points.map((point, seatIndex) => ({ id: `${id}-${formatNumber(seatIndex)}`, point })),
    };
  }),
];

export const unitById = new Map(workspaceUnits.map((unit) => [unit.id, unit]));
export const seatIds = new Set(workspaceUnits.flatMap((unit) => unit.seats.map((seat) => seat.id)));

export type WorkspaceOccupancy =
  | { status: 'allocated'; companyId: string }
  | { status: 'reserved'; reason: string };

export type WorkspaceSnapshot = {
  version: string;
  occupancy: Record<string, WorkspaceOccupancy | undefined>;
};

export type WorkspaceCompany = { id: string; name: string; eligible: boolean };

export type WorkspaceAction =
  | { action: 'assign'; unitIds: string[]; companyId: string }
  | { action: 'move'; fromUnitIds: string[]; unitIds: string[] }
  | { action: 'release-allocation'; unitIds: string[] }
  | { action: 'reserve'; seatIds: string[]; reason: string }
  | { action: 'release-reservation'; seatIds: string[] };

export const workspaceStatuses = {
  available: 'Available',
  allocated: 'Allocated to Company',
  reserved: 'Reserved for Administration',
  blocked: 'Blocked by Seat Reservation',
  shared: 'Shared',
} as const;

export function getUnitStatus(unit: WorkspaceUnit, occupancy: WorkspaceSnapshot['occupancy']) {
  const first = occupancy[unit.seats[0].id];
  if (first?.status === 'allocated') return first;
  if (unit.seats.some(({ id }) => occupancy[id]?.status === 'reserved')) {
    return { status: 'reserved' } as const;
  }
  return { status: 'available' } as const;
}

export function getFloorCounts(floor: WorkspaceFloor, occupancy: WorkspaceSnapshot['occupancy']) {
  const counts = { available: 0, allocated: 0, reserved: 0, blocked: 0 };
  for (const unit of workspaceUnits.filter((unit) => unit.floor === floor)) {
    const status = getUnitStatus(unit, occupancy).status;
    for (const { id } of unit.seats) {
      const seatStatus = occupancy[id]?.status ?? (status === 'reserved' ? 'blocked' : 'available');
      counts[seatStatus] += 1;
    }
  }
  return counts;
}
