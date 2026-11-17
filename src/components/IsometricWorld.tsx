import React, { useEffect, useRef, useState } from 'react';
import {
  Armchair,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Blocks,
  Coffee,
  Compass,
  DoorOpen,
  Droplets,
  Edit3,
  Gamepad2,
  HeartHandshake,
  Home,
  MessageSquareText,
  RotateCw,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ROOM_THEMES,
  ROOMS_META,
  STARTER_PLOT_MAX_BLOCKS,
  createStarterPlotTiles,
  getCatalogItem,
} from '../shared/catalog.ts';
import type {
  ActionId,
  Direction,
  InventoryItem,
  PlacedFurniture,
  RoomId,
  RoomTheme,
  SpaceInfoPayload,
  WorldPlayer,
} from '../shared/types.ts';
import { drawPixelAvatar, type TurnaroundView } from '../utils/pixelAvatarRenderer.ts';
import {
  SCENE_MAPS,
  findNearestWalkableScene,
  findScenePath,
  gridToScenePx,
  isPointInsideSceneObstacle,
  isSceneRoom,
  scenePxToGrid,
  turnaroundViewFromDelta,
  type SceneDepthProp,
  type SceneHotspot,
  type SceneMapConfig,
  type SceneRoomId,
  type SceneWalkStep,
} from '../utils/sceneMaps.ts';
import { PixelAvatarPreview } from './PixelAvatarPreview.tsx';
import { ItemThumbnail } from './ItemThumbnail.tsx';
import { soundFX } from '../utils/sound.ts';

interface IsometricWorldProps {
  roomKey: string;
  currentPlayerId: string;
  players: WorldPlayer[];
  spaceInfo: SpaceInfoPayload | null;
  myInventory: InventoryItem[];
  myFriends: Array<{ id: string; name: string }>;
  onlineCount?: number;
  isMobile?: boolean;
  isCompactHeight?: boolean;
  onMove: (x: number, y: number, direction: Direction, action: ActionId, steps: number) => void;
  onChangeRoom: (targetRoomKey: string) => void;
  onFurnish: (
    op: 'place' | 'remove' | 'rotate' | 'theme',
    data: { instanceId?: string; x?: number; y?: number; rotation?: number; theme?: RoomTheme }
  ) => void;
  onBuildTile: (x: number, y: number) => void;
  onRoutineAction: (actionType: string) => void;
  onAddFriend: (friendId: string, friendName: string) => void;
  onStartTrade: (targetPlayer: WorldPlayer) => void;
  onOpenShop: () => void;
  onOpenMinigames: () => void;
  onOpenFriends?: () => void;
  onToggleChatLog?: () => void;
}

const GRID_SIZE = 12;

// Unified indoor world units (zoom=1.0 reference) so character & furniture keep exact proportions at any viewport or browser zoom
const INDOOR_REF_W = 920;
const INDOOR_REF_H = 560;
const BASE_TILE_W = 72;
const BASE_TILE_H = 36;
const BASE_WALL_H = 88;
const FURN_BASE_SCALE = 0.58;
const CHAR_BASE_SCALE = 1.15;

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 3.2;

interface InteractiveProp {
  x: number;
  y: number;
  kind: 'bench' | 'portal' | 'shop_kiosk' | 'job_kiosk' | 'food_kiosk';
  label: string;
  targetRoom?: RoomId;
  routineAction?: string;
}

type WalkStep = SceneWalkStep;

function indoorDeltaToView(dx: number, dy: number, fallback: TurnaroundView = '3/4'): TurnaroundView {
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? '3/4' : 'costas_esquerda';
  }
  return dy > 0 ? '3/4_esquerda' : 'costas_direita';
}

function findIndoorPath(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  isWalkable: (x: number, y: number) => boolean,
  finalDir?: Direction,
  finalAction: ActionId = 'parado',
  finalView?: TurnaroundView
): WalkStep[] {
  const sx = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(startX)));
  const sy = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(startY)));
  const gx = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(goalX)));
  const gy = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(goalY)));

  const key = (x: number, y: number) => `${x},${y}`;
  const startKey = key(sx, sy);
  const goalKey = key(gx, gy);

  if (startKey === goalKey) {
    return [
      {
        x: gx,
        y: gy,
        dir: finalDir || 'frente',
        view: finalView || finalDir || 'frente',
        action: finalAction,
      },
    ];
  }

  const queue: Array<{ x: number; y: number; depth: number }> = [{ x: sx, y: sy, depth: 0 }];
  const visited = new Set<string>([startKey]);
  const parent = new Map<string, { px: number; py: number; dir: Direction; view: TurnaroundView }>();
  let found = false;

  while (queue.length > 0 && !found) {
    const cur = queue.shift()!;
    const dirs: Array<{ dx: number; dy: number; dir: Direction; view: TurnaroundView }> =
      cur.depth % 2 === 0
        ? [
            { dx: 1, dy: 0, dir: 'direita', view: '3/4' },
            { dx: -1, dy: 0, dir: 'esquerda', view: 'costas_esquerda' },
            { dx: 0, dy: 1, dir: 'frente', view: '3/4_esquerda' },
            { dx: 0, dy: -1, dir: 'costas', view: 'costas_direita' },
          ]
        : [
            { dx: 0, dy: 1, dir: 'frente', view: '3/4_esquerda' },
            { dx: 0, dy: -1, dir: 'costas', view: 'costas_direita' },
            { dx: 1, dy: 0, dir: 'direita', view: '3/4' },
            { dx: -1, dy: 0, dir: 'esquerda', view: 'costas_esquerda' },
          ];

    for (const d of dirs) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
      const nk = key(nx, ny);
      if (visited.has(nk)) continue;
      if (nk !== goalKey && !isWalkable(nx, ny)) continue;
      visited.add(nk);
      parent.set(nk, { px: cur.x, py: cur.y, dir: d.dir, view: d.view });
      if (nk === goalKey) {
        found = true;
        break;
      }
      queue.push({ x: nx, y: ny, depth: cur.depth + 1 });
    }
  }

  if (!found) return [];

  const path: WalkStep[] = [];
  let ck = goalKey;
  while (ck !== startKey) {
    const p = parent.get(ck);
    if (!p) break;
    const [cx, cy] = ck.split(',').map(Number);
    const isLast = ck === goalKey;
    path.push({
      x: cx,
      y: cy,
      dir: isLast && finalDir ? finalDir : p.dir,
      view: isLast && finalView ? finalView : p.view,
      action: isLast ? finalAction : 'andando',
    });
    ck = key(p.px, p.py);
  }
  path.reverse();
  return path;
}

function getRoomProps(roomId: RoomId): InteractiveProp[] {
  if (roomId === 'balada') {
    return [
      { x: 5, y: 10, kind: 'portal', label: 'Voltar para Praça', targetRoom: 'praca' },
      { x: 2, y: 4, kind: 'bench', label: 'Sofá VIP' },
      { x: 9, y: 4, kind: 'bench', label: 'Sofá VIP' },
      { x: 5, y: 3, kind: 'job_kiosk', label: 'Trabalhar de DJ (F2P)' },
    ];
  }
  if (roomId === 'cafeteria') {
    return [
      { x: 5, y: 10, kind: 'portal', label: 'Voltar para Praça', targetRoom: 'praca' },
      { x: 3, y: 5, kind: 'bench', label: 'Mesa de Café' },
      { x: 8, y: 6, kind: 'bench', label: 'Mesa de Café' },
      { x: 5, y: 3, kind: 'job_kiosk', label: 'Trabalhar de Barista (F2P)' },
      { x: 7, y: 3, kind: 'food_kiosk', label: 'Tomar Café (-8m)', routineAction: 'lanche_cafeteria' },
    ];
  }
  if (roomId === 'mercado') {
    return [
      { x: 5, y: 10, kind: 'portal', label: 'Voltar para Praça', targetRoom: 'praca' },
      { x: 5, y: 3, kind: 'job_kiosk', label: 'Fazer Entregas (F2P)' },
      { x: 7, y: 3, kind: 'food_kiosk', label: 'Comer Frutas (-8m)', routineAction: 'frutas_mercado' },
    ];
  }
  return [{ x: 5, y: 10, kind: 'portal', label: 'Sair para Praça', targetRoom: 'praca' }];
}

function isBlockedTile(_roomId: RoomId, x: number, y: number): boolean {
  if (x < 1 || y < 1 || x > 10 || y > 10) return true;
  return false;
}

export const IsometricWorld: React.FC<IsometricWorldProps> = ({
  roomKey,
  currentPlayerId,
  players,
  spaceInfo,
  myInventory,
  myFriends,
  onlineCount = 1,
  isMobile = false,
  isCompactHeight = false,
  onMove,
  onChangeRoom,
  onFurnish,
  onBuildTile,
  onRoutineAction,
  onAddFriend,
  onStartTrade,
  onOpenShop,
  onOpenMinigames,
  onOpenFriends,
  onToggleChatLog,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneImgsRef = useRef<Partial<Record<SceneRoomId, HTMLImageElement>>>({});
  const sceneVideoRef = useRef<HTMLVideoElement | null>(null);
  const depthImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const furnitureImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [sceneImgTick, setSceneImgTick] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ w: 960, h: 620 });
  const [dpr, setDpr] = useState(() =>
    typeof window !== 'undefined' ? Math.min(2.5, window.devicePixelRatio || 1) : 1
  );
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const camRef = useRef({ x: 480, y: 310, zoom: 1 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const touchPanRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    moved: false,
  });
  const pinchRef = useRef<{ dist: number; startZoom: number; active: boolean }>({
    dist: 0,
    startZoom: 1,
    active: false,
  });
  const suppressClickRef = useRef(false);
  const dpadHoldTimerRef = useRef<number | null>(null);
  const [showDpad, setShowDpad] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 820;
  });

  const baseRoomId = (roomKey.startsWith('espaco') ? 'espaco' : roomKey) as RoomId;
  const activeScene: SceneMapConfig | null = isSceneRoom(baseRoomId) ? SCENE_MAPS[baseRoomId] : null;
  const isOwnSpace = roomKey === `espaco:${currentPlayerId}`;
  const roomMeta = ROOMS_META[baseRoomId] || ROOMS_META.praca;

  const [editMode, setEditMode] = useState(false);
  const [buildTab, setBuildTab] = useState<'mobiliar' | 'terreno'>('terreno');
  const [placingInstanceId, setPlacingInstanceId] = useState<string | null>(null);
  const [selectedFurnId, setSelectedFurnId] = useState<string | null>(null);
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [hoveredHotspot, setHoveredHotspot] = useState<SceneHotspot | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<WorldPlayer | null>(null);

  const visualPosRef = useRef<Record<string, { vx: number; vy: number }>>({});
  const lastVisualViewRef = useRef<Record<string, TurnaroundView>>({});
  const wasdStopTimerRef = useRef<number | null>(null);
  const lastWasdStepRef = useRef<{ x: number; y: number; dir: Direction } | null>(null);
  const walkQueueRef = useRef<WalkStep[]>([]);
  const activeWalkTargetRef = useRef<WalkStep | null>(null);
  const pendingPostWalkRef = useRef<(() => void) | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const lastStepSoundAtRef = useRef<number>(0);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const playersRef = useRef<WorldPlayer[]>(players);
  playersRef.current = players;

  const hoverTileRef = useRef(hoverTile);
  hoverTileRef.current = hoverTile;

  const hoveredHotspotRef = useRef<SceneHotspot | null>(hoveredHotspot);
  hoveredHotspotRef.current = hoveredHotspot;

  const spaceInfoRef = useRef(spaceInfo);
  spaceInfoRef.current = spaceInfo;

  const buildTabRef = useRef(buildTab);
  buildTabRef.current = buildTab;

  // Preload all 2D illustrated scene maps (Praça, Balada, Cafeteria) and depth props
  useEffect(() => {
    for (const id of ['praca', 'balada', 'cafeteria'] as const) {
      const cfg = SCENE_MAPS[id];
      const img = new Image();
      img.src = cfg.mapUrl;
      img.onload = () => {
        sceneImgsRef.current[id] = img;
        setSceneImgTick((n) => n + 1);
      };
      for (const dp of cfg.depthProps) {
        if (!depthImgsRef.current.has(dp.id)) {
          const dImg = new Image();
          dImg.src = dp.url;
          depthImgsRef.current.set(dp.id, dImg);
        }
      }
    }
  }, []);

  useEffect(() => {
    walkQueueRef.current = [];
    activeWalkTargetRef.current = null;
    pendingPostWalkRef.current = null;
    visualPosRef.current = {};
    lastVisualViewRef.current = {};
    panOffsetRef.current = { x: 0, y: 0 };
    setHoveredHotspot(null);
    setSelectedPlayer(null);
    if (!isOwnSpace) {
      setEditMode(false);
      setPlacingInstanceId(null);
      setSelectedFurnId(null);
    }
  }, [isOwnSpace, roomKey]);

  useEffect(() => {
    if (!activeScene) return;
    const v = sceneVideoRef.current;
    if (!v) return;
    v.muted = true;
    v.loop = true;
    v.play().catch(() => {});
  }, [activeScene]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let t1: number | null = null;
    let t2: number | null = null;

    const syncSizeAndDpr = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(240, Math.floor(rect.width));
      const h = Math.max(180, Math.floor(rect.height));
      setCanvasSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      setDpr(Math.min(2.5, window.devicePixelRatio || 1));
    };

    const handleOrientation = () => {
      syncSizeAndDpr();
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      t1 = window.setTimeout(syncSizeAndDpr, 130);
      t2 = window.setTimeout(syncSizeAndDpr, 360);
    };

    syncSizeAndDpr();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(240, Math.floor(entry.contentRect.width));
        const h = Math.max(180, Math.floor(entry.contentRect.height));
        setCanvasSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        setDpr(Math.min(2.5, window.devicePixelRatio || 1));
      }
    });
    ro.observe(el);
    window.addEventListener('resize', syncSizeAndDpr);
    window.addEventListener('orientationchange', handleOrientation);
    window.visualViewport?.addEventListener('resize', syncSizeAndDpr);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncSizeAndDpr);
      window.removeEventListener('orientationchange', handleOrientation);
      window.visualViewport?.removeEventListener('resize', syncSizeAndDpr);
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
    };
  }, []);

  // Adaptive 2D Scene transform: keeps crisp character proportions on both portrait & landscape Android
  const getSceneTransform = (scene: SceneMapConfig, cw: number, ch: number) => {
    const fitScale = Math.min(cw / scene.width, ch / scene.height);
    const isSmallOrCompact = cw < 900 || ch < 500;
    const comfortScale = isSmallOrCompact
      ? Math.min(0.76, Math.min(cw / 560, ch / 380))
      : fitScale;
    const scale = Math.max(fitScale, comfortScale);
    const drawW = scene.width * scale;
    const drawH = scene.height * scale;
    const ox = (cw - drawW) / 2;
    const oy = (ch - drawH) / 2;
    return { scale, drawW, drawH, ox, oy };
  };

  // Proportional indoor metrics with mobile comfort floor so tiles/avatars stay easy to tap across orientations
  const getIndoorMetrics = (cw: number, ch: number) => {
    const rawFit = Math.min(cw / INDOOR_REF_W, ch / INDOOR_REF_H);
    const isSmallOrCompact = cw < 860 || ch < 480;
    const comfortFit = isSmallOrCompact
      ? Math.min(0.84, Math.min(cw / 470, ch / 330))
      : rawFit;
    const fitScale = Math.max(rawFit, comfortFit);
    const tileW = BASE_TILE_W * fitScale;
    const tileH = BASE_TILE_H * fitScale;
    const wallH = BASE_WALL_H * fitScale;
    const originX = cw / 2;
    const totalRoomH = wallH + GRID_SIZE * tileH;
    const originY = (ch - totalRoomH) / 2 + wallH;
    return { fitScale, tileW, tileH, wallH, originX, originY };
  };

  const screenToBase = (sx: number, sy: number) => {
    const cam = camRef.current;
    const cx = canvasSize.w / 2;
    const cy = canvasSize.h / 2;
    return {
      bx: cam.x + (sx - cx) / cam.zoom,
      by: cam.y + (sy - cy) / cam.zoom,
    };
  };

  const scheduleStepIdle = (x: number, y: number, dir: Direction, delayMs = 200) => {
    lastWasdStepRef.current = { x, y, dir };
    if (wasdStopTimerRef.current !== null) {
      window.clearTimeout(wasdStopTimerRef.current);
    }
    wasdStopTimerRef.current = window.setTimeout(() => {
      wasdStopTimerRef.current = null;
      if (activeWalkTargetRef.current || walkQueueRef.current.length > 0) return;
      const last = lastWasdStepRef.current;
      if (!last) return;
      lastWasdStepRef.current = null;
      onMoveRef.current(last.x, last.y, last.dir, 'parado', 0);
    }, delayMs);
  };

  const stepDirectionRef = useRef<(dx: number, dy: number, dir: Direction) => void>(() => {});
  stepDirectionRef.current = (dx: number, dy: number, dir: Direction) => {
    const me = playersRef.current.find((p) => p.id === currentPlayerId);
    if (!me) return;

    walkQueueRef.current = [];
    activeWalkTargetRef.current = null;
    pendingPostWalkRef.current = null;
    panOffsetRef.current = { x: 0, y: 0 };

    const vis = visualPosRef.current[currentPlayerId] || { vx: me.x, vy: me.y };
    if (Math.hypot(me.x - vis.vx, me.y - vis.vy) > 0.4) {
      return;
    }

    if (activeScene) {
      const cur = gridToScenePx(activeScene, me.x, me.y);
      const stepPx = activeScene.stepPx;
      let targetPx = cur.px + dx * stepPx;
      let targetPy = cur.py + dy * stepPx;
      let nextDir = dir;
      let nextView = turnaroundViewFromDelta(dx, dy, dir);

      if (isPointInsideSceneObstacle(activeScene, targetPx, targetPy)) {
        const halfPx = cur.px + dx * (stepPx * 0.6);
        const halfPy = cur.py + dy * (stepPx * 0.6);
        if (!isPointInsideSceneObstacle(activeScene, halfPx, halfPy)) {
          targetPx = halfPx;
          targetPy = halfPy;
        } else {
          // Seamless invisible doorway transition when walking into a doorway portal
          let warped = false;
          for (const wl of activeScene.warpLinks) {
            if (Math.hypot(cur.px - wl.ax, cur.py - wl.ay) < 28) {
              const dest = findNearestWalkableScene(activeScene, wl.bx, wl.by);
              targetPx = dest.px;
              targetPy = dest.py;
              nextDir = wl.dirToB;
              nextView = wl.viewToB;
              warped = true;
              break;
            }
            if (Math.hypot(cur.px - wl.bx, cur.py - wl.by) < 28) {
              const dest = findNearestWalkableScene(activeScene, wl.ax, wl.ay);
              targetPx = dest.px;
              targetPy = dest.py;
              nextDir = wl.dirToA;
              nextView = wl.viewToA;
              warped = true;
              break;
            }
          }
          if (!warped) {
            lastVisualViewRef.current[currentPlayerId] = nextView;
            scheduleStepIdle(me.x, me.y, dir, 60);
            return;
          }
        }
      }
      const g = scenePxToGrid(activeScene, targetPx, targetPy);
      lastVisualViewRef.current[currentPlayerId] = nextView;
      soundFX.playStep();
      onMoveRef.current(g.x, g.y, nextDir, 'andando', 1);
      scheduleStepIdle(g.x, g.y, nextDir, 190);
      return;
    }

    if (baseRoomId === 'espaco') {
      const plotTiles = spaceInfoRef.current?.plotTiles || createStarterPlotTiles();
      const nx = Math.max(0, Math.min(11, Math.round(me.x) + dx));
      const ny = Math.max(0, Math.min(11, Math.round(me.y) + dy));
      const blockedByFurn = spaceInfoRef.current?.furniture.some((f) => {
        if (f.x !== nx || f.y !== ny) return false;
        const cat = getCatalogItem(f.itemId);
        return Boolean(cat && cat.shape !== 'rug');
      });
      if (plotTiles.includes(`${nx},${ny}`) && !blockedByFurn) {
        lastVisualViewRef.current[currentPlayerId] = indoorDeltaToView(dx, dy, dir);
        soundFX.playStep();
        onMoveRef.current(nx, ny, dir, 'andando', 1);
        scheduleStepIdle(nx, ny, dir, 220);
      } else {
        lastVisualViewRef.current[currentPlayerId] = indoorDeltaToView(dx, dy, dir);
        scheduleStepIdle(me.x, me.y, dir, 60);
      }
      return;
    }

    const nx = Math.max(1, Math.min(10, Math.round(me.x) + dx));
    const ny = Math.max(1, Math.min(10, Math.round(me.y) + dy));
    const blockedByProp = getRoomProps(baseRoomId).some(
      (p) => p.x === nx && p.y === ny && p.kind !== 'portal'
    );
    if (!isBlockedTile(baseRoomId, nx, ny) && !blockedByProp) {
      lastVisualViewRef.current[currentPlayerId] = indoorDeltaToView(dx, dy, dir);
      soundFX.playStep();
      onMoveRef.current(nx, ny, dir, 'andando', 1);
      scheduleStepIdle(nx, ny, dir, 220);
    } else {
      lastVisualViewRef.current[currentPlayerId] = indoorDeltaToView(dx, dy, dir);
      scheduleStepIdle(me.x, me.y, dir, 60);
    }
  };

  // Keyboard WASD / Arrow movement (cancels queued click-walk and transitions cleanly to 'parado' facing the stopped side)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      let dx = 0;
      let dy = 0;
      let dir: Direction = 'frente';

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        dy = -1;
        dir = 'costas';
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        dy = 1;
        dir = 'frente';
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        dx = -1;
        dir = 'esquerda';
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        dx = 1;
        dir = 'direita';
      } else {
        return;
      }

      e.preventDefault();
      stepDirectionRef.current(dx, dy, dir);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(e.key)) {
        const last = lastWasdStepRef.current;
        if (last) {
          scheduleStepIdle(last.x, last.y, last.dir, 140);
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKeyUp);
      if (wasdStopTimerRef.current !== null) {
        window.clearTimeout(wasdStopTimerRef.current);
      }
      if (dpadHoldTimerRef.current !== null) {
        window.clearInterval(dpadHoldTimerRef.current);
      }
    };
  }, [currentPlayerId, baseRoomId]);

  // Isometric math for indoor rooms (proportional across PC, Mobile, and Browser Zoom)
  const indoor = getIndoorMetrics(canvasSize.w, canvasSize.h);
  const { fitScale: indoorFitScale, tileW, tileH, wallH, originX, originY } = indoor;

  const gridToScreen = (gx: number, gy: number) => ({
    sx: originX + (gx - gy) * (tileW / 2),
    sy: originY + (gx + gy) * (tileH / 2),
  });

  const screenToGrid = (sx: number, sy: number) => {
    const rx = sx - originX;
    const ry = sy - originY;
    const gx = Math.floor((rx / (tileW / 2) + ry / (tileH / 2)) / 2);
    const gy = Math.floor((ry / (tileH / 2) - rx / (tileW / 2)) / 2);
    return { x: gx, y: gy };
  };

  // Main Render Loop
  useEffect(() => {
    let rafId = 0;
    let tick = 0;

    const drawIsoTile = (
      ctx: CanvasRenderingContext2D,
      gx: number,
      gy: number,
      fill: string,
      stroke = 'rgba(15,23,42,0.28)',
      elevation = 0
    ) => {
      const { sx, sy } = gridToScreen(gx, gy);
      const y = sy - elevation;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + tileW / 2, y + tileH / 2);
      ctx.lineTo(sx, y + tileH);
      ctx.lineTo(sx - tileW / 2, y + tileH / 2);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const drawIsoBox = (
      ctx: CanvasRenderingContext2D,
      gx: number,
      gy: number,
      height: number,
      topColor: string,
      leftColor: string,
      rightColor: string
    ) => {
      const { sx, sy } = gridToScreen(gx, gy);
      const hw = tileW / 2;
      const hh = tileH / 2;

      ctx.beginPath();
      ctx.moveTo(sx, sy - height);
      ctx.lineTo(sx + hw, sy + hh - height);
      ctx.lineTo(sx, sy + tileH - height);
      ctx.lineTo(sx - hw, sy + hh - height);
      ctx.closePath();
      ctx.fillStyle = topColor;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(sx - hw, sy + hh - height);
      ctx.lineTo(sx, sy + tileH - height);
      ctx.lineTo(sx, sy + tileH);
      ctx.lineTo(sx - hw, sy + hh);
      ctx.closePath();
      ctx.fillStyle = leftColor;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(sx, sy + tileH - height);
      ctx.lineTo(sx + hw, sy + hh - height);
      ctx.lineTo(sx + hw, sy + hh);
      ctx.lineTo(sx, sy + tileH);
      ctx.closePath();
      ctx.fillStyle = rightColor;
      ctx.fill();
    };

    const getFurnSprite = (url: string): HTMLImageElement | null => {
      const cache = furnitureImgsRef.current;
      let img = cache.get(url);
      if (!img) {
        img = new Image();
        img.src = url;
        cache.set(url, img);
      }
      return img.complete && img.naturalWidth > 0 ? img : null;
    };

    const drawFurniturePiece = (
      ctx: CanvasRenderingContext2D,
      furn: PlacedFurniture,
      isSelected: boolean
    ) => {
      const item = getCatalogItem(furn.itemId);
      if (!item) return;
      const { sx, sy } = gridToScreen(furn.x, furn.y);

      if (isSelected) {
        drawIsoTile(ctx, furn.x, furn.y, 'rgba(251, 191, 36, 0.28)', '#fbbf24', 1);
      }

      if (item.spriteUrl) {
        const sprite = getFurnSprite(item.spriteUrl);
        if (sprite) {
          // Subtle shadow for non-rug items
          if (item.shape !== 'rug') {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
            ctx.beginPath();
            ctx.ellipse(sx, sy + tileH * 0.56, tileW * 0.28, tileH * 0.28, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // Scale sprite proportionally to indoorFitScale (NO independent clamping)
          const unitScale = FURN_BASE_SCALE * indoorFitScale;
          const maxBox = tileW * 1.62;
          let drawW = sprite.naturalWidth * unitScale;
          let drawH = sprite.naturalHeight * unitScale;
          if (drawW > maxBox) {
            const ratio = maxBox / drawW;
            drawW *= ratio;
            drawH *= ratio;
          }

          const anchorY = item.shape === 'rug' ? sy + tileH * 0.5 + drawH * 0.45 : sy + tileH * 0.68;
          const flipX = furn.rotation === 90 || furn.rotation === 270;

          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.translate(sx, anchorY);
          if (flipX) ctx.scale(-1, 1);
          ctx.drawImage(sprite, -drawW / 2, -drawH, drawW, drawH);
          ctx.restore();
          return;
        }
      }

      // Minimal fallback while PNG loads
      drawIsoBox(ctx, furn.x, furn.y, 14 * indoorFitScale, item.primaryColor, item.secondaryColor, '#1e1b4b');
    };

    const drawSignLabel = (
      ctx: CanvasRenderingContext2D,
      sx: number,
      sy: number,
      text: string,
      bg: string,
      border: string,
      textColor = '#ffffff',
      yOffset = -34
    ) => {
      if (sx < -60 || sx > canvasSize.w + 60 || sy < -40 || sy > canvasSize.h + 40) return;
      ctx.font = 'bold 11px Silkscreen, monospace';
      const w = ctx.measureText(text).width + 16;
      const x = Math.round(Math.max(8, Math.min(canvasSize.w - w - 8, sx - w / 2)));
      const y = Math.round(Math.max(8, Math.min(canvasSize.h - 26, sy + yOffset)));
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, 20);
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, 20);
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.fillText(text, x + w / 2, y + 14);
    };

    const drawPlayerNameAndBubble = (
      ctx: CanvasRenderingContext2D,
      sx: number,
      topY: number,
      pl: WorldPlayer,
      now: number
    ) => {
      const labelY = topY - 8;
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      const nameW = ctx.measureText(pl.name).width + 14;
      ctx.fillStyle =
        pl.id === currentPlayerId
          ? 'rgba(245, 158, 11, 0.94)'
          : pl.isNpc
          ? 'rgba(20, 26, 54, 0.88)'
          : 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(Math.round(sx - nameW / 2), labelY - 15, nameW, 17);
      ctx.strokeStyle =
        pl.id === currentPlayerId ? '#fef08a' : pl.isNpc ? 'rgba(168,85,247,0.55)' : 'rgba(148,163,184,0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(sx - nameW / 2), labelY - 15, nameW, 17);
      ctx.fillStyle = pl.id === currentPlayerId ? '#0f172a' : '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(pl.name, sx, labelY - 2);

      const showBubble = pl.bubbleText && (!pl.bubbleExpiresAt || pl.bubbleExpiresAt > now);
      if (showBubble && pl.bubbleText) {
        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        const text = pl.bubbleText.slice(0, 42);
        const bw = Math.max(64, ctx.measureText(text).width + 18);
        const bx = Math.round(sx - bw / 2);
        const by = labelY - 43;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx, by, bw, 22);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, 22);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 3, by + 21, 6, 4);

        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(text, sx, by + 15);
      }
    };

    const renderFrame = (frameNow: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const prevNow = lastFrameTimeRef.current || frameNow;
      const dt = Math.min(0.05, Math.max(0.001, (frameNow - prevNow) / 1000));
      lastFrameTimeRef.current = frameNow;

      tick += dt * 8.4;
      const now = Date.now();
      const cw = canvasSize.w;
      const ch = canvasSize.h;
      const centerX = cw / 2;
      const centerY = ch / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear deep twilight canvas background
      ctx.fillStyle = '#0d1022';
      ctx.fillRect(0, 0, cw, ch);

      const moveLinear = (
        cur: { vx: number; vy: number },
        tx: number,
        ty: number,
        scene: SceneMapConfig | null,
        isWarp?: boolean
      ) => {
        if (isWarp) {
          cur.vx = tx;
          cur.vy = ty;
          return true;
        }
        if (scene) {
          const curPx = gridToScenePx(scene, cur.vx, cur.vy);
          const tgtPx = gridToScenePx(scene, tx, ty);
          const dpx = tgtPx.px - curPx.px;
          const dpy = tgtPx.py - curPx.py;
          const distPx = Math.hypot(dpx, dpy);
          if (distPx > 460) {
            cur.vx = tx;
            cur.vy = ty;
            return true;
          }
          const maxStepPx = 165 * dt;
          if (distPx <= maxStepPx) {
            cur.vx = tx;
            cur.vy = ty;
            return true;
          }
          const nextPx = curPx.px + (dpx / distPx) * maxStepPx;
          const nextPy = curPx.py + (dpy / distPx) * maxStepPx;
          const g = scenePxToGrid(scene, nextPx, nextPy);
          cur.vx = g.x;
          cur.vy = g.y;
          return false;
        }

        const dx = tx - cur.vx;
        const dy = ty - cur.vy;
        const dist = Math.hypot(dx, dy);
        if (dist > 6) {
          cur.vx = tx;
          cur.vy = ty;
          return true;
        }
        const maxStep = 4.2 * dt;
        if (dist <= maxStep) {
          cur.vx = tx;
          cur.vy = ty;
          return true;
        }
        cur.vx += (dx / dist) * maxStep;
        cur.vy += (dy / dist) * maxStep;
        return false;
      };

      // Advance active local walk queue square-by-square, and linearly animate remote players
      for (const pl of playersRef.current) {
        const cur = visualPosRef.current[pl.id] || { vx: pl.x, vy: pl.y };

        if (pl.id === currentPlayerId && (activeWalkTargetRef.current || walkQueueRef.current.length > 0)) {
          if (!activeWalkTargetRef.current && walkQueueRef.current.length > 0) {
            activeWalkTargetRef.current = walkQueueRef.current.shift()!;
          }
          const target = activeWalkTargetRef.current;
          if (target) {
            lastVisualViewRef.current[pl.id] = target.view || target.dir;
            const arrived = moveLinear(cur, target.x, target.y, activeScene, target.isWarp);
            if (arrived) {
              const hasMore = walkQueueRef.current.length > 0;
              const emitAction: ActionId = hasMore ? 'andando' : target.action || 'parado';
              lastVisualViewRef.current[pl.id] = target.view || target.dir;
              onMoveRef.current(target.x, target.y, target.dir, emitAction, 1);

              if (now - lastStepSoundAtRef.current >= 140) {
                soundFX.playStep();
                lastStepSoundAtRef.current = now;
              }

              if (hasMore) {
                activeWalkTargetRef.current = walkQueueRef.current.shift()!;
              } else {
                activeWalkTargetRef.current = null;
                const postCb = pendingPostWalkRef.current;
                pendingPostWalkRef.current = null;
                if (postCb) postCb();
              }
            }
          }
        } else {
          const prevVx = cur.vx;
          const prevVy = cur.vy;
          moveLinear(cur, pl.x, pl.y, activeScene);
          const mdx = cur.vx - prevVx;
          const mdy = cur.vy - prevVy;
          if (Math.hypot(mdx, mdy) > 0.002) {
            if (activeScene) {
              const p0 = gridToScenePx(activeScene, prevVx, prevVy);
              const p1 = gridToScenePx(activeScene, cur.vx, cur.vy);
              lastVisualViewRef.current[pl.id] = turnaroundViewFromDelta(
                p1.px - p0.px,
                p1.py - p0.py,
                pl.direction
              );
            } else {
              lastVisualViewRef.current[pl.id] = indoorDeltaToView(mdx, mdy, pl.direction);
            }
          }
        }

        visualPosRef.current[pl.id] = cur;
      }

      // Compute camera target: follows current player whenever world exceeds viewport OR user zooms in, clamped cleanly to map bounds
      const targetZoom = zoomRef.current;
      const cam = camRef.current;
      cam.zoom += (targetZoom - cam.zoom) * 0.24;

      let meBaseX = centerX;
      let meBaseY = centerY;
      const mePlayer = playersRef.current.find((p) => p.id === currentPlayerId);
      if (mePlayer) {
        const meCur = visualPosRef.current[mePlayer.id] || { vx: mePlayer.x, vy: mePlayer.y };
        if (activeScene) {
          const tf = getSceneTransform(activeScene, cw, ch);
          const pxy = gridToScenePx(activeScene, meCur.vx, meCur.vy);
          const avScale = activeScene.avatarScale * tf.scale;
          meBaseX = tf.ox + pxy.px * tf.scale;
          meBaseY = tf.oy + pxy.py * tf.scale - 22 * avScale;
        } else {
          const pos = gridToScreen(meCur.vx, meCur.vy);
          const cScale = CHAR_BASE_SCALE * indoorFitScale;
          meBaseX = pos.sx;
          meBaseY = pos.sy - 16 * cScale;
        }
      }

      let worldMinX = 0;
      let worldMaxX = cw;
      let worldMinY = 0;
      let worldMaxY = ch;
      if (activeScene) {
        const tf = getSceneTransform(activeScene, cw, ch);
        worldMinX = tf.ox;
        worldMaxX = tf.ox + tf.drawW;
        worldMinY = tf.oy;
        worldMaxY = tf.oy + tf.drawH;
      } else {
        const topC = gridToScreen(0, 0);
        const leftC = gridToScreen(0, GRID_SIZE);
        const rightC = gridToScreen(GRID_SIZE, 0);
        const botC = gridToScreen(GRID_SIZE, GRID_SIZE);
        worldMinX = leftC.sx - 24 * indoorFitScale;
        worldMaxX = rightC.sx + 24 * indoorFitScale;
        worldMinY = topC.sy - wallH - 24 * indoorFitScale;
        worldMaxY = botC.sy + 24 * indoorFitScale;
      }

      const worldW = (worldMaxX - worldMinX) * cam.zoom;
      const worldH = (worldMaxY - worldMinY) * cam.zoom;
      const exceedsW = worldW > cw + 4;
      const exceedsH = worldH > ch + 4;
      const follow = exceedsW || exceedsH || targetZoom > 1 ? 1 : 0;

      let targetCamX = centerX + (meBaseX + panOffsetRef.current.x - centerX) * follow;
      let targetCamY = centerY + (meBaseY + panOffsetRef.current.y - centerY) * follow;

      const halfVisW = cw / (2 * cam.zoom);
      const halfVisH = ch / (2 * cam.zoom);

      if (!exceedsW) {
        targetCamX = (worldMinX + worldMaxX) / 2;
      } else {
        targetCamX = Math.max(worldMinX + halfVisW, Math.min(worldMaxX - halfVisW, targetCamX));
      }

      if (!exceedsH) {
        targetCamY = (worldMinY + worldMaxY) / 2;
      } else {
        targetCamY = Math.max(worldMinY + halfVisH, Math.min(worldMaxY - halfVisH, targetCamY));
      }

      if (Math.abs(targetCamX - cam.x) > cw * 0.45 || Math.abs(targetCamY - cam.y) > ch * 0.45) {
        cam.x = targetCamX;
        cam.y = targetCamY;
      } else {
        cam.x += (targetCamX - cam.x) * 0.2;
        cam.y += (targetCamY - cam.y) * 0.2;
      }

      const baseToScreen = (bx: number, by: number) => ({
        sx: centerX + (bx - cam.x) * cam.zoom,
        sy: centerY + (by - cam.y) * cam.zoom,
      });

      // ============================================================
      // 1) 2D ILLUSTRATED & ANIMATED SCENES (Praça, Balada, Cafeteria)
      // ============================================================
      if (activeScene) {
        const tf = getSceneTransform(activeScene, cw, ch);
        const mapImg = sceneImgsRef.current[activeScene.id];

        const humanPlayers = playersRef.current.filter((p) => !p.isNpc);
        const renderHumans: Array<{ pl: WorldPlayer; vx: number; vy: number; sx: number; sy: number }> = [];
        for (const pl of humanPlayers) {
          const cur = visualPosRef.current[pl.id] || { vx: pl.x, vy: pl.y };
          const pxy = gridToScenePx(activeScene, cur.vx, cur.vy);
          const sx = tf.ox + pxy.px * tf.scale;
          const sy = tf.oy + pxy.py * tf.scale;
          renderHumans.push({ pl, vx: cur.vx, vy: cur.vy, sx, sy });
        }
        renderHumans.sort((a, b) => a.sy - b.sy);

        const avatarScale = activeScene.avatarScale * tf.scale;
        const labelQueue: Array<{ pl: WorldPlayer; bx: number; by: number }> = [];

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-cam.x, -cam.y);

        const mapVideo = sceneVideoRef.current;
        const videoReady = Boolean(mapVideo && mapVideo.readyState >= 2 && mapVideo.videoWidth > 0);

        if (videoReady && mapVideo) {
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          const crop = activeScene.videoCrop;
          if (crop) {
            ctx.drawImage(
              mapVideo,
              crop.sx,
              crop.sy,
              crop.sw,
              crop.sh,
              tf.ox,
              tf.oy,
              tf.drawW,
              tf.drawH
            );
          } else {
            ctx.drawImage(mapVideo, tf.ox, tf.oy, tf.drawW, tf.drawH);
          }
          ctx.restore();
        } else if (mapImg && mapImg.complete) {
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(mapImg, tf.ox, tf.oy, tf.drawW, tf.drawH);
          ctx.restore();
        } else {
          ctx.fillStyle = '#151a36';
          ctx.fillRect(0, 0, cw, ch);
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(activeScene.loadingText, cw / 2, ch / 2);
        }

        // Hover highlight on interactive scene landmarks, benches, doors, kiosks
        const hs = hoveredHotspotRef.current;
        if (hs) {
          const hx = tf.ox + hs.x0 * tf.scale;
          const hy = tf.oy + hs.y0 * tf.scale;
          const hw = (hs.x1 - hs.x0) * tf.scale;
          const hh = (hs.y1 - hs.y0) * tf.scale;
          const strokeCol =
            hs.kind === 'portal'
              ? 'rgba(251, 191, 36, 0.92)'
              : hs.kind === 'bench'
              ? 'rgba(56, 189, 248, 0.92)'
              : hs.kind === 'job_kiosk'
              ? 'rgba(74, 222, 128, 0.92)'
              : hs.kind === 'food_kiosk'
              ? 'rgba(251, 146, 60, 0.92)'
              : 'rgba(192, 132, 252, 0.92)';
          const fillCol =
            hs.kind === 'portal'
              ? 'rgba(251, 191, 36, 0.10)'
              : hs.kind === 'bench'
              ? 'rgba(56, 189, 248, 0.14)'
              : hs.kind === 'job_kiosk'
              ? 'rgba(74, 222, 128, 0.14)'
              : hs.kind === 'food_kiosk'
              ? 'rgba(251, 146, 60, 0.14)'
              : 'rgba(192, 132, 252, 0.14)';
          ctx.save();
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 2.5 / cam.zoom;
          ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
          ctx.strokeRect(hx, hy, hw, hh);
          ctx.fillStyle = fillCol;
          ctx.fillRect(hx, hy, hw, hh);
          ctx.restore();
        }

        // Subtle pulsing footprint marker on final destination while walking
        if (activeWalkTargetRef.current) {
          const finalStep =
            walkQueueRef.current.length > 0
              ? walkQueueRef.current[walkQueueRef.current.length - 1]
              : activeWalkTargetRef.current;
          const destPxy = gridToScenePx(activeScene, finalStep.x, finalStep.y);
          const dx = tf.ox + destPxy.px * tf.scale;
          const dy = tf.oy + destPxy.py * tf.scale;
          const ringPulse = 1 + Math.sin(tick * 0.8) * 0.18;
          ctx.save();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
          ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
          ctx.lineWidth = 2 / cam.zoom;
          ctx.beginPath();
          ctx.ellipse(dx, dy, 14 * tf.scale * ringPulse, 7 * tf.scale * ringPulse, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        type SceneDrawItem =
          | { kind: 'human'; sortY: number; item: (typeof renderHumans)[number] }
          | { kind: 'prop'; sortY: number; prop: SceneDepthProp; img: HTMLImageElement };

        const sceneDrawList: SceneDrawItem[] = renderHumans.map((item) => ({
          kind: 'human',
          sortY: gridToScenePx(activeScene, item.vx, item.vy).py,
          item,
        }));

        // Interleave foreground prop cutouts whenever any human overlaps behind that prop
        for (const dp of activeScene.depthProps) {
          const dImg = depthImgsRef.current.get(dp.id);
          if (!dImg || !dImg.complete || dImg.naturalWidth === 0) continue;
          const occludedHuman = renderHumans.some((h) => {
            const pxy = gridToScenePx(activeScene, h.vx, h.vy);
            return (
              pxy.py < dp.baseY &&
              pxy.px >= dp.x - 24 &&
              pxy.px <= dp.x + dp.w + 24 &&
              pxy.py >= dp.y - 12 &&
              pxy.py <= dp.baseY
            );
          });
          if (occludedHuman) {
            sceneDrawList.push({ kind: 'prop', sortY: dp.baseY, prop: dp, img: dImg });
          }
        }

        sceneDrawList.sort((a, b) => a.sortY - b.sortY);

        for (const entry of sceneDrawList) {
          if (entry.kind === 'prop') {
            const { prop, img } = entry;
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(
              img,
              tf.ox + prop.x * tf.scale,
              tf.oy + prop.y * tf.scale,
              prop.w * tf.scale,
              prop.h * tf.scale
            );
            ctx.restore();
            continue;
          }

          const { pl, vx, vy, sx, sy } = entry.item;
          const localWalking =
            pl.id === currentPlayerId && Boolean(activeWalkTargetRef.current);
          const remoteMoving = Math.abs(pl.x - vx) > 0.04 || Math.abs(pl.y - vy) > 0.04;
          const isMoving = localWalking || remoteMoving;
          const pxy = gridToScenePx(activeScene, vx, vy);
          const satHotspot =
            !isMoving && pl.action === 'sentado'
              ? activeScene.hotspots.reduce<SceneHotspot | undefined>((best, h) => {
                  if (h.kind !== 'bench' || !h.sitPos) return best;
                  const d = Math.hypot(pxy.px - h.sitPos.px, pxy.py - h.sitPos.py);
                  if (d >= 26) return best;
                  if (!best?.sitPos) return h;
                  const bestD = Math.hypot(pxy.px - best.sitPos.px, pxy.py - best.sitPos.py);
                  return d < bestD ? h : best;
                }, undefined)
              : undefined;
          const onBench = Boolean(satHotspot);
          const activeView: TurnaroundView =
            localWalking && activeWalkTargetRef.current
              ? activeWalkTargetRef.current.view || activeWalkTargetRef.current.dir
              : satHotspot?.sitPos?.view
              ? satHotspot.sitPos.view
              : lastVisualViewRef.current[pl.id] || pl.direction;
          const settledAction: ActionId = isMoving
            ? 'andando'
            : pl.action === 'andando' || pl.action === 'correndo'
            ? 'parado'
            : pl.action;
          const drawW = 32 * avatarScale;
          const drawH = 48 * avatarScale;
          const drawX = sx - drawW / 2;
          const drawY = sy - drawH + 2 * avatarScale;

          drawPixelAvatar(ctx, drawX, drawY, {
            avatar: pl.avatar,
            view: activeView,
            expression: pl.expression,
            action: settledAction,
            frame: tick,
            scale: avatarScale,
            hideShadow: onBench,
          });

          labelQueue.push({ pl, bx: sx, by: drawY });
        }

        ctx.restore();

        // Subtle screen-space hotspot signs for Balada & Cafeteria (makes exits, jobs, and VIP door clear on touch devices)
        if (activeScene.id !== 'praca') {
          for (const h of activeScene.hotspots) {
            if (h.kind === 'bench') continue;
            const cx = tf.ox + ((h.x0 + h.x1) / 2) * tf.scale;
            const cy = tf.oy + h.y0 * tf.scale;
            const sp = baseToScreen(cx, cy);
            if (h.kind === 'portal') {
              drawSignLabel(ctx, sp.sx, sp.sy, 'SAIR P/ PRAÇA', '#0f172a', '#fbbf24', '#fde047', -10);
            } else if (h.kind === 'warp') {
              drawSignLabel(ctx, sp.sx, sp.sy, 'PISTA VIP', '#3b0764', '#e879f9', '#f5d0fe', -8);
            } else if (h.kind === 'job_kiosk') {
              const title = activeScene.id === 'balada' ? 'TOCAR DE DJ' : 'BARISTA (F2P)';
              drawSignLabel(ctx, sp.sx, sp.sy, title, '#052e16', '#4ade80', '#bbf7d0', -8);
            } else if (h.kind === 'food_kiosk') {
              drawSignLabel(ctx, sp.sx, sp.sy, 'CAFÉ (-8M)', '#451a03', '#fb923c', '#fed7aa', -8);
            }
          }
        }

        // Draw crisp screen-space player nameplates & chat bubbles
        for (const lbl of labelQueue) {
          const sp = baseToScreen(lbl.bx, lbl.by);
          drawPlayerNameAndBubble(ctx, sp.sx, sp.sy, lbl.pl, now);
        }

        rafId = requestAnimationFrame(renderFrame);
        return;
      }

      // ============================================================
      // 2) INDOOR ROOMS (Shopping, Balada, Cafeteria, Mercado, Nosso Espaço)
      // ============================================================
      ctx.imageSmoothingEnabled = false;
      const bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
      bgGrad.addColorStop(0, '#0f0b24');
      bgGrad.addColorStop(1, '#191438');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, cw, ch);

      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i < 24; i++) {
        const starX = (i * 137) % cw;
        const starY = (i * 73) % Math.max(40, Math.floor(ch * 0.45));
        ctx.fillRect(starX, starY, 2, 2);
      }

      let floorA = roomMeta.floorPrimary;
      let floorB = roomMeta.floorSecondary;
      let wallCol = roomMeta.wallColor;
      if (baseRoomId === 'espaco' && spaceInfoRef.current) {
        const th = ROOM_THEMES.find((t) => t.id === spaceInfoRef.current?.theme);
        if (th) {
          floorA = th.floorA;
          floorB = th.floorB;
          wallCol = th.wall;
        }
      }

      const indoorLabelQueue: Array<{ pl: WorldPlayer; bx: number; by: number }> = [];

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);

      // Back walls (scaled cleanly with wallH)
      const topCorner = gridToScreen(0, 0);
      const leftCorner = gridToScreen(0, GRID_SIZE);
      const rightCorner = gridToScreen(GRID_SIZE, 0);

      ctx.beginPath();
      ctx.moveTo(topCorner.sx, topCorner.sy - wallH);
      ctx.lineTo(leftCorner.sx, leftCorner.sy - wallH);
      ctx.lineTo(leftCorner.sx, leftCorner.sy);
      ctx.lineTo(topCorner.sx, topCorner.sy);
      ctx.closePath();
      ctx.fillStyle = wallCol;
      ctx.fill();
      ctx.strokeStyle = 'rgba(168,85,247,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(topCorner.sx, topCorner.sy - wallH);
      ctx.lineTo(rightCorner.sx, rightCorner.sy - wallH);
      ctx.lineTo(rightCorner.sx, rightCorner.sy);
      ctx.lineTo(topCorner.sx, topCorner.sy);
      ctx.closePath();
      ctx.fillStyle = wallCol;
      ctx.fill();
      ctx.stroke();

      const espacoPlotTiles =
        baseRoomId === 'espaco'
          ? new Set(spaceInfoRef.current?.plotTiles || createStarterPlotTiles())
          : null;

      for (let gx = 0; gx < GRID_SIZE; gx++) {
        for (let gy = 0; gy < GRID_SIZE; gy++) {
          const tileKey = `${gx},${gy}`;
          const isBuilt = espacoPlotTiles ? espacoPlotTiles.has(tileKey) : true;
          const h = hoverTileRef.current;
          const isHover = Boolean(h && h.x === gx && h.y === gy);

          if (!isBuilt) {
            if (editMode && buildTabRef.current === 'terreno') {
              drawIsoTile(
                ctx,
                gx,
                gy,
                isHover ? 'rgba(52, 211, 153, 0.28)' : 'rgba(148, 163, 184, 0.06)',
                isHover ? '#34d399' : 'rgba(148, 163, 184, 0.22)'
              );
            }
            continue;
          }

          let fill = (gx + gy) % 2 === 0 ? floorA : floorB;
          if (baseRoomId === 'balada' && gx >= 3 && gx <= 8 && gy >= 4 && gy <= 8) {
            const pulse = Math.floor(tick * 0.4 + gx + gy) % 4;
            const colors = ['#6d28d9', '#db2777', '#0284c7', '#4338ca'];
            fill = colors[pulse];
          }
          drawIsoTile(ctx, gx, gy, fill);

          if (isHover) {
            const isTerrainEdit = editMode && baseRoomId === 'espaco' && buildTabRef.current === 'terreno';
            drawIsoTile(
              ctx,
              gx,
              gy,
              isTerrainEdit
                ? 'rgba(244, 63, 94, 0.35)'
                : editMode
                ? 'rgba(251,191,36,0.35)'
                : 'rgba(255,255,255,0.16)',
              isTerrainEdit
                ? '#f43f5e'
                : editMode
                ? '#fbbf24'
                : 'rgba(255,255,255,0.45)'
            );
          }

          if (activeWalkTargetRef.current) {
            const finalStep =
              walkQueueRef.current.length > 0
                ? walkQueueRef.current[walkQueueRef.current.length - 1]
                : activeWalkTargetRef.current;
            if (Math.round(finalStep.x) === gx && Math.round(finalStep.y) === gy) {
              drawIsoTile(
                ctx,
                gx,
                gy,
                'rgba(251, 191, 36, 0.24)',
                'rgba(251, 191, 36, 0.9)'
              );
            }
          }
        }
      }

      const props = getRoomProps(baseRoomId);

      for (const prop of props) {
        if (prop.kind === 'portal') {
          if (baseRoomId === 'espaco') continue;
          drawIsoTile(ctx, prop.x, prop.y, 'rgba(245, 158, 11, 0.35)', '#fbbf24', 1);
        } else if (prop.kind === 'bench') {
          drawIsoBox(ctx, prop.x, prop.y, 11 * indoorFitScale, '#b45309', '#92400e', '#78350f');
        } else if (prop.kind === 'shop_kiosk') {
          drawIsoBox(ctx, prop.x, prop.y, 26 * indoorFitScale, '#ec4899', '#9d174d', '#831843');
        } else if (prop.kind === 'job_kiosk') {
          drawIsoBox(ctx, prop.x, prop.y, 24 * indoorFitScale, '#22c55e', '#15803d', '#14532d');
        } else if (prop.kind === 'food_kiosk') {
          drawIsoBox(ctx, prop.x, prop.y, 22 * indoorFitScale, '#f59e0b', '#d97706', '#92400e');
        }
      }

      type RenderEntity =
        | { kind: 'furn'; depth: number; furn: PlacedFurniture }
        | { kind: 'player'; depth: number; player: WorldPlayer; vx: number; vy: number };

      const entities: RenderEntity[] = [];

      if (baseRoomId === 'espaco' && spaceInfoRef.current) {
        for (const f of spaceInfoRef.current.furniture) {
          const item = getCatalogItem(f.itemId);
          const depthOffset = item?.shape === 'rug' ? -20 : 0;
          entities.push({ kind: 'furn', depth: f.x + f.y + depthOffset, furn: f });
        }
      }

      for (const pl of playersRef.current) {
        const cur = visualPosRef.current[pl.id] || { vx: pl.x, vy: pl.y };
        entities.push({
          kind: 'player',
          depth: cur.vx + cur.vy + 0.1,
          player: pl,
          vx: cur.vx,
          vy: cur.vy,
        });
      }

      entities.sort((a, b) => a.depth - b.depth);

      const charScale = CHAR_BASE_SCALE * indoorFitScale;

      const getFurnMetrics = (furn: PlacedFurniture) => {
        const item = getCatalogItem(furn.itemId);
        if (!item) return null;
        const sprite = item.spriteUrl ? getFurnSprite(item.spriteUrl) : null;
        const unitScale = FURN_BASE_SCALE * indoorFitScale;
        const maxBox = tileW * 1.62;
        let drawW = (sprite ? sprite.naturalWidth : 160) * unitScale;
        let drawH = (sprite ? sprite.naturalHeight : 140) * unitScale;
        if (drawW > maxBox) {
          const ratio = maxBox / drawW;
          drawW *= ratio;
          drawH *= ratio;
        }
        return { item, drawW, drawH };
      };

      for (const ent of entities) {
        if (ent.kind === 'furn') {
          drawFurniturePiece(ctx, ent.furn, ent.furn.instanceId === selectedFurnId);
        } else {
          const pl = ent.player;
          const { sx, sy } = gridToScreen(ent.vx, ent.vy);
          let drawX = sx - 16 * charScale;
          let drawY = sy + tileH / 2 - 44 * charScale;
          let hideShadow = false;
          let flipX = false;

          const localWalking =
            pl.id === currentPlayerId && Boolean(activeWalkTargetRef.current);
          const remoteMoving = Math.abs(pl.x - ent.vx) > 0.04 || Math.abs(pl.y - ent.vy) > 0.04;
          const isMoving = localWalking || remoteMoving;
          let activeView: TurnaroundView =
            localWalking && activeWalkTargetRef.current
              ? activeWalkTargetRef.current.view || activeWalkTargetRef.current.dir
              : lastVisualViewRef.current[pl.id] || pl.direction;
          const settledAction: ActionId = isMoving
            ? 'andando'
            : pl.action === 'andando' || pl.action === 'correndo'
            ? 'parado'
            : pl.action;

          // Align players onto bed mattress / sofa cushion / indoor bench when interacting
          if (!isMoving && baseRoomId === 'espaco' && spaceInfoRef.current && (settledAction === 'deitado' || settledAction === 'sentado')) {
            const onFurn = spaceInfoRef.current.furniture.find(
              (f) => Math.hypot(ent.vx - f.x, ent.vy - f.y) < 0.45
            );
            if (onFurn) {
              const fm = getFurnMetrics(onFurn);
              if (fm) {
                const dist = Math.hypot(ent.vx - onFurn.x, ent.vy - onFurn.y);
                const blend = Math.max(0, Math.min(1, 1 - dist / 0.45));
                const fPos = gridToScreen(onFurn.x, onFurn.y);
                const anchorY = fPos.sy + tileH * 0.68;
                const furnFlipped = onFurn.rotation === 90 || onFurn.rotation === 270;

                if (fm.item.shape === 'bed') {
                  activeView = '3/4';
                  const targetBottomY = anchorY - fm.drawH * 0.355;
                  const targetCenterX = fPos.sx + (furnFlipped ? 0.068 : -0.068) * fm.drawW;
                  const targetDrawX = targetCenterX - 16 * charScale;
                  const targetDrawY = targetBottomY - 46 * charScale;
                  drawX += (targetDrawX - drawX) * blend;
                  drawY += (targetDrawY - drawY) * blend;
                  hideShadow = blend > 0.4;
                  flipX = furnFlipped;
                } else if (fm.item.shape === 'sofa' && settledAction === 'sentado') {
                  activeView = furnFlipped ? '3/4_esquerda' : '3/4';
                  const targetBottomY = anchorY - fm.drawH * 0.16;
                  const targetCenterX = fPos.sx + (furnFlipped ? -0.02 : 0.02) * fm.drawW;
                  const targetDrawX = targetCenterX - 16 * charScale;
                  const targetDrawY = targetBottomY - 46 * charScale;
                  drawX += (targetDrawX - drawX) * blend;
                  drawY += (targetDrawY - drawY) * blend;
                  hideShadow = blend > 0.4;
                }
              }
            }
          } else if (!isMoving && settledAction === 'sentado') {
            const onBenchProp = props.find(
              (p) => p.kind === 'bench' && Math.hypot(ent.vx - p.x, ent.vy - p.y) < 0.45
            );
            if (onBenchProp) {
              const dist = Math.hypot(ent.vx - onBenchProp.x, ent.vy - onBenchProp.y);
              const blend = Math.max(0, Math.min(1, 1 - dist / 0.45));
              drawY -= 11 * indoorFitScale * blend;
              hideShadow = blend > 0.4;
              activeView = onBenchProp.x <= 4 ? '3/4' : '3/4_esquerda';
            }
          }

          drawPixelAvatar(ctx, drawX, drawY, {
            avatar: pl.avatar,
            view: activeView,
            expression: pl.expression,
            action: settledAction,
            frame: tick,
            scale: charScale,
            hideShadow,
            flipX,
          });

          indoorLabelQueue.push({ pl, bx: drawX + 16 * charScale, by: drawY });
        }
      }

      ctx.restore();

      // Screen-space signs & nameplates (always crisp at any zoom)
      if (baseRoomId !== 'espaco') {
        const p = gridToScreen(5, 10);
        const sp = baseToScreen(p.sx, p.sy - 14 * indoorFitScale);
        drawSignLabel(ctx, sp.sx, sp.sy, 'SAIR P/ PRAÇA', '#1e293b', '#fbbf24', '#fde047', -16);
      }
      if (baseRoomId === 'balada') {
        const p = gridToScreen(5, 3);
        const sp = baseToScreen(p.sx, p.sy - 26 * indoorFitScale);
        drawSignLabel(ctx, sp.sx, sp.sy, 'TRABALHAR DE DJ', '#3b0764', '#a855f7', '#f0abfc', -18);
      } else if (baseRoomId === 'cafeteria') {
        const p1 = gridToScreen(5, 3);
        const sp1 = baseToScreen(p1.sx, p1.sy - 26 * indoorFitScale);
        drawSignLabel(ctx, sp1.sx, sp1.sy, 'BALCÃO BARISTA', '#451a03', '#fb923c', '#ffedd5', -18);
        const p2 = gridToScreen(7, 3);
        const sp2 = baseToScreen(p2.sx, p2.sy - 26 * indoorFitScale);
        drawSignLabel(ctx, sp2.sx, sp2.sy, 'TOMAR CAFÉ (-8M)', '#78350f', '#fbbf24', '#fef3c7', -18);
      } else if (baseRoomId === 'mercado') {
        const p1 = gridToScreen(5, 3);
        const sp1 = baseToScreen(p1.sx, p1.sy - 26 * indoorFitScale);
        drawSignLabel(ctx, sp1.sx, sp1.sy, 'ENTREGAS F2P', '#14532d', '#22c55e', '#dcfce7', -18);
        const p2 = gridToScreen(7, 3);
        const sp2 = baseToScreen(p2.sx, p2.sy - 26 * indoorFitScale);
        drawSignLabel(ctx, sp2.sx, sp2.sy, 'FRUTAS (-8M)', '#3f2314', '#4ade80', '#dcfce7', -18);
      }

      for (const lbl of indoorLabelQueue) {
        const sp = baseToScreen(lbl.bx, lbl.by);
        drawPlayerNameAndBubble(ctx, sp.sx, sp.sy, lbl.pl, now);
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [baseRoomId, activeScene, canvasSize, dpr, currentPlayerId, editMode, selectedFurnId, roomMeta, sceneImgTick]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { bx: sx, by: sy } = screenToBase(screenX, screenY);

    if (activeScene) {
      if (sceneVideoRef.current?.paused) {
        sceneVideoRef.current.play().catch(() => {});
      }
      const tf = getSceneTransform(activeScene, canvasSize.w, canvasSize.h);
      const px = (sx - tf.ox) / tf.scale;
      const py = (sy - tf.oy) / tf.scale;
      if (px < 0 || py < 0 || px > activeScene.width || py > activeScene.height) return;

      // 1. Check real online players (non-NPC) click
      const avatarScale = activeScene.avatarScale * tf.scale;
      const halfW = Math.max(14 / camRef.current.zoom, 18 * avatarScale);
      const fullH = Math.max(28 / camRef.current.zoom, 48 * avatarScale);
      for (const pl of players) {
        if (pl.id === currentPlayerId || pl.isNpc) continue;
        const vp = visualPosRef.current[pl.id] || { vx: pl.x, vy: pl.y };
        const pxy = gridToScenePx(activeScene, vp.vx, vp.vy);
        const psx = tf.ox + pxy.px * tf.scale;
        const psy = tf.oy + pxy.py * tf.scale;
        if (Math.abs(sx - psx) < halfW && sy >= psy - fullH && sy <= psy + 8) {
          soundFX.playClick();
          setSelectedPlayer(pl);
          return;
        }
      }

      const startSceneWalk = (
        destPx: number,
        destPy: number,
        finalDir?: Direction,
        finalAction: ActionId = 'parado',
        onArrive?: () => void,
        finalView?: TurnaroundView
      ) => {
        const me = players.find((p) => p.id === currentPlayerId);
        const curVis = visualPosRef.current[currentPlayerId];
        const curPx = curVis
          ? gridToScenePx(activeScene, curVis.vx, curVis.vy)
          : me
          ? gridToScenePx(activeScene, me.x, me.y)
          : { px: destPx, py: destPy };

        const steps = findScenePath(
          activeScene,
          curPx.px,
          curPx.py,
          destPx,
          destPy,
          finalDir,
          finalAction,
          finalView
        );
        if (steps.length === 0) return;

        // If already essentially at destination, perform final pose immediately
        if (Math.hypot(destPx - curPx.px, destPy - curPx.py) < 12) {
          walkQueueRef.current = [];
          activeWalkTargetRef.current = null;
          pendingPostWalkRef.current = null;
          if (finalView || finalDir) {
            lastVisualViewRef.current[currentPlayerId] = finalView || finalDir || 'frente';
          }
          const g = scenePxToGrid(activeScene, destPx, destPy);
          onMove(g.x, g.y, finalDir || me?.direction || 'frente', finalAction, 1);
          onArrive?.();
          return;
        }

        walkQueueRef.current = steps.slice(1);
        activeWalkTargetRef.current = steps[0];
        pendingPostWalkRef.current = onArrive || null;
        soundFX.playStep();
        lastStepSoundAtRef.current = Date.now();
      };

      // 2. Check Interactive Scene Landmarks, Benches, Doors & Kiosks
      const hit = activeScene.hotspots.find(
        (h) => px >= h.x0 && px <= h.x1 && py >= h.y0 && py <= h.y1
      );
      if (hit) {
        setSelectedPlayer(null);
        if (hit.kind === 'catalog') {
          soundFX.playClick();
          onOpenShop();
          return;
        }
        if (hit.kind === 'portal' && hit.targetRoom) {
          const targetRoom = hit.targetRoom;
          if (hit.approachPos) {
            startSceneWalk(
              hit.approachPos.px,
              hit.approachPos.py,
              hit.approachPos.dir,
              'parado',
              () => {
                soundFX.playClick();
                onChangeRoom(targetRoom);
              },
              hit.approachPos.view
            );
          } else {
            soundFX.playClick();
            onChangeRoom(targetRoom);
          }
          return;
        }
        if (hit.kind === 'warp' && hit.warpDest) {
          startSceneWalk(
            hit.warpDest.px,
            hit.warpDest.py,
            hit.warpDest.dir,
            'parado',
            undefined,
            hit.warpDest.view
          );
          return;
        }
        if (hit.kind === 'job_kiosk' && hit.approachPos) {
          startSceneWalk(
            hit.approachPos.px,
            hit.approachPos.py,
            hit.approachPos.dir,
            'parado',
            () => {
              soundFX.playClick();
              onOpenMinigames();
            },
            hit.approachPos.view
          );
          return;
        }
        if (hit.kind === 'food_kiosk' && hit.approachPos && hit.routineAction) {
          const routineAction = hit.routineAction;
          startSceneWalk(
            hit.approachPos.px,
            hit.approachPos.py,
            hit.approachPos.dir,
            'comemorando',
            () => {
              soundFX.playCoin();
              onRoutineAction(routineAction);
            },
            hit.approachPos.view
          );
          return;
        }
        if (hit.kind === 'bench' && hit.sitPos) {
          startSceneWalk(hit.sitPos.px, hit.sitPos.py, hit.sitPos.dir, 'sentado', undefined, hit.sitPos.view);
          return;
        }
      }

      setSelectedPlayer(null);

      // 3. Walk along navigable floor/sidewalk tiles
      const dest = findNearestWalkableScene(activeScene, px, py);
      startSceneWalk(dest.px, dest.py, undefined, 'parado');
      return;
    }

    // INDOOR ROOMS CLICK LOGIC
    const charScale = CHAR_BASE_SCALE * indoorFitScale;
    const hitHalfW = Math.max(14 / camRef.current.zoom, 18 * charScale);
    const hitTopH = Math.max(32 / camRef.current.zoom, 48 * charScale);
    for (const pl of players) {
      if (pl.id === currentPlayerId) continue;
      const vp = visualPosRef.current[pl.id] || { vx: pl.x, vy: pl.y };
      const { sx: px, sy: py } = gridToScreen(vp.vx, vp.vy);
      if (Math.abs(sx - px) < hitHalfW && sy >= py - hitTopH && sy <= py + tileH * 0.6) {
        soundFX.playClick();
        setSelectedPlayer(pl);
        return;
      }
    }
    setSelectedPlayer(null);

    const { x, y } = screenToGrid(sx, sy);
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return;

    if (isOwnSpace && editMode) {
      if (buildTab === 'terreno') {
        soundFX.playClick();
        onBuildTile(x, y);
        return;
      }
      if (placingInstanceId) {
        soundFX.playClick();
        onFurnish('place', { instanceId: placingInstanceId, x, y, rotation: 0 });
        setPlacingInstanceId(null);
        return;
      }
      const existing = spaceInfo?.furniture.find((f) => f.x === x && f.y === y);
      if (existing) {
        soundFX.playClick();
        setSelectedFurnId(existing.instanceId);
        return;
      }
      setSelectedFurnId(null);
      return;
    }

    const props = getRoomProps(baseRoomId);
    const plotSet =
      baseRoomId === 'espaco'
        ? new Set(spaceInfo?.plotTiles || createStarterPlotTiles())
        : null;

    const isIntermediateWalkable = (tx: number, ty: number) => {
      if (baseRoomId === 'espaco') {
        if (!plotSet?.has(`${tx},${ty}`)) return false;
        const blocker = spaceInfo?.furniture.find((f) => f.x === tx && f.y === ty);
        if (blocker) {
          const cat = getCatalogItem(blocker.itemId);
          if (cat && cat.shape !== 'rug') return false;
        }
        return true;
      }
      if (isBlockedTile(baseRoomId, tx, ty)) return false;
      const blockerProp = props.find((p) => p.x === tx && p.y === ty);
      if (blockerProp && blockerProp.kind !== 'portal') return false;
      return true;
    };

    const startIndoorWalk = (
      goalX: number,
      goalY: number,
      finalDir?: Direction,
      finalAction: ActionId = 'parado',
      onArrive?: () => void,
      finalView?: TurnaroundView
    ) => {
      const me = players.find((p) => p.id === currentPlayerId);
      const curVis = visualPosRef.current[currentPlayerId];
      const startX = Math.round(curVis ? curVis.vx : me?.x ?? goalX);
      const startY = Math.round(curVis ? curVis.vy : me?.y ?? goalY);

      if (startX === goalX && startY === goalY) {
        walkQueueRef.current = [];
        activeWalkTargetRef.current = null;
        pendingPostWalkRef.current = null;
        if (finalView) lastVisualViewRef.current[currentPlayerId] = finalView;
        onMove(goalX, goalY, finalDir || me?.direction || 'frente', finalAction, 0);
        onArrive?.();
        return;
      }

      const path = findIndoorPath(
        startX,
        startY,
        goalX,
        goalY,
        isIntermediateWalkable,
        finalDir,
        finalAction,
        finalView
      );
      if (path.length === 0) return;

      walkQueueRef.current = path.slice(1);
      activeWalkTargetRef.current = path[0];
      pendingPostWalkRef.current = onArrive || null;
      soundFX.playStep();
      lastStepSoundAtRef.current = Date.now();
    };

    const findClosestAdjacentWalkable = (tx: number, ty: number) => {
      const me = players.find((p) => p.id === currentPlayerId);
      const curVis = visualPosRef.current[currentPlayerId];
      const sx0 = Math.round(curVis ? curVis.vx : me?.x ?? tx);
      const sy0 = Math.round(curVis ? curVis.vy : me?.y ?? ty);
      const candidates = [
        { x: tx, y: ty + 1, faceDir: 'costas' as Direction, faceView: 'costas_direita' as TurnaroundView },
        { x: tx, y: ty - 1, faceDir: 'frente' as Direction, faceView: '3/4_esquerda' as TurnaroundView },
        { x: tx + 1, y: ty, faceDir: 'esquerda' as Direction, faceView: 'costas_esquerda' as TurnaroundView },
        { x: tx - 1, y: ty, faceDir: 'direita' as Direction, faceView: '3/4' as TurnaroundView },
      ].filter((c) => isIntermediateWalkable(c.x, c.y));
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => Math.hypot(a.x - sx0, a.y - sy0) - Math.hypot(b.x - sx0, b.y - sy0));
      return candidates[0];
    };

    const walkAdjacentToTarget = (tx: number, ty: number, onArrive?: () => void) => {
      const adj = findClosestAdjacentWalkable(tx, ty);
      if (!adj) return;
      startIndoorWalk(adj.x, adj.y, adj.faceDir, 'parado', onArrive, adj.faceView);
    };

    // Cozy Home Furniture Interactions in Nosso Espaço (walk square-by-square along walkable floor tiles)
    if (baseRoomId === 'espaco' && spaceInfo) {
      const furn = spaceInfo.furniture.find((f) => f.x === x && f.y === y);
      if (furn) {
        const cat = getCatalogItem(furn.itemId);
        if (cat) {
          const furnFlipped = furn.rotation === 90 || furn.rotation === 270;
          if (cat.shape === 'bed') {
            startIndoorWalk(x, y, furnFlipped ? 'esquerda' : 'direita', 'deitado', () => onRoutineAction('dormir_cama'), '3/4');
            return;
          }
          if (cat.shape === 'sofa') {
            startIndoorWalk(x, y, furnFlipped ? 'esquerda' : 'direita', 'sentado', () => onRoutineAction('relaxar_sofa'), furnFlipped ? '3/4_esquerda' : '3/4');
            return;
          }
          if (cat.shape === 'table') {
            startIndoorWalk(x, y, 'direita', 'sentado', () => onRoutineAction('sentar_mesa'), '3/4');
            return;
          }
          if (cat.shape === 'chest') {
            walkAdjacentToTarget(x, y, () => onRoutineAction('abrir_bau'));
            return;
          }
          if (cat.shape === 'plant') {
            walkAdjacentToTarget(x, y, () => onRoutineAction('regar_planta'));
            return;
          }
          if (cat.shape === 'arcade' || cat.shape === 'dj') {
            walkAdjacentToTarget(x, y, () => onRoutineAction('jogar_arcade'));
            return;
          }
        }
      }
    }

    const prop = props.find((p) => p.x === x && p.y === y);
    if (prop) {
      if (prop.kind === 'portal' && prop.targetRoom && baseRoomId !== 'espaco') {
        const targetRoom = prop.targetRoom;
        startIndoorWalk(x, y, 'frente', 'parado', () => {
          soundFX.playClick();
          onChangeRoom(targetRoom);
        });
        return;
      }
      if (prop.kind === 'shop_kiosk') {
        walkAdjacentToTarget(x, y, () => {
          soundFX.playClick();
          onOpenShop();
        });
        return;
      }
      if (prop.kind === 'job_kiosk') {
        walkAdjacentToTarget(x, y, () => {
          soundFX.playClick();
          onOpenMinigames();
        });
        return;
      }
      if (prop.kind === 'food_kiosk' && prop.routineAction) {
        const routineAction = prop.routineAction;
        walkAdjacentToTarget(x, y, () => {
          soundFX.playCoin();
          onRoutineAction(routineAction);
        });
        return;
      }
      if (prop.kind === 'bench') {
        const benchView: TurnaroundView = prop.x <= 4 ? '3/4' : '3/4_esquerda';
        const benchDir: Direction = prop.x <= 4 ? 'direita' : 'esquerda';
        startIndoorWalk(x, y, benchDir, 'sentado', undefined, benchView);
        return;
      }
    }

    if (isIntermediateWalkable(x, y)) {
      startIndoorWalk(x, y, undefined, 'parado');
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    setMouseCanvasPos({ x: screenX, y: screenY });
    const { bx: sx, by: sy } = screenToBase(screenX, screenY);

    if (activeScene) {
      const tf = getSceneTransform(activeScene, canvasSize.w, canvasSize.h);
      const px = (sx - tf.ox) / tf.scale;
      const py = (sy - tf.oy) / tf.scale;
      const hit =
        activeScene.hotspots.find((h) => px >= h.x0 && px <= h.x1 && py >= h.y0 && py <= h.y1) ||
        null;
      setHoveredHotspot(hit);
      setHoverTile(null);
      return;
    }

    setHoveredHotspot(null);
    const { x, y } = screenToGrid(sx, sy);
    if (x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE) {
      setHoverTile({ x, y });
    } else {
      setHoverTile(null);
    }
  };

  const handleZoomIn = () => {
    soundFX.playClick();
    setZoom((z) => Math.min(MAX_ZOOM, Number((z + 0.35).toFixed(2))));
  };

  const handleZoomOut = () => {
    soundFX.playClick();
    setZoom((z) => Math.max(MIN_ZOOM, Number((z - 0.35).toFixed(2))));
  };

  const handleZoomReset = () => {
    soundFX.playClick();
    panOffsetRef.current = { x: 0, y: 0 };
    setZoom(1);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const delta = e.deltaY < 0 ? 0.18 : -0.18;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((z + delta).toFixed(2)))));
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      touchPanRef.current.active = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {
        dist: Math.hypot(dx, dy),
        startZoom: zoomRef.current,
        active: true,
      };
      suppressClickRef.current = true;
    } else if (e.touches.length === 1) {
      touchPanRef.current = {
        active: true,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startPanX: panOffsetRef.current.x,
        startPanY: panOffsetRef.current.y,
        moved: false,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && pinchRef.current.active && pinchRef.current.dist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const next = pinchRef.current.startZoom * (newDist / pinchRef.current.dist);
      setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(next.toFixed(2)))));
      return;
    }
    if (e.touches.length === 1 && touchPanRef.current.active) {
      const dx = e.touches[0].clientX - touchPanRef.current.startX;
      const dy = e.touches[0].clientY - touchPanRef.current.startY;
      if (!touchPanRef.current.moved && Math.hypot(dx, dy) > 10) {
        touchPanRef.current.moved = true;
        suppressClickRef.current = true;
      }
      if (touchPanRef.current.moved) {
        const invZ = 1 / Math.max(0.5, camRef.current.zoom);
        panOffsetRef.current = {
          x: Math.max(-420, Math.min(420, touchPanRef.current.startPanX - dx * invZ)),
          y: Math.max(-320, Math.min(320, touchPanRef.current.startPanY - dy * invZ)),
        };
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2 && pinchRef.current.active) {
      pinchRef.current.active = false;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 160);
    }
    if (e.touches.length === 0 && touchPanRef.current.active) {
      const wasPan = touchPanRef.current.moved;
      touchPanRef.current.active = false;
      touchPanRef.current.moved = false;
      if (wasPan) {
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 140);
      } else {
        suppressClickRef.current = false;
        // Clear pan offset when tapping to walk/interact
        panOffsetRef.current = { x: 0, y: 0 };
      }
    }
  };

  const startDpadHold = (dx: number, dy: number, dir: Direction) => {
    if (dpadHoldTimerRef.current !== null) {
      window.clearInterval(dpadHoldTimerRef.current);
    }
    stepDirectionRef.current(dx, dy, dir);
    dpadHoldTimerRef.current = window.setInterval(() => {
      stepDirectionRef.current(dx, dy, dir);
    }, 155);
  };

  const stopDpadHold = () => {
    if (dpadHoldTimerRef.current !== null) {
      window.clearInterval(dpadHoldTimerRef.current);
      dpadHoldTimerRef.current = null;
    }
  };

  const ownedFurniture = myInventory.filter((inv) => {
    const cat = getCatalogItem(inv.itemId);
    return cat?.category === 'movel';
  });

  const isAlreadyFriend = (id: string) => myFriends.some((f) => f.id === id);

  return (
    <div className="w-full h-full flex flex-col sm:flex-row overflow-hidden bg-[#090d1f]">
      {/* Canvas Stage */}
      <div
        ref={containerRef}
        className="relative flex-1 min-w-0 min-h-0 h-full bg-[#090d1f] overflow-hidden select-none"
      >
        {activeScene && (
          <video
            key={activeScene.id}
            ref={sceneVideoRef}
            src={activeScene.videoUrl}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none"
          />
        )}
        <canvas
          ref={canvasRef}
          width={Math.round(canvasSize.w * dpr)}
          height={Math.round(canvasSize.h * dpr)}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseLeave={() => {
            setHoveredHotspot(null);
            setMouseCanvasPos(null);
          }}
          className="w-full h-full block cursor-pointer touch-none"
        />

        {/* Right-Edge Vertical Quick Rail (Mockup Image 1 Style: Zoom + Citizens + Chat + D-Pad) */}
        <div
          className={`absolute right-2.5 sm:right-3 z-20 flex flex-col items-center gap-1 p-1.5 rounded-2xl oasis-capsule ${
            baseRoomId === 'praca' ? 'top-2.5 sm:top-3' : isCompactHeight ? 'top-12' : 'top-14 sm:top-16'
          }`}
        >
          <button
            type="button"
            title="Aproximar câmera"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-[#141c3c] hover:bg-amber-400/20 disabled:opacity-40 text-amber-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Centralizar e resetar zoom (1.0x)"
            onClick={handleZoomReset}
            className="w-9 h-6 sm:w-8 rounded-lg bg-[#090e22] hover:bg-[#1a244d] text-[10px] font-mono-nums font-bold text-amber-200 flex items-center justify-center cursor-pointer border border-amber-400/25"
          >
            {zoom.toFixed(1)}x
          </button>
          <button
            type="button"
            title="Distanciar câmera"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-[#141c3c] hover:bg-amber-400/20 disabled:opacity-40 text-sky-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <div className="w-5 h-px bg-amber-400/30 my-0.5" />

          {onOpenFriends && (
            <button
              type="button"
              title="Jogadores Online & Amigos"
              onClick={() => {
                soundFX.playClick();
                onOpenFriends();
              }}
              className="w-9 sm:w-8 py-1 rounded-xl bg-[#141c3c] hover:bg-amber-400/20 text-slate-100 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-[10px] font-mono-nums font-bold leading-none">
                {onlineCount}
              </span>
            </button>
          )}

          {onToggleChatLog && (
            <button
              type="button"
              title="Histórico do Chat"
              onClick={() => {
                soundFX.playClick();
                onToggleChatLog();
              }}
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-[#141c3c] hover:bg-amber-400/20 text-amber-300 flex items-center justify-center cursor-pointer transition-colors"
            >
              <MessageSquareText className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            title={showDpad ? 'Ocultar controle direcional' : 'Mostrar controle direcional'}
            onClick={() => {
              soundFX.playClick();
              setShowDpad((v) => !v);
            }}
            className={`w-9 h-9 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
              showDpad
                ? 'bg-amber-400 text-slate-950'
                : 'bg-[#141c3c] hover:bg-amber-400/20 text-slate-300'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile / Touch Virtual D-Pad */}
        {showDpad && !(isOwnSpace && editMode && isMobile && !isCompactHeight) && (
          <div
            className={`absolute left-2.5 sm:left-3 z-20 select-none ${
              isOwnSpace && !editMode ? 'bottom-14 sm:bottom-16' : 'bottom-3'
            }`}
          >
            <div className="grid grid-cols-3 gap-1 p-1.5 rounded-2xl bg-[#0a1026]/80 border border-amber-400/45 backdrop-blur-md shadow-xl">
              <div />
              <button
                type="button"
                aria-label="Andar para cima"
                onPointerDown={(e) => {
                  e.preventDefault();
                  startDpadHold(0, -1, 'costas');
                }}
                onPointerUp={stopDpadHold}
                onPointerLeave={stopDpadHold}
                onPointerCancel={stopDpadHold}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#161f42]/95 active:bg-amber-400 active:text-slate-950 border border-amber-400/35 text-amber-200 flex items-center justify-center touch-none cursor-pointer"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <div />
              <button
                type="button"
                aria-label="Andar para esquerda"
                onPointerDown={(e) => {
                  e.preventDefault();
                  startDpadHold(-1, 0, 'esquerda');
                }}
                onPointerUp={stopDpadHold}
                onPointerLeave={stopDpadHold}
                onPointerCancel={stopDpadHold}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#161f42]/95 active:bg-amber-400 active:text-slate-950 border border-amber-400/35 text-amber-200 flex items-center justify-center touch-none cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#0b1024]/70 border border-amber-400/15 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-amber-400/45" />
              </div>
              <button
                type="button"
                aria-label="Andar para direita"
                onPointerDown={(e) => {
                  e.preventDefault();
                  startDpadHold(1, 0, 'direita');
                }}
                onPointerUp={stopDpadHold}
                onPointerLeave={stopDpadHold}
                onPointerCancel={stopDpadHold}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#161f42]/95 active:bg-amber-400 active:text-slate-950 border border-amber-400/35 text-amber-200 flex items-center justify-center touch-none cursor-pointer"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <div />
              <button
                type="button"
                aria-label="Andar para baixo"
                onPointerDown={(e) => {
                  e.preventDefault();
                  startDpadHold(0, 1, 'frente');
                }}
                onPointerUp={stopDpadHold}
                onPointerLeave={stopDpadHold}
                onPointerCancel={stopDpadHold}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#161f42]/95 active:bg-amber-400 active:text-slate-950 border border-amber-400/35 text-amber-200 flex items-center justify-center touch-none cursor-pointer"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <div />
            </div>
          </div>
        )}

        {/* Interactive Hotspot Tooltip on 2D Scenes */}
        {activeScene && hoveredHotspot && mouseCanvasPos && (
          <div
            style={{
              left: Math.min(canvasSize.w - 205, Math.max(12, mouseCanvasPos.x + 12)),
              top: Math.max(12, mouseCanvasPos.y - 34),
            }}
            className="hidden sm:block absolute z-20 pointer-events-none px-2.5 py-1 rounded-lg bg-[#0d1226]/95 border border-amber-400/70 text-[11px] font-bold text-amber-200 shadow-lg whitespace-nowrap"
          >
            {hoveredHotspot.label}
          </div>
        )}

        {/* Top-Left Location Card for Indoor Rooms */}
        {baseRoomId !== 'praca' && (
          <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10 flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-2xl oasis-capsule">
            <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/45 flex items-center justify-center text-amber-300 shrink-0">
              {baseRoomId === 'espaco' ? <Home className="w-4 h-4" /> : <Compass className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white leading-tight truncate max-w-[140px] sm:max-w-none">
                {baseRoomId === 'espaco' && spaceInfo
                  ? `Canto de ${spaceInfo.ownerName}`
                  : roomMeta.name}
              </div>
              <div className="text-[11px] text-slate-300 leading-tight mt-0.5 hidden md:block">
                {roomMeta.subtitle}
              </div>
            </div>
          </div>
        )}

        {/* Top-Right Room Controls */}
        <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10 flex items-center gap-1.5 sm:gap-2">
          {baseRoomId !== 'praca' && (
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onChangeRoom('praca');
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl oasis-capsule hover:bg-[#1a244d] text-xs font-bold text-amber-300 cursor-pointer whitespace-nowrap min-h-[38px]"
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voltar p/ Praça</span>
              <span className="sm:hidden">Praça</span>
            </button>
          )}

          {isOwnSpace && (
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setEditMode((v) => !v);
                setPlacingInstanceId(null);
                setSelectedFurnId(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer whitespace-nowrap min-h-[38px] transition-colors ${
                editMode
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                  : 'oasis-capsule text-amber-200 hover:bg-[#1a244d]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{editMode ? 'Concluir Obra' : 'Construir & Mobiliar'}</span>
              <span className="sm:hidden">{editMode ? 'Concluir' : 'Construir'}</span>
            </button>
          )}
        </div>

        {/* Nosso Espaço Cozy Routine Strip when NOT editing */}
        {isOwnSpace && !editMode && (
          <div className="absolute bottom-2 left-2 right-2 sm:right-auto sm:bottom-3 sm:left-3 z-10 flex items-center gap-1.5 sm:gap-2 rounded-2xl oasis-capsule px-2.5 py-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-amber-300 mr-1 hidden md:inline whitespace-nowrap">
              Rotina da Casa:
            </span>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onRoutineAction('arrumar_casa');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[#162044] hover:bg-emerald-600/30 border border-emerald-400/45 text-[11px] font-semibold text-emerald-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3 h-3" />
              <span>Arrumar Casa</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onRoutineAction('regar_planta');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[#162044] hover:bg-sky-600/30 border border-sky-400/45 text-[11px] font-semibold text-sky-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Droplets className="w-3 h-3" />
              <span>Regar Plantas</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onRoutineAction('tomar_banho');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[#162044] hover:bg-purple-600/30 border border-purple-400/45 text-[11px] font-semibold text-purple-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Coffee className="w-3 h-3" />
              <span>Renovar Visual</span>
            </button>
          </div>
        )}

        {/* Selected Online Player Interaction Card */}
        {selectedPlayer && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-30 sm:w-72 rounded-2xl oasis-panel p-3.5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[#090d1f] border border-amber-400/40 p-1 shrink-0">
                <PixelAvatarPreview
                  avatar={selectedPlayer.avatar}
                  expression={selectedPlayer.expression}
                  scale={2}
                  width={56}
                  height={78}
                  animate={false}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white truncate">
                    {selectedPlayer.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayer(null)}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                  {selectedPlayer.bio}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                disabled={isAlreadyFriend(selectedPlayer.id)}
                onClick={() => {
                  soundFX.playClick();
                  onAddFriend(selectedPlayer.id, selectedPlayer.name);
                }}
                className="px-2.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isAlreadyFriend(selectedPlayer.id) ? 'Amigo' : 'Add Amigo'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  onStartTrade(selectedPlayer);
                  setSelectedPlayer(null);
                }}
                className="px-2.5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>Trocar</span>
              </button>
            </div>
          </div>
        )}

        {/* Subtle walk hint bottom-right (desktop) */}
        {!editMode && (
          <div className="hidden lg:block absolute bottom-2.5 right-3 pointer-events-none px-3 py-1 rounded-xl bg-[#0a1026]/80 border border-amber-400/25 text-[11px] text-slate-200">
            {activeScene
              ? activeScene.walkHint
              : 'Clique no chão para andar · Clique em bancos/portas para interagir'}
          </div>
        )}
      </div>

      {/* CONSTRUIR NOSSO CANTO DOCKED PANEL (Mockup Image 2 Style — side-docked on landscape/tablet/PC, bottom-docked on portrait) */}
      {isOwnSpace && editMode && (
        <aside className="w-full sm:w-72 lg:w-80 shrink-0 max-h-[46%] sm:max-h-full sm:h-full oasis-panel border-t-2 sm:border-t-0 sm:border-l-2 border-amber-400/65 p-3 flex flex-col gap-2.5 overflow-y-auto z-20">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-amber-400/25">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/45 flex items-center justify-center text-amber-300 shrink-0">
                <Blocks className="w-4 h-4" />
              </div>
              <span className="font-pixel text-xs text-white truncate">CONSTRUIR NOSSO CANTO</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditMode(false);
                setPlacingInstanceId(null);
                setSelectedFurnId(null);
              }}
              className="text-xs font-bold text-slate-200 hover:text-white px-2.5 py-1.5 rounded-xl bg-[#182145] border border-amber-400/35 flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>Fechar</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sub-mode tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setBuildTab('terreno');
                setPlacingInstanceId(null);
                setSelectedFurnId(null);
              }}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border transition-colors ${
                buildTab === 'terreno'
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                  : 'bg-[#161f42] border-[#2c386e] text-slate-200 hover:text-white'
              }`}
            >
              <Blocks className="w-3.5 h-3.5" />
              <span>Terreno</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setBuildTab('mobiliar');
              }}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border transition-colors ${
                buildTab === 'mobiliar'
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                  : 'bg-[#161f42] border-[#2c386e] text-slate-200 hover:text-white'
              }`}
            >
              <Armchair className="w-3.5 h-3.5" />
              <span>Móveis</span>
            </button>
          </div>

          {/* Floor Theme Selector */}
          <div>
            <div className="text-[11px] font-bold text-slate-200 mb-1.5">Tema do Piso</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ROOM_THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    onFurnish('theme', { theme: th.id });
                  }}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border cursor-pointer truncate flex items-center gap-2 ${
                    spaceInfo?.theme === th.id
                      ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200'
                      : 'bg-[#161f42] text-slate-200 border-[#2c386e] hover:border-amber-400/50'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-sm border border-black/30 shrink-0"
                    style={{ backgroundColor: th.floorA }}
                  />
                  <span className="truncate">{th.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {buildTab === 'terreno' ? (
            <div className="rounded-xl bg-[#090e22] border border-amber-400/30 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-amber-300">Blocos do Terreno</span>
                <span className="font-mono-nums text-white">
                  {spaceInfo?.plotTiles?.length ?? 36}/{spaceInfo?.plotMaxBlocks ?? STARTER_PLOT_MAX_BLOCKS}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Toque nos quadrados tracejados no mapa para <strong>adicionar</strong> blocos ou toque sobre um piso existente para <strong>remover</strong> e esculpir seu terreno livremente!
              </p>
              <div className="text-[10px] text-amber-300/90 font-semibold pt-1.5 border-t border-[#1e2647]">
                Expansões futuras poderão ampliar o limite de blocos.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <div className="text-[11px] text-slate-200 bg-[#090e22] border border-[#283366] rounded-xl px-2.5 py-2">
                {placingInstanceId
                  ? 'Toque em qualquer bloco construído no mapa para posicionar o móvel!'
                  : 'Selecione um móvel abaixo para colocar ou toque em um já colocado para girar/guardar.'}
              </div>

              {selectedFurnId && (
                <div className="flex flex-col gap-1.5 bg-amber-500/15 border border-amber-400/50 rounded-xl p-2.5">
                  <span className="text-[11px] font-bold text-amber-200">Móvel selecionado:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onFurnish('rotate', { instanceId: selectedFurnId })}
                      className="flex-1 px-2.5 py-2 rounded-xl bg-[#161f42] hover:bg-[#212e61] border border-amber-400/35 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Girar 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onFurnish('remove', { instanceId: selectedFurnId });
                        setSelectedFurnId(null);
                      }}
                      className="flex-1 px-2.5 py-2 rounded-xl bg-rose-600/85 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Guardar</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
                {ownedFurniture.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">
                    Você ainda não possui móveis extras. Visite o Catálogo ou o Bazar!
                  </div>
                ) : (
                  ownedFurniture.map((inv) => {
                    const cat = getCatalogItem(inv.itemId);
                    if (!cat) return null;
                    const isPlaced = spaceInfo?.furniture.some((f) => f.instanceId === inv.instanceId);
                    const isActive = placingInstanceId === inv.instanceId;
                    return (
                      <button
                        key={inv.instanceId}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setPlacingInstanceId(isActive ? null : inv.instanceId);
                        }}
                        className={`w-full px-2.5 py-2 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                          isActive
                            ? 'bg-amber-400 text-slate-950 border-amber-200'
                            : isPlaced
                            ? 'bg-[#121c3d] border-emerald-400/45 text-slate-100'
                            : 'bg-[#0c1229] border-[#263266] text-slate-200 hover:border-amber-400/60'
                        }`}
                      >
                        <ItemThumbnail item={cat} className="w-10 h-10" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate">{cat.name}</div>
                          <div
                            className={`text-[10px] font-semibold ${
                              isActive
                                ? 'text-slate-900'
                                : isPlaced
                                ? 'text-emerald-300'
                                : 'text-amber-300'
                            }`}
                          >
                            {isPlaced ? 'No quarto (toque p/ mover)' : 'Pronto p/ colocar'}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Bottom Diamond Accent Divider */}
          <div className="mt-auto pt-1 flex items-center gap-2 opacity-70" aria-hidden="true">
            <div className="h-px flex-1 bg-amber-400/35" />
            <span className="text-[10px] text-amber-300">◆</span>
            <div className="h-px flex-1 bg-amber-400/35" />
          </div>
        </aside>
      )}
    </div>
  );
};
