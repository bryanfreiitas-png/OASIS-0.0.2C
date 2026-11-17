import type { ActionId, Direction, RoomId } from '../shared/types.ts';
import type { TurnaroundView } from './pixelAvatarRenderer.ts';

export type SceneRoomId = 'praca' | 'balada' | 'cafeteria';

export interface SceneHotspot {
  id: string;
  kind: 'portal' | 'bench' | 'catalog' | 'job_kiosk' | 'food_kiosk' | 'warp';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  label: string;
  targetRoom?: RoomId;
  routineAction?: string;
  sitPos?: { px: number; py: number; dir: Direction; view?: TurnaroundView };
  approachPos?: { px: number; py: number; dir?: Direction; view?: TurnaroundView };
  warpDest?: { px: number; py: number; dir: Direction; view?: TurnaroundView };
}

export interface SceneDepthProp {
  id: string;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
  baseY: number;
}

export interface SceneWarpLink {
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  dirToB: Direction;
  viewToB: TurnaroundView;
  dirToA: Direction;
  viewToA: TurnaroundView;
}

export interface SceneMapConfig {
  id: SceneRoomId;
  width: number;
  height: number;
  stepPx: number;
  cols: number;
  rows: number;
  avatarScale: number;
  mapUrl: string;
  videoUrl: string;
  videoCrop: { sx: number; sy: number; sw: number; sh: number } | null;
  spawnPx: { px: number; py: number };
  fallbackWalkable: { px: number; py: number };
  loadingText: string;
  walkHint: string;
  hotspots: SceneHotspot[];
  depthProps: SceneDepthProp[];
  warpLinks: SceneWarpLink[];
  isRawBlocked: (px: number, py: number) => boolean;
}

export interface SceneWalkStep {
  x: number;
  y: number;
  dir: Direction;
  view?: TurnaroundView;
  action?: ActionId;
  isWarp?: boolean;
}

// ============================================================
// 1) PRAÇA CENTRAL (1240 x 816)
// ============================================================
const PRACA_HOTSPOTS: SceneHotspot[] = [
  {
    id: 'portal_balada',
    kind: 'portal',
    x0: 15,
    y0: 215,
    x1: 235,
    y1: 525,
    label: 'Entrar na Balada Neon',
    targetRoom: 'balada',
  },
  {
    id: 'portal_shopping',
    kind: 'catalog',
    x0: 245,
    y0: 15,
    x1: 515,
    y1: 245,
    label: 'Abrir Catálogo OASIS',
  },
  {
    id: 'portal_cafeteria',
    kind: 'portal',
    x0: 625,
    y0: 5,
    x1: 830,
    y1: 215,
    label: 'Entrar na Cafeteria Aroma',
    targetRoom: 'cafeteria',
  },
  {
    id: 'portal_mercado',
    kind: 'portal',
    x0: 955,
    y0: 30,
    x1: 1195,
    y1: 310,
    label: 'Entrar no Mercado da Vila',
    targetRoom: 'mercado',
  },
  {
    id: 'bench_tl',
    kind: 'bench',
    x0: 550,
    y0: 325,
    x1: 632,
    y1: 392,
    label: 'Sentar no banco da Fonte',
    sitPos: { px: 590, py: 368, dir: 'direita', view: '3/4' },
  },
  {
    id: 'bench_tr',
    kind: 'bench',
    x0: 762,
    y0: 315,
    x1: 842,
    y1: 382,
    label: 'Sentar no banco Nordeste',
    sitPos: { px: 806, py: 356, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'bench_bot',
    kind: 'bench',
    x0: 600,
    y0: 515,
    x1: 695,
    y1: 588,
    label: 'Sentar no banco Sul',
    sitPos: { px: 650, py: 560, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'bench_lower_left',
    kind: 'bench',
    x0: 460,
    y0: 530,
    x1: 575,
    y1: 605,
    label: 'Sentar no banco Oeste',
    sitPos: { px: 522, py: 566, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'bench_street',
    kind: 'bench',
    x0: 845,
    y0: 660,
    x1: 965,
    y1: 745,
    label: 'Sentar no banco da Rua',
    sitPos: { px: 904, py: 716, dir: 'esquerda', view: '3/4_esquerda' },
  },
];

const PRACA_DEPTH_PROPS: SceneDepthProp[] = [
  { id: 'fountain_spire', url: '/assets/maps/praca_depth/fountain_spire.png', x: 678, y: 268, w: 66, h: 92, baseY: 404 },
  { id: 'tree_left', url: '/assets/maps/praca_depth/tree_left.png', x: 248, y: 200, w: 145, h: 206, baseY: 420 },
  { id: 'phone_booth', url: '/assets/maps/praca_depth/phone_booth.png', x: 1108, y: 366, w: 99, h: 201, baseY: 556 },
  { id: 'lamp_west', url: '/assets/maps/praca_depth/lamp_west.png', x: 318, y: 422, w: 47, h: 144, baseY: 562 },
  { id: 'hotdog_cart', url: '/assets/maps/praca_depth/hotdog_cart.png', x: 956, y: 512, w: 139, h: 169, baseY: 668 },
  { id: 'lamp_south', url: '/assets/maps/praca_depth/lamp_south.png', x: 712, y: 564, w: 65, h: 155, baseY: 716 },
  { id: 'bus_sign', url: '/assets/maps/praca_depth/bus_sign.png', x: 778, y: 612, w: 55, h: 125, baseY: 726 },
];

const PRACA_OBSTACLE_BOXES: Array<[number, number, number, number]> = [
  [220, 355, 325, 480],
  [295, 360, 408, 446],
  [230, 505, 355, 610],
  [305, 588, 380, 656],
  [378, 622, 416, 670],
  [575, 195, 700, 268],
  [695, 168, 848, 255],
  [880, 145, 972, 232],
  [955, 195, 1020, 275],
  [512, 348, 575, 412],
  [548, 322, 634, 392],
  [652, 285, 750, 354],
  [760, 312, 845, 384],
  [852, 325, 945, 422],
  [908, 402, 1012, 496],
  [418, 415, 548, 514],
  [596, 514, 696, 578],
  [424, 502, 564, 590],
  [554, 614, 616, 666],
  [638, 616, 712, 676],
  [578, 678, 712, 745],
  [704, 642, 772, 722],
  [408, 658, 496, 730],
  [768, 645, 835, 732],
  [838, 638, 965, 748],
  [865, 560, 955, 642],
  [975, 602, 1095, 686],
  [1092, 550, 1140, 625],
  [1056, 474, 1122, 532],
  [1108, 472, 1212, 576],
];

function isPracaRawBlocked(px: number, py: number): boolean {
  if (px < 236 || px > 1135 || py < 185 || py > 745) return true;
  if (py < 395 - 0.65 * (px - 235)) return true;
  if (px >= 535 && px < 935 && py < 214) return true;
  if (px >= 935 && px < 215 + 0.60 * (px - 935)) return true;
  if (py > 545 + 0.53 * (px - 235)) return true;
  if (py > 745 - 0.49 * (px - 720)) return true;

  const fx = (px - 710) / 152;
  const fy = (py - 442) / 104;
  if (fx * fx + fy * fy < 1) return true;

  for (const [x0, y0, x1, y1] of PRACA_OBSTACLE_BOXES) {
    if (px >= x0 && px <= x1 && py >= y0 && py <= y1) return true;
  }
  return false;
}

// ============================================================
// 2) BALADA NEON (1280 x 720 — calçada VIP, pátio e pista)
// ============================================================
const BALADA_HOTSPOTS: SceneHotspot[] = [
  {
    id: 'balada_exit_praca',
    kind: 'portal',
    x0: 10,
    y0: 540,
    x1: 278,
    y1: 715,
    label: 'Voltar para Praça Central',
    targetRoom: 'praca',
    approachPos: { px: 224, py: 584, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'balada_dj_booth',
    kind: 'job_kiosk',
    x0: 718,
    y0: 195,
    x1: 925,
    y1: 300,
    label: 'Tocar na Mesa de DJ (F2P)',
    approachPos: { px: 785, py: 318, dir: 'costas', view: 'costas' },
  },
  {
    id: 'balada_door_enter',
    kind: 'warp',
    x0: 365,
    y0: 275,
    x1: 445,
    y1: 410,
    label: 'Entrar na Pista VIP',
    approachPos: { px: 408, py: 404, dir: 'costas', view: 'costas_direita' },
    warpDest: { px: 632, py: 332, dir: 'direita', view: '3/4' },
  },
  {
    id: 'balada_vip_couch_1',
    kind: 'bench',
    x0: 604,
    y0: 344,
    x1: 641,
    y1: 396,
    label: 'Sentar no Sofá da Pista (1)',
    sitPos: { px: 632, py: 374, dir: 'costas', view: 'costas_direita' },
  },
  {
    id: 'balada_vip_couch_2',
    kind: 'bench',
    x0: 642,
    y0: 356,
    x1: 675,
    y1: 408,
    label: 'Sentar no Sofá da Pista (2)',
    sitPos: { px: 660, py: 386, dir: 'costas', view: 'costas_direita' },
  },
  {
    id: 'balada_vip_couch_3',
    kind: 'bench',
    x0: 676,
    y0: 368,
    x1: 709,
    y1: 420,
    label: 'Sentar no Sofá da Pista (3)',
    sitPos: { px: 688, py: 398, dir: 'costas', view: 'costas_direita' },
  },
  {
    id: 'balada_vip_couch_4',
    kind: 'bench',
    x0: 710,
    y0: 380,
    x1: 748,
    y1: 432,
    label: 'Sentar no Sofá da Pista (4)',
    sitPos: { px: 716, py: 410, dir: 'costas', view: 'costas_direita' },
  },
  {
    id: 'balada_patio_sofa_l1',
    kind: 'bench',
    x0: 512,
    y0: 526,
    x1: 537,
    y1: 556,
    label: 'Sentar no Lounge Externo (1)',
    sitPos: { px: 526, py: 554, dir: 'direita', view: '3/4' },
  },
  {
    id: 'balada_patio_sofa_l2',
    kind: 'bench',
    x0: 538,
    y0: 516,
    x1: 566,
    y1: 548,
    label: 'Sentar no Lounge Externo (2)',
    sitPos: { px: 548, py: 546, dir: 'direita', view: '3/4' },
  },
  {
    id: 'balada_patio_sofa_r1',
    kind: 'bench',
    x0: 612,
    y0: 526,
    x1: 636,
    y1: 564,
    label: 'Sentar no Lounge Externo (3)',
    sitPos: { px: 624, py: 560, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'balada_patio_sofa_r2',
    kind: 'bench',
    x0: 637,
    y0: 540,
    x1: 662,
    y1: 578,
    label: 'Sentar no Lounge Externo (4)',
    sitPos: { px: 644, py: 574, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'balada_bar_stool_1',
    kind: 'bench',
    x0: 932,
    y0: 296,
    x1: 968,
    y1: 358,
    label: 'Sentar na Banqueta 1 do Bar',
    sitPos: { px: 950, py: 328, dir: 'costas', view: 'costas_direita' },
  },
  {
    id: 'balada_bar_stool_2',
    kind: 'bench',
    x0: 969,
    y0: 306,
    x1: 1003,
    y1: 368,
    label: 'Sentar na Banqueta 2 do Bar',
    sitPos: { px: 986, py: 338, dir: 'costas', view: 'costas_direita' },
  },
  {
    id: 'balada_bar_stool_3',
    kind: 'bench',
    x0: 1004,
    y0: 316,
    x1: 1037,
    y1: 378,
    label: 'Sentar na Banqueta 3 do Bar',
    sitPos: { px: 1020, py: 348, dir: 'costas', view: 'costas_direita' },
  },
  {
    id: 'balada_bar_stool_4',
    kind: 'bench',
    x0: 1038,
    y0: 326,
    x1: 1074,
    y1: 390,
    label: 'Sentar na Banqueta 4 do Bar',
    sitPos: { px: 1054, py: 358, dir: 'costas', view: 'costas_direita' },
  },
  {
    id: 'balada_mid_sofa_1',
    kind: 'bench',
    x0: 924,
    y0: 374,
    x1: 957,
    y1: 424,
    label: 'Sentar no Sofá do Bar (1)',
    sitPos: { px: 944, py: 410, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'balada_mid_sofa_2',
    kind: 'bench',
    x0: 958,
    y0: 386,
    x1: 984,
    y1: 436,
    label: 'Sentar no Sofá do Bar (2)',
    sitPos: { px: 970, py: 422, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'balada_mid_sofa_3',
    kind: 'bench',
    x0: 985,
    y0: 398,
    x1: 1011,
    y1: 448,
    label: 'Sentar no Sofá do Bar (3)',
    sitPos: { px: 996, py: 434, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'balada_mid_sofa_4',
    kind: 'bench',
    x0: 1012,
    y0: 410,
    x1: 1050,
    y1: 462,
    label: 'Sentar no Sofá do Bar (4)',
    sitPos: { px: 1024, py: 446, dir: 'esquerda', view: '3/4_esquerda' },
  },
];

const BALADA_OBSTACLE_BOXES: Array<[number, number, number, number]> = [
  // Far-left planters, bushes, outdoor café table & corner lamp
  [0, 340, 195, 435],
  [0, 425, 138, 535],
  [118, 385, 224, 452],
  [135, 488, 206, 574],
  // Left speaker & front awning wall beside doorway (leaves red carpet opening completely clear)
  [282, 325, 350, 402],
  // Balada right glass wall, speakers & square planter (separates outside sidewalk from interior VIP couch)
  [446, 378, 622, 474],
  // Sidewalk yellow planter & silver trash can
  [335, 588, 468, 658],
  [468, 620, 518, 684],
  // Interior DJ Booth stage & speakers
  [715, 215, 932, 304],
  // Interior VIP leather couch + small planter beside it (walkway stays clear behind and to the right)
  [608, 352, 752, 418],
  [750, 380, 816, 432],
  // Interior Cocktail Bar counter & stools (leaves open aisle below stools)
  [922, 285, 1110, 358],
  // Right outer palm planter & building edge
  [1078, 348, 1220, 458],
  [1092, 445, 1185, 530],
  // Mid-right leather sofa (stepped diagonal) & two small round bistro tables (calibrated to artwork)
  [926, 384, 988, 434],
  [982, 404, 1044, 452],
  [814, 468, 892, 524],
  [890, 446, 956, 496],
  // Front patio long green hedge planter (leaves stairs->patio corridor open on both sides)
  [694, 496, 828, 574],
  // Lower-left patio sofa + bistro table
  [508, 514, 608, 574],
  [658, 574, 728, 622],
  // Bottom patio green planter along fence corner
  [736, 608, 868, 692],
  // Right patio umbrella tables
  [862, 512, 946, 598],
  [964, 478, 1052, 550],
];

function pointToSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

function isBaladaRawBlocked(px: number, py: number): boolean {
  // Outer canvas safety margin
  if (px < 120 || px > 1135 || py < 238 || py > 704) return true;

  // Bottom-left street/crosswalk curb (keeps players strictly on lit sidewalk)
  if (py > 480 + 0.54 * px) return true;
  // Bottom-right greenery & street curb
  if (py > 708 - 0.52 * Math.max(0, px - 845)) return true;

  // Top building & interior walls (except open doorway nook [364..442, 368..430] and red carpet corridor)
  const inMainDoorway = px >= 364 && px <= 442 && py >= 368 && py <= 430;
  if (!inMainDoorway) {
    // Left facade exterior wall
    if (px < 588 && py < 402 - 0.16 * Math.max(0, px - 250)) {
      if (!(px >= 200 && px <= 445 && py >= 380)) return true;
    }
    // Diagonal interior back-left wall behind dance floor (588, 300) -> (735, 228)
    if (px >= 588 && px < 740 && py < 306 - 0.49 * (px - 588)) return true;
    // Diagonal interior back-right wall behind DJ & Bar (735, 228) -> (1135, 380)
    if (px >= 740 && py < 230 + 0.38 * (px - 740)) return true;
  }

  // Thin vertical neon wall separating lobby facade & interior dance floor (556..602, 260..388)
  if (px >= 556 && px <= 602 && py >= 260 && py <= 388) return true;

  // Glass safety guardrail between Dance Floor and Center Terrace (742, 348) -> (860, 400), leaving wide stair/floor gap at right (px > 860)
  if (pointToSegDist(px, py, 742, 348, 860, 400) < 7) return true;

  // VIP velvet-rope side barriers (keeps front entrance open around (228, 515) up red carpet to door (408, 404))
  if (pointToSegDist(px, py, 206, 474, 356, 398) < 8) return true;
  if (pointToSegDist(px, py, 252, 526, 448, 434) < 8) return true;

  // Front patio neon-blue outer fence rails
  if (pointToSegDist(px, py, 458, 514, 840, 682) < 9) return true;
  if (pointToSegDist(px, py, 840, 682, 1116, 536) < 9) return true;
  if (pointToSegDist(px, py, 1116, 536, 1076, 450) < 9) return true;

  for (const [x0, y0, x1, y1] of BALADA_OBSTACLE_BOXES) {
    if (px >= x0 && px <= x1 && py >= y0 && py <= y1) return true;
  }
  return false;
}

// ============================================================
// 3) CAFETERIA AROMA (1092 x 720 — cropped from 1280x720 at sx=94)
// ============================================================
const CAFETERIA_HOTSPOTS: SceneHotspot[] = [
  {
    id: 'cafe_exit_praca',
    kind: 'portal',
    x0: 4,
    y0: 360,
    x1: 118,
    y1: 480,
    label: 'Voltar para Praça Central',
    targetRoom: 'praca',
    approachPos: { px: 56, py: 428, dir: 'esquerda', view: '3/4_esquerda' },
  },
  {
    id: 'cafe_barista_door',
    kind: 'job_kiosk',
    x0: 446,
    y0: 270,
    x1: 525,
    y1: 428,
    label: 'Trabalhar de Barista (F2P)',
    approachPos: { px: 484, py: 426, dir: 'costas', view: 'costas' },
  },
  {
    id: 'cafe_pastry_counter',
    kind: 'food_kiosk',
    x0: 526,
    y0: 245,
    x1: 645,
    y1: 382,
    label: 'Tomar Café & Doce (-8 moedas)',
    routineAction: 'lanche_cafeteria',
    approachPos: { px: 572, py: 392, dir: 'costas', view: 'costas_esquerda' },
  },
  {
    id: 'cafe_bench_wood',
    kind: 'bench',
    x0: 262,
    y0: 480,
    x1: 385,
    y1: 556,
    label: 'Sentar no Banco da Cafeteria',
    sitPos: { px: 324, py: 522, dir: 'direita', view: '3/4' },
  },
  {
    id: 'cafe_pergola_sofa',
    kind: 'bench',
    x0: 768,
    y0: 292,
    x1: 900,
    y1: 370,
    label: 'Sentar no Sofá do Pergolado',
    sitPos: { px: 822, py: 344, dir: 'frente', view: '3/4_esquerda' },
  },
];

const CAFETERIA_OBSTACLE_BOXES: Array<[number, number, number, number]> = [
  // Left big tree trunk & raised planter box (leaves clean alley corridor below at y=406..456)
  [66, 290, 180, 404],
  // Left lamppost, planter & trash can
  [36, 456, 165, 558],
  // Cafeteria brick building footprint + stepped isometric left planter + chalkboard + pastry counter + potted plant
  [185, 220, 262, 404],
  [254, 375, 315, 412],
  [300, 400, 378, 432],
  [394, 385, 452, 452],
  [514, 298, 668, 388],
  [604, 326, 676, 382],
  // Pergola inner wooden sofa & front coffee table + chairs (leaves wide pergola doorway at x=798..844)
  [770, 294, 898, 348],
  [718, 342, 796, 390],
  // Pergola front-right wooden planter
  [846, 392, 952, 452],
  // Right palm tree & corner planter
  [944, 342, 1062, 428],
  // Courtyard 4 tables + chairs
  [186, 446, 294, 508], // Left white umbrella table
  [264, 496, 376, 554], // Wooden bench (approachable directly from courtyard side at y~480)
  [378, 506, 418, 550], // Small square planter beside wooden bench
  [436, 536, 598, 638], // Bottom-center white umbrella table
  [574, 418, 708, 506], // Center-right white umbrella table
  [772, 462, 888, 554], // Right bistro table
  // Right edge lamps & bushes
  [980, 524, 1036, 616],
  [1004, 444, 1092, 546],
  // Bottom perimeter flower planters inside iron fence
  [248, 564, 330, 626],
  [310, 588, 416, 666],
  [464, 642, 576, 718],
  [554, 608, 666, 692],
  [704, 580, 812, 658],
  [766, 540, 876, 618],
];

function isCafeteriaRawBlocked(px: number, py: number): boolean {
  // Keep inside courtyard bounds
  if (px < 24 || px > 1062 || py < 238 || py > 698) return true;

  // Bottom-left iron fence & road curb
  if (py > 448 + 0.465 * px) return true;
  // Bottom-right iron fence & road curb
  if (py > 698 - 0.44 * Math.max(0, px - 540)) return true;

  // Back brick building & upper bushes behind cafeteria & pergola
  if (px >= 180 && px < 454 && py < 312 + 0.44 * (px - 180)) return true;
  if (px >= 454 && px < 525 && py < 395) return true; // Allows stepping right onto door mat (454..520, y>=395)
  if (px >= 525 && px < 680 && py < 318 + 0.42 * (680 - px)) return true;
  // Behind pergola roof & back hedge
  if (px >= 675 && py < 292 + 0.16 * (px - 675)) return true;
  // Left alley back hedge behind tree
  if (px < 185 && py < 305) return true;

  for (const [x0, y0, x1, y1] of CAFETERIA_OBSTACLE_BOXES) {
    if (px >= x0 && px <= x1 && py >= y0 && py <= y1) return true;
  }
  return false;
}

export const SCENE_MAPS: Record<SceneRoomId, SceneMapConfig> = {
  praca: {
    id: 'praca',
    width: 1240,
    height: 816,
    stepPx: 16,
    cols: Math.floor(1240 / 16),
    rows: Math.floor(816 / 16),
    avatarScale: 1.25,
    mapUrl: '/assets/maps/praca_central_clean.png',
    videoUrl: '/assets/aistudio/Pixel_art_square_at_night_9ee6032c_a88eece1.mp4',
    videoCrop: { sx: 100, sy: 0, sw: 1080, sh: 720 },
    spawnPx: { px: 473, py: 334 },
    fallbackWalkable: { px: 568, py: 520 },
    loadingText: 'Carregando Praça Central...',
    walkHint: 'Clique na calçada ou use WASD para andar · Clique nas lojas ou bancos',
    hotspots: PRACA_HOTSPOTS,
    depthProps: PRACA_DEPTH_PROPS,
    warpLinks: [],
    isRawBlocked: isPracaRawBlocked,
  },
  balada: {
    id: 'balada',
    width: 1280,
    height: 720,
    stepPx: 16,
    cols: Math.floor(1280 / 16),
    rows: Math.floor(720 / 16),
    avatarScale: 1.15,
    mapUrl: '/assets/maps/balada_clean.png',
    videoUrl: '/assets/aistudio/BALADA_6c3b2f44.mp4',
    videoCrop: null,
    spawnPx: { px: 312, py: 552 },
    fallbackWalkable: { px: 312, py: 552 },
    loadingText: 'Carregando Balada Neon...',
    walkHint: 'Entre pelo tapete VIP ou suba a escada neon para a pista e o bar!',
    hotspots: BALADA_HOTSPOTS,
    depthProps: [],
    warpLinks: [
      {
        id: 'balada_front_door',
        ax: 408,
        ay: 400,
        bx: 632,
        by: 332,
        dirToB: 'direita',
        viewToB: '3/4',
        dirToA: 'frente',
        viewToA: '3/4_esquerda',
      },
    ],
    isRawBlocked: isBaladaRawBlocked,
  },
  cafeteria: {
    id: 'cafeteria',
    width: 1092,
    height: 720,
    stepPx: 16,
    cols: Math.floor(1092 / 16),
    rows: Math.floor(720 / 16),
    avatarScale: 1.18,
    mapUrl: '/assets/maps/cafeteria_clean.png',
    videoUrl: '/assets/aistudio/cafeteria_2e09f059.mp4',
    videoCrop: { sx: 94, sy: 0, sw: 1092, sh: 720 },
    spawnPx: { px: 472, py: 488 },
    fallbackWalkable: { px: 472, py: 488 },
    loadingText: 'Carregando Cafeteria Aroma...',
    walkHint: 'Explore o pátio, entre no pergolado ou clique na porta para trabalhar de Barista!',
    hotspots: CAFETERIA_HOTSPOTS,
    depthProps: [],
    warpLinks: [],
    isRawBlocked: isCafeteriaRawBlocked,
  },
};

export function isSceneRoom(roomId: RoomId): roomId is SceneRoomId {
  return roomId === 'praca' || roomId === 'balada' || roomId === 'cafeteria';
}

export function gridToScenePx(scene: SceneMapConfig, gx: number, gy: number) {
  return {
    px: (gx / 11) * scene.width,
    py: (gy / 11) * scene.height,
  };
}

export function scenePxToGrid(scene: SceneMapConfig, px: number, py: number) {
  return {
    x: Number(Math.max(0, Math.min(11, (px / scene.width) * 11)).toFixed(2)),
    y: Number(Math.max(0, Math.min(11, (py / scene.height) * 11)).toFixed(2)),
  };
}

export function isPointInsideSceneObstacle(scene: SceneMapConfig, px: number, py: number): boolean {
  return (
    scene.isRawBlocked(px, py) ||
    scene.isRawBlocked(px - 10, py) ||
    scene.isRawBlocked(px + 10, py) ||
    scene.isRawBlocked(px, py - 5) ||
    scene.isRawBlocked(px, py + 4)
  );
}

export function isSceneCellWalkable(scene: SceneMapConfig, c: number, r: number): boolean {
  if (c < 0 || r < 0 || c >= scene.cols || r >= scene.rows) return false;
  const cx = c * scene.stepPx + scene.stepPx / 2;
  const cy = r * scene.stepPx + scene.stepPx / 2;
  return !isPointInsideSceneObstacle(scene, cx, cy);
}

export function findNearestWalkableScene(
  scene: SceneMapConfig,
  targetPx: number,
  targetPy: number
): { px: number; py: number } {
  const sc = Math.max(0, Math.min(scene.cols - 1, Math.floor(targetPx / scene.stepPx)));
  const sr = Math.max(0, Math.min(scene.rows - 1, Math.floor(targetPy / scene.stepPx)));
  if (isSceneCellWalkable(scene, sc, sr)) {
    return {
      px: sc * scene.stepPx + scene.stepPx / 2,
      py: sr * scene.stepPx + scene.stepPx / 2,
    };
  }
  let bestDist = Infinity;
  let bestPx = scene.fallbackWalkable.px;
  let bestPy = scene.fallbackWalkable.py;
  for (let rad = 1; rad <= 18; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
        const nc = sc + dc;
        const nr = sr + dr;
        if (!isSceneCellWalkable(scene, nc, nr)) continue;
        const px = nc * scene.stepPx + scene.stepPx / 2;
        const py = nr * scene.stepPx + scene.stepPx / 2;
        const d = Math.hypot(px - targetPx, py - targetPy);
        if (d < bestDist) {
          bestDist = d;
          bestPx = px;
          bestPy = py;
        }
      }
    }
    if (bestDist < Infinity) return { px: bestPx, py: bestPy };
  }
  return scene.fallbackWalkable;
}

export function directionFromDelta(
  dx: number,
  dy: number,
  fallback: Direction = 'frente'
): Direction {
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'direita' : 'esquerda';
  }
  return dy > 0 ? 'frente' : 'costas';
}

export function turnaroundViewFromDelta(
  dx: number,
  dy: number,
  fallback: TurnaroundView = 'frente'
): TurnaroundView {
  if (dx === 0 && dy === 0) return fallback;
  const ang = Math.atan2(dy, dx);
  const deg = ((ang * 180) / Math.PI + 360) % 360;
  if (deg < 55 || deg >= 325) return '3/4';
  if (deg < 125) return 'frente';
  if (deg < 215) return '3/4_esquerda';
  if (deg < 250) return 'costas_esquerda';
  if (deg < 290) return 'costas';
  return 'costas_direita';
}

export function findScenePath(
  scene: SceneMapConfig,
  startPx: number,
  startPy: number,
  destPx: number,
  destPy: number,
  finalDir?: Direction,
  finalAction: ActionId = 'parado',
  finalView?: TurnaroundView
): SceneWalkStep[] {
  const toCol = (px: number) =>
    Math.max(0, Math.min(scene.cols - 1, Math.floor(px / scene.stepPx)));
  const toRow = (py: number) =>
    Math.max(0, Math.min(scene.rows - 1, Math.floor(py / scene.stepPx)));
  const cellCenter = (c: number, r: number) => ({
    px: c * scene.stepPx + scene.stepPx / 2,
    py: r * scene.stepPx + scene.stepPx / 2,
  });

  const startWalkable = findNearestWalkableScene(scene, startPx, startPy);
  const sc = toCol(startWalkable.px);
  const sr = toRow(startWalkable.py);

  const goalWalkable = findNearestWalkableScene(scene, destPx, destPy);
  const dc = toCol(goalWalkable.px);
  const dr = toRow(goalWalkable.py);

  const key = (c: number, r: number) => `${c},${r}`;
  const startKey = key(sc, sr);
  const goalKey = key(dc, dr);

  // Build invisible doorway warp neighbors so BFS seamlessly uses doorway corridors too
  const warpNeighbors = new Map<
    string,
    Array<{ nc: number; nr: number; dir: Direction; view: TurnaroundView; isWarp: boolean }>
  >();
  for (const wl of scene.warpLinks) {
    const aw = findNearestWalkableScene(scene, wl.ax, wl.ay);
    const bw = findNearestWalkableScene(scene, wl.bx, wl.by);
    const ac = toCol(aw.px);
    const ar = toRow(aw.py);
    const bc = toCol(bw.px);
    const br = toRow(bw.py);
    const aKey = key(ac, ar);
    const bKey = key(bc, br);
    if (!warpNeighbors.has(aKey)) warpNeighbors.set(aKey, []);
    if (!warpNeighbors.has(bKey)) warpNeighbors.set(bKey, []);
    warpNeighbors.get(aKey)!.push({
      nc: bc,
      nr: br,
      dir: wl.dirToB,
      view: wl.viewToB,
      isWarp: true,
    });
    warpNeighbors.get(bKey)!.push({
      nc: ac,
      nr: ar,
      dir: wl.dirToA,
      view: wl.viewToA,
      isWarp: true,
    });
  }

  const queue: Array<{ c: number; r: number }> = [{ c: sc, r: sr }];
  const visited = new Set<string>([startKey]);
  const parent = new Map<
    string,
    { pc: number; pr: number; dir: Direction; view: TurnaroundView; isWarp?: boolean }
  >();
  let found = startKey === goalKey;

  const dirs: Array<{ dc: number; dr: number; dir: Direction; view: TurnaroundView }> = [
    { dc: 1, dr: 0, dir: 'direita', view: '3/4' },
    { dc: -1, dr: 0, dir: 'esquerda', view: '3/4_esquerda' },
    { dc: 0, dr: 1, dir: 'frente', view: 'frente' },
    { dc: 0, dr: -1, dir: 'costas', view: 'costas' },
    { dc: 1, dr: 1, dir: 'direita', view: '3/4' },
    { dc: -1, dr: 1, dir: 'esquerda', view: '3/4_esquerda' },
    { dc: 1, dr: -1, dir: 'direita', view: 'costas_direita' },
    { dc: -1, dr: -1, dir: 'esquerda', view: 'costas_esquerda' },
  ];

  while (queue.length > 0 && !found) {
    const cur = queue.shift()!;
    const curKey = key(cur.c, cur.r);

    // Check normal 8-way neighbors
    for (const d of dirs) {
      const nc = cur.c + d.dc;
      const nr = cur.r + d.dr;
      if (!isSceneCellWalkable(scene, nc, nr)) continue;
      if (d.dc !== 0 && d.dr !== 0) {
        if (!isSceneCellWalkable(scene, cur.c + d.dc, cur.r) || !isSceneCellWalkable(scene, cur.c, cur.r + d.dr)) {
          continue;
        }
      }
      const nk = key(nc, nr);
      if (visited.has(nk)) continue;
      visited.add(nk);
      parent.set(nk, { pc: cur.c, pr: cur.r, dir: d.dir, view: d.view });
      if (nk === goalKey) {
        found = true;
        break;
      }
      queue.push({ c: nc, r: nr });
    }

    // Check invisible doorway warp links
    if (!found) {
      const warps = warpNeighbors.get(curKey);
      if (warps) {
        for (const w of warps) {
          const nk = key(w.nc, w.nr);
          if (visited.has(nk)) continue;
          visited.add(nk);
          parent.set(nk, {
            pc: cur.c,
            pr: cur.r,
            dir: w.dir,
            view: w.view,
            isWarp: true,
          });
          if (nk === goalKey) {
            found = true;
            break;
          }
          queue.push({ c: w.nc, r: w.nr });
        }
      }
    }
  }

  const steps: SceneWalkStep[] = [];
  if (found && startKey !== goalKey) {
    const cells: Array<{ c: number; r: number; dir: Direction; view: TurnaroundView; isWarp?: boolean }> = [];
    let ck = goalKey;
    while (ck !== startKey) {
      const p = parent.get(ck);
      if (!p) break;
      const [cs, rs] = ck.split(',').map(Number);
      cells.push({ c: cs, r: rs, dir: p.dir, view: p.view, isWarp: p.isWarp });
      ck = key(p.pc, p.pr);
    }
    cells.reverse();

    for (let i = 0; i < cells.length; i++) {
      const center = cellCenter(cells[i].c, cells[i].r);
      const g = scenePxToGrid(scene, center.px, center.py);
      const isLast = i === cells.length - 1 && finalAction !== 'sentado';
      steps.push({
        x: g.x,
        y: g.y,
        dir: isLast && finalDir ? finalDir : cells[i].dir,
        view: isLast ? finalView || finalDir || cells[i].view : cells[i].view,
        action: isLast ? finalAction : 'andando',
        isWarp: cells[i].isWarp,
      });
    }
  }

  if (finalAction === 'sentado') {
    const finalGrid = scenePxToGrid(scene, destPx, destPy);
    steps.push({
      x: finalGrid.x,
      y: finalGrid.y,
      dir: finalDir || 'frente',
      view: finalView || finalDir || 'frente',
      action: 'sentado',
    });
  } else if (steps.length === 0) {
    const g = scenePxToGrid(scene, goalWalkable.px, goalWalkable.py);
    steps.push({
      x: g.x,
      y: g.y,
      dir: finalDir || directionFromDelta(goalWalkable.px - startPx, goalWalkable.py - startPy, 'frente'),
      view: finalView || finalDir || turnaroundViewFromDelta(goalWalkable.px - startPx, goalWalkable.py - startPy, 'frente'),
      action: finalAction,
    });
  }

  return steps;
}
