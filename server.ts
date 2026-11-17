import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import {
  CATALOG_ITEMS,
  GEM_PACKAGES,
  STARTER_PLOT_MAX_BLOCKS,
  createInitialNeeds,
  createInitialQuests,
  createInitialRoutineTasks,
  createStarterPlotTiles,
  getCatalogItem,
} from './src/shared/catalog.ts';
import { LIVE_TRADE_MAX_SLOTS } from './src/shared/types.ts';
import type {
  ActionId,
  AvatarConfig,
  ChatMessage,
  Direction,
  ExpressionId,
  LiveTradeSession,
  MarketListing,
  PlacedFurniture,
  PlayerProfile,
  RoomTheme,
  SpaceInfoPayload,
  TradeOffer,
  WorldPlayer,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'oasis-world-state.json');

interface PersistedState {
  profiles: Record<string, PlayerProfile>;
  marketListings: MarketListing[];
  trades: Record<string, TradeOffer>;
}

const DEFAULT_CHAT_SEED: Record<string, ChatMessage[]> = {
  praca: [
    {
      id: 'seed_welcome',
      roomKey: 'praca',
      senderId: 'sistema',
      senderName: 'OASIS',
      senderColor: '#fbbf24',
      text: 'Bem-vindo à Praça Central! Clique na calçada ou use WASD para andar.',
      type: 'system',
      timestamp: Date.now() - 60000,
    },
  ],
  balada: [],
  cafeteria: [],
  mercado: [],
};

function createInitialPersistedState(): PersistedState {
  return {
    profiles: {},
    marketListings: [
      {
        listingId: 'lst_seed_sofa',
        sellerId: 'bazar_oasis',
        sellerName: 'Bazar OASIS',
        itemId: 'rust_02',
        instanceId: 'seed_inst_sofa',
        priceCoins: 245,
        createdAt: Date.now() - 360000,
      },
      {
        listingId: 'lst_seed_arcade',
        sellerId: 'bazar_oasis',
        sellerName: 'Bazar OASIS',
        itemId: 'neon_21',
        instanceId: 'seed_inst_arcade',
        priceCoins: 450,
        createdAt: Date.now() - 240000,
      },
      {
        listingId: 'lst_seed_jacket',
        sellerId: 'bazar_oasis',
        sellerName: 'Bazar OASIS',
        itemId: 'shirt_jaqueta_cyber',
        instanceId: 'seed_inst_jacket',
        priceCoins: 215,
        createdAt: Date.now() - 120000,
      },
    ],
    trades: {},
  };
}

let state: PersistedState = createInitialPersistedState();
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed && parsed.profiles) {
      state = parsed;
    }
  }
} catch (err) {
  console.error('Failed to load persisted state, using defaults:', err);
}

let saveTimer: NodeJS.Timeout | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving state:', err);
    }
  }, 400);
}

// Ephemeral live session state
const roomChats: Record<string, ChatMessage[]> = { ...DEFAULT_CHAT_SEED };
const activePlayers = new Map<string, WorldPlayer>();
const socketsByPlayer = new Map<string, WebSocket>();
const playerBySocket = new Map<WebSocket, string>();
const liveTradeSessions = new Map<string, LiveTradeSession>();

function clampStat(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

const LEGACY_FURN_MAP: Record<string, string> = {
  furn_sofa_raro: 'rust_02',
  furn_sofa_neon: 'neon_02',
  furn_cama_oasis: 'rust_03',
  furn_mesa_centro: 'rust_05',
  furn_planta: 'rust_30',
  furn_fliperama: 'neon_21',
  furn_luminaria: 'neon_40',
  furn_mesa_dj: 'neon_24',
  furn_tapete: 'rust_41',
};

function ensureProfileFields(profile: PlayerProfile): PlayerProfile {
  if (!Array.isArray(profile.plotTiles) || profile.plotTiles.length === 0) {
    profile.plotTiles = createStarterPlotTiles();
  }
  if (!profile.plotMaxBlocks || profile.plotMaxBlocks < 16) {
    profile.plotMaxBlocks = STARTER_PLOT_MAX_BLOCKS;
  }
  if (!profile.needs) {
    profile.needs = createInitialNeeds();
  }
  if (!Array.isArray(profile.routineTasks) || profile.routineTasks.length === 0) {
    profile.routineTasks = createInitialRoutineTasks();
  }
  for (const inv of profile.inventory) {
    if (LEGACY_FURN_MAP[inv.itemId]) inv.itemId = LEGACY_FURN_MAP[inv.itemId];
  }
  for (const rf of profile.roomFurniture) {
    if (LEGACY_FURN_MAP[rf.itemId]) rf.itemId = LEGACY_FURN_MAP[rf.itemId];
  }
  return profile;
}

const CHAT_COLORS = ['#4ade80', '#f472b6', '#a78bfa', '#38bdf8', '#fbbf24', '#fb923c'];
function getPlayerColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CHAT_COLORS[Math.abs(hash) % CHAT_COLORS.length];
}

function getRoomPlayers(roomKey: string): WorldPlayer[] {
  const result: WorldPlayer[] = [];
  for (const p of activePlayers.values()) {
    if (p.roomKey === roomKey) {
      result.push(p);
    }
  }
  return result;
}

function getRoomCounts(): Record<string, number> {
  const counts: Record<string, number> = {
    praca: 0,
    balada: 0,
    cafeteria: 0,
    mercado: 0,
    espaco: 0,
  };
  for (const p of activePlayers.values()) {
    const base = p.roomKey.startsWith('espaco') ? 'espaco' : p.roomKey;
    counts[base] = (counts[base] || 0) + 1;
  }
  return counts;
}

function sendJson(ws: WebSocket | undefined, payload: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(roomKey: string, payload: unknown) {
  for (const [playerId, player] of activePlayers.entries()) {
    if (player.roomKey === roomKey) {
      sendJson(socketsByPlayer.get(playerId), payload);
    }
  }
}

function broadcastAll(payload: unknown) {
  for (const ws of socketsByPlayer.values()) {
    sendJson(ws, payload);
  }
}

function updateQuestProgress(profile: PlayerProfile, metric: PlayerProfile['quests'][0]['metric'], amount: number, isAbsolute = false) {
  for (const q of profile.quests) {
    if (q.metric === metric && !q.claimed) {
      q.progress = isAbsolute ? Math.min(q.target, amount) : Math.min(q.target, q.progress + amount);
    }
  }
}

function getSpacePayload(ownerId: string): SpaceInfoPayload {
  const owner = state.profiles[ownerId];
  if (owner) {
    ensureProfileFields(owner);
    return {
      ownerName: owner.name,
      theme: owner.roomTheme,
      furniture: owner.roomFurniture,
      plotTiles: owner.plotTiles,
      plotMaxBlocks: owner.plotMaxBlocks,
    };
  }
  return {
    ownerName: 'Visitante',
    theme: 'neon_roxo',
    furniture: [
      { instanceId: 'demo_1', itemId: 'neon_46', x: 5, y: 5, rotation: 0 },
      { instanceId: 'demo_2', itemId: 'neon_02', x: 4, y: 4, rotation: 0 },
      { instanceId: 'demo_3', itemId: 'neon_21', x: 7, y: 4, rotation: 0 },
      { instanceId: 'demo_4', itemId: 'neon_30', x: 3, y: 4, rotation: 0 },
    ],
    plotTiles: createStarterPlotTiles(),
    plotMaxBlocks: STARTER_PLOT_MAX_BLOCKS,
  };
}

function ensureStarterInventory(avatar: AvatarConfig): PlayerProfile['inventory'] {
  const items: PlayerProfile['inventory'] = [];
  const add = (itemId: string | null) => {
    if (!itemId || itemId === 'shirt_sem') return;
    if (!items.some((i) => i.itemId === itemId)) {
      items.push({
        instanceId: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        itemId,
        obtainedAt: Date.now(),
      });
    }
  };
  add(avatar.shirtId);
  add(avatar.pantsId);
  add(avatar.shoesId);
  add(avatar.accessoryId);
  // Give 3 starter Rústico furniture pieces so Nosso Espaço is immediately cozy!
  add('rust_03');
  add('rust_30');
  add('rust_41');
  return items;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, playersOnline: activePlayers.size });
  });

  app.get('/api/public-spaces', (_req, res) => {
    const spaces = Object.values(state.profiles).map((p) => ({
      ownerId: p.id,
      ownerName: p.name,
      furnitureCount: p.roomFurniture.length,
      theme: p.roomTheme,
    }));
    res.json({ spaces });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.on('message', (rawData) => {
      let msg: { type: string; payload?: Record<string, unknown> };
      try {
        msg = JSON.parse(rawData.toString());
      } catch {
        return;
      }

      const payload = msg.payload || {};

      if (msg.type === 'auth:join') {
        const requestedId = String(payload.playerId || `p_${Math.random().toString(36).slice(2, 10)}`);
        const name = String(payload.name || 'Morador').trim().slice(0, 18) || 'Morador';
        const bio = String(payload.bio || 'Explorando a cidade de OASIS!').slice(0, 80);
        const avatar = payload.avatar as AvatarConfig;

        let profile = state.profiles[requestedId];
        if (!profile) {
          const starterInv = ensureStarterInventory(avatar);
          const bedInst = starterInv.find((i) => i.itemId === 'rust_03')?.instanceId || 'starter_bed';
          const rugInst = starterInv.find((i) => i.itemId === 'rust_41')?.instanceId || 'starter_rug';
          const plantInst = starterInv.find((i) => i.itemId === 'rust_30')?.instanceId || 'starter_plant';

          profile = {
            id: requestedId,
            name,
            bio,
            moedas: 450,
            gemas: 15,
            stepsWalked: 0,
            avatar,
            inventory: starterInv,
            roomFurniture: [
              { instanceId: rugInst, itemId: 'rust_41', x: 5, y: 5, rotation: 0 },
              { instanceId: bedInst, itemId: 'rust_03', x: 3, y: 3, rotation: 0 },
              { instanceId: plantInst, itemId: 'rust_30', x: 8, y: 3, rotation: 0 },
            ],
            roomTheme: 'madeira_classica',
            plotTiles: createStarterPlotTiles(),
            plotMaxBlocks: STARTER_PLOT_MAX_BLOCKS,
            needs: createInitialNeeds(),
            routineTasks: createInitialRoutineTasks(),
            friends: [],
            quests: createInitialQuests(),
          };
          state.profiles[requestedId] = profile;
          scheduleSave();
        } else {
          ensureProfileFields(profile);
          profile.name = name;
          profile.bio = bio;
          if (avatar) {
            profile.avatar = avatar;
          }
          scheduleSave();
        }

        const roomKey = 'praca';
        const worldPlayer: WorldPlayer = {
          id: profile.id,
          name: profile.name,
          bio: profile.bio,
          avatar: profile.avatar,
          roomKey,
          x: 4.2,
          y: 4.5,
          direction: 'frente',
          expression: 'feliz',
          action: 'parado',
          isOnline: true,
        };

        activePlayers.set(profile.id, worldPlayer);
        socketsByPlayer.set(profile.id, ws);
        playerBySocket.set(ws, profile.id);

        if (!roomChats[roomKey]) roomChats[roomKey] = [];

        const pendingTrades = Object.values(state.trades).filter(
          (t) => t.status === 'pendente' && (t.toId === profile.id || t.fromId === profile.id)
        );

        const activeLiveTrades = Array.from(liveTradeSessions.values()).filter(
          (s) =>
            (s.status === 'convite' || s.status === 'negociando') &&
            (s.a.playerId === profile.id || s.b.playerId === profile.id)
        );

        sendJson(ws, {
          type: 'init:sync',
          payload: {
            profile,
            roomKey,
            players: getRoomPlayers(roomKey),
            chatHistory: roomChats[roomKey].slice(-40),
            roomCounts: getRoomCounts(),
            marketListings: state.marketListings,
            trades: pendingTrades,
            liveTradeSession: activeLiveTrades[0] || null,
            onlinePlayers: Array.from(activePlayers.values()).map((p) => ({ id: p.id, name: p.name, roomKey: p.roomKey })),
          },
        });

        broadcastToRoom(roomKey, {
          type: 'room:players',
          payload: { roomKey, players: getRoomPlayers(roomKey) },
        });
        broadcastAll({
          type: 'city:counts',
          payload: {
            roomCounts: getRoomCounts(),
            onlinePlayers: Array.from(activePlayers.values()).map((p) => ({ id: p.id, name: p.name, roomKey: p.roomKey })),
          },
        });
        return;
      }

      const playerId = playerBySocket.get(ws);
      if (!playerId) return;
      const profile = state.profiles[playerId];
      const worldPlayer = activePlayers.get(playerId);
      if (!profile || !worldPlayer) return;

      if (msg.type === 'room:change') {
        const rawTarget = String(payload.roomKey || 'praca');
        if (rawTarget === 'shopping') {
          sendJson(ws, { type: 'toast', payload: { message: 'Os móveis agora ficam no botão Catálogo!', kind: 'info' } });
          return;
        }
        const targetRoomKey = rawTarget;
        const oldRoomKey = worldPlayer.roomKey;
        if (oldRoomKey === targetRoomKey) return;

        const spawnMap: Record<string, { x: number; y: number }> = {
          praca: { x: 4.2, y: 4.5 },
          balada: { x: 2.68, y: 8.43 },
          cafeteria: { x: 4.75, y: 7.46 },
        };
        const spawn = spawnMap[targetRoomKey] || { x: 5, y: 7 };
        worldPlayer.roomKey = targetRoomKey;
        worldPlayer.x = spawn.x;
        worldPlayer.y = spawn.y;
        worldPlayer.action = 'parado';
        worldPlayer.bubbleText = undefined;

        if (!roomChats[targetRoomKey]) {
          roomChats[targetRoomKey] = [];
        }

        broadcastToRoom(oldRoomKey, {
          type: 'room:players',
          payload: { roomKey: oldRoomKey, players: getRoomPlayers(oldRoomKey) },
        });

        const spaceInfo = targetRoomKey.startsWith('espaco:')
          ? getSpacePayload(targetRoomKey.split(':')[1])
          : null;

        sendJson(ws, {
          type: 'room:entered',
          payload: {
            roomKey: targetRoomKey,
            players: getRoomPlayers(targetRoomKey),
            chatHistory: roomChats[targetRoomKey].slice(-40),
            spaceInfo,
          },
        });

        broadcastToRoom(targetRoomKey, {
          type: 'room:players',
          payload: { roomKey: targetRoomKey, players: getRoomPlayers(targetRoomKey) },
        });

        broadcastAll({
          type: 'city:counts',
          payload: {
            roomCounts: getRoomCounts(),
            onlinePlayers: Array.from(activePlayers.values()).map((p) => ({ id: p.id, name: p.name, roomKey: p.roomKey })),
          },
        });
      } else if (msg.type === 'player:move') {
        const x = Number(payload.x);
        const y = Number(payload.y);
        const direction = (payload.direction as Direction) || worldPlayer.direction;
        const action = (payload.action as ActionId) || 'parado';
        const steps = Math.max(0, Math.min(10, Number(payload.steps || 1)));

        if (Number.isFinite(x) && Number.isFinite(y)) {
          worldPlayer.x = Math.max(0, Math.min(11, x));
          worldPlayer.y = Math.max(0, Math.min(11, y));
          worldPlayer.direction = direction;
          worldPlayer.action = action;

          if (steps > 0) {
            profile.stepsWalked += steps;
            updateQuestProgress(profile, 'steps', steps);
            scheduleSave();
            sendJson(ws, { type: 'profile:update', payload: { profile } });
          }

          broadcastToRoom(worldPlayer.roomKey, {
            type: 'player:updated',
            payload: { player: worldPlayer },
          });
        }
      } else if (msg.type === 'player:state') {
        if (payload.expression) worldPlayer.expression = payload.expression as ExpressionId;
        if (payload.action) worldPlayer.action = payload.action as ActionId;
        if (payload.direction) worldPlayer.direction = payload.direction as Direction;

        broadcastToRoom(worldPlayer.roomKey, {
          type: 'player:updated',
          payload: { player: worldPlayer },
        });
      } else if (msg.type === 'avatar:update') {
        const newAvatar = payload.avatar as AvatarConfig;
        if (newAvatar) {
          profile.avatar = { ...profile.avatar, ...newAvatar };
          if (typeof payload.name === 'string' && payload.name.trim()) {
            profile.name = payload.name.trim().slice(0, 18);
            worldPlayer.name = profile.name;
          }
          if (typeof payload.bio === 'string') {
            profile.bio = payload.bio.slice(0, 80);
            worldPlayer.bio = profile.bio;
          }
          worldPlayer.avatar = profile.avatar;
          scheduleSave();
          sendJson(ws, { type: 'profile:update', payload: { profile } });
          broadcastToRoom(worldPlayer.roomKey, {
            type: 'player:updated',
            payload: { player: worldPlayer },
          });
        }
      } else if (msg.type === 'chat:send') {
        const text = String(payload.text || '').trim().slice(0, 140);
        if (!text) return;

        const roomKey = worldPlayer.roomKey;
        if (!roomChats[roomKey]) roomChats[roomKey] = [];

        const chatMsg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          roomKey,
          senderId: profile.id,
          senderName: profile.name,
          senderColor: getPlayerColor(profile.name),
          text,
          type: 'chat',
          timestamp: Date.now(),
        };

        roomChats[roomKey].push(chatMsg);
        if (roomChats[roomKey].length > 80) roomChats[roomKey].shift();

        worldPlayer.bubbleText = text;
        worldPlayer.bubbleExpiresAt = Date.now() + 5500;

        updateQuestProgress(profile, 'messages', 1);
        scheduleSave();

        sendJson(ws, { type: 'profile:update', payload: { profile } });
        broadcastToRoom(roomKey, { type: 'chat:message', payload: { message: chatMsg } });
        broadcastToRoom(roomKey, { type: 'player:updated', payload: { player: worldPlayer } });
      } else if (msg.type === 'shop:buy') {
        const itemId = String(payload.itemId || '');
        const payWith = payload.payWith === 'gemas' ? 'gemas' : 'moedas';
        const item = getCatalogItem(itemId);
        if (!item) return;

        if (item.expiresAt && Date.now() > item.expiresAt) {
          sendJson(ws, {
            type: 'toast',
            payload: { message: 'Esta coleção temática já expirou! Procure no Bazar ou em trocas.', kind: 'error' },
          });
          return;
        }

        if (payWith === 'gemas') {
          if (!item.priceGems || profile.gemas < item.priceGems) {
            sendJson(ws, { type: 'toast', payload: { message: 'Gemas insuficientes para este item.', kind: 'error' } });
            return;
          }
          profile.gemas -= item.priceGems;
        } else {
          if (profile.moedas < item.priceCoins) {
            sendJson(ws, { type: 'toast', payload: { message: 'Moedas insuficientes! Trabalhe nos minigames ou venda itens.', kind: 'error' } });
            return;
          }
          profile.moedas -= item.priceCoins;
        }

        profile.inventory.push({
          instanceId: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          itemId: item.id,
          obtainedAt: Date.now(),
        });

        updateQuestProgress(profile, 'trades_or_buys', 1);
        scheduleSave();

        sendJson(ws, { type: 'profile:update', payload: { profile } });
        sendJson(ws, { type: 'toast', payload: { message: `Você comprou ${item.name}!`, kind: 'success' } });
      } else if (msg.type === 'gems:buy') {
        const packId = String(payload.packId || '');
        const pack = GEM_PACKAGES.find((p) => p.id === packId);
        if (!pack) return;

        profile.gemas += pack.gems + pack.bonus;
        scheduleSave();
        sendJson(ws, { type: 'profile:update', payload: { profile } });
        sendJson(ws, {
          type: 'toast',
          payload: {
            message: `Pacote "${pack.label}" creditado: +${pack.gems + pack.bonus} gemas!`,
            kind: 'success',
          },
        });
      } else if (msg.type === 'gems:exchange') {
        const gemsToSpend = Math.max(1, Math.floor(Number(payload.gems || 0)));
        if (profile.gemas < gemsToSpend) {
          sendJson(ws, { type: 'toast', payload: { message: 'Gemas insuficientes.', kind: 'error' } });
          return;
        }
        const coinsEarned = gemsToSpend * 25;
        profile.gemas -= gemsToSpend;
        profile.moedas += coinsEarned;
        scheduleSave();
        sendJson(ws, { type: 'profile:update', payload: { profile } });
        sendJson(ws, { type: 'toast', payload: { message: `Convertido: +${coinsEarned} moedas!`, kind: 'success' } });
      } else if (msg.type === 'inventory:equip') {
        const itemId = payload.itemId ? String(payload.itemId) : null;
        const category = String(payload.category || '');
        if (itemId && itemId !== 'shirt_sem') {
          const owned = profile.inventory.some((i) => i.itemId === itemId);
          if (!owned) return;
        }

        if (category === 'roupa_cima') profile.avatar.shirtId = itemId;
        if (category === 'roupa_baixo') profile.avatar.pantsId = itemId;
        if (category === 'calcado') profile.avatar.shoesId = itemId;
        if (category === 'acessorio') profile.avatar.accessoryId = itemId;

        worldPlayer.avatar = profile.avatar;
        scheduleSave();

        sendJson(ws, { type: 'profile:update', payload: { profile } });
        broadcastToRoom(worldPlayer.roomKey, { type: 'player:updated', payload: { player: worldPlayer } });
      } else if (msg.type === 'room:furnish') {
        ensureProfileFields(profile);
        const op = String(payload.op || '');
        if (op === 'place') {
          const instanceId = String(payload.instanceId || '');
          const x = Number(payload.x);
          const y = Number(payload.y);
          const rotation = ([0, 90, 180, 270].includes(Number(payload.rotation)) ? Number(payload.rotation) : 0) as 0 | 90 | 180 | 270;
          if (!profile.plotTiles.includes(`${x},${y}`)) {
            sendJson(ws, { type: 'toast', payload: { message: 'Você só pode colocar móveis sobre os blocos construídos do seu terreno!', kind: 'error' } });
            return;
          }
          const owned = profile.inventory.find((i) => i.instanceId === instanceId);
          if (!owned) return;
          const item = getCatalogItem(owned.itemId);
          if (!item || item.category !== 'movel') return;

          const existingIdx = profile.roomFurniture.findIndex((f) => f.instanceId === instanceId);
          if (existingIdx >= 0) {
            profile.roomFurniture[existingIdx] = { instanceId, itemId: item.id, x, y, rotation };
          } else {
            profile.roomFurniture.push({ instanceId, itemId: item.id, x, y, rotation });
          }
        } else if (op === 'remove') {
          const instanceId = String(payload.instanceId || '');
          profile.roomFurniture = profile.roomFurniture.filter((f) => f.instanceId !== instanceId);
        } else if (op === 'rotate') {
          const instanceId = String(payload.instanceId || '');
          const furn = profile.roomFurniture.find((f) => f.instanceId === instanceId);
          if (furn) {
            furn.rotation = (((furn.rotation + 90) % 360) as 0 | 90 | 180 | 270);
          }
        } else if (op === 'theme') {
          profile.roomTheme = String(payload.theme || 'madeira_classica') as RoomTheme;
        }

        scheduleSave();
        sendJson(ws, { type: 'profile:update', payload: { profile } });

        const targetRoomKey = `espaco:${profile.id}`;
        broadcastToRoom(targetRoomKey, {
          type: 'space:updated',
          payload: {
            roomKey: targetRoomKey,
            spaceInfo: getSpacePayload(profile.id),
          },
        });
      } else if (msg.type === 'room:build_tile') {
        ensureProfileFields(profile);
        const x = Math.floor(Number(payload.x));
        const y = Math.floor(Number(payload.y));
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 11 || y > 11) return;

        const tileKey = `${x},${y}`;
        const existsIdx = profile.plotTiles.indexOf(tileKey);

        if (existsIdx >= 0) {
          if (profile.plotTiles.length <= 4) {
            sendJson(ws, { type: 'toast', payload: { message: 'Mantenha ao menos 4 blocos de terreno no seu espaço!', kind: 'error' } });
            return;
          }
          const hasFurniture = profile.roomFurniture.some((f) => f.x === x && f.y === y);
          if (hasFurniture) {
            sendJson(ws, { type: 'toast', payload: { message: 'Guarde ou mova o móvel desse bloco antes de removê-lo.', kind: 'error' } });
            return;
          }
          profile.plotTiles.splice(existsIdx, 1);
        } else {
          if (profile.plotTiles.length >= profile.plotMaxBlocks) {
            sendJson(ws, {
              type: 'toast',
              payload: {
                message: `Limite de ${profile.plotMaxBlocks} blocos atingido! Remova um bloco para remodelar ou aguarde expansões.`,
                kind: 'error',
              },
            });
            return;
          }
          profile.plotTiles.push(tileKey);
        }

        scheduleSave();
        sendJson(ws, { type: 'profile:update', payload: { profile } });

        const targetRoomKey = `espaco:${profile.id}`;
        broadcastToRoom(targetRoomKey, {
          type: 'space:updated',
          payload: {
            roomKey: targetRoomKey,
            spaceInfo: getSpacePayload(profile.id),
          },
        });
      } else if (msg.type === 'routine:action') {
        ensureProfileFields(profile);
        const actionType = String(payload.actionType || '');
        let toastText = 'Rotina atualizada!';
        let taskToComplete: string | null = null;
        let nextPose: ActionId | null = null;

        if (actionType === 'dormir_cama') {
          profile.needs.energia = clampStat(profile.needs.energia + 35);
          profile.needs.diversao = clampStat(profile.needs.diversao + 6);
          nextPose = 'deitado';
          taskToComplete = 'rt_descansar';
          toastText = 'Você descansou na cama (+35 Energia)!';
        } else if (actionType === 'relaxar_sofa') {
          profile.needs.energia = clampStat(profile.needs.energia + 18);
          profile.needs.diversao = clampStat(profile.needs.diversao + 20);
          nextPose = 'sentado';
          taskToComplete = 'rt_descansar';
          toastText = 'Relaxou no sofá (+18 Energia · +20 Diversão)!';
        } else if (actionType === 'regar_planta' || actionType === 'arrumar_casa') {
          profile.needs.higiene = clampStat(profile.needs.higiene + 18);
          profile.needs.diversao = clampStat(profile.needs.diversao + 12);
          nextPose = 'comemorando';
          taskToComplete = 'rt_arrumar';
          toastText =
            actionType === 'regar_planta'
              ? 'Plantinhas regadas! O ambiente ficou mais aconchegante.'
              : 'Casa arrumada e organizada (+18 Bem-Estar)!';
        } else if (actionType === 'jogar_arcade') {
          profile.needs.diversao = clampStat(profile.needs.diversao + 32);
          profile.needs.energia = clampStat(profile.needs.energia - 4);
          nextPose = 'comemorando';
          toastText = 'Partida no fliperama (+32 Diversão)!';
        } else if (actionType === 'lanche_cafeteria' || actionType === 'frutas_mercado') {
          if (profile.moedas >= 8) {
            profile.moedas -= 8;
          }
          profile.needs.fome = clampStat(profile.needs.fome + 36);
          profile.needs.energia = clampStat(profile.needs.energia + 10);
          taskToComplete = 'rt_comer';
          nextPose = 'feliz' as unknown as ActionId;
          nextPose = 'comemorando';
          toastText =
            actionType === 'lanche_cafeteria'
              ? 'Tomou café fresquinho (-8 moedas · +36 Fome · +10 Energia)!'
              : 'Comeu frutas do Mercado (-8 moedas · +36 Fome · +10 Energia)!';
        } else if (actionType === 'tomar_banho') {
          profile.needs.higiene = clampStat(profile.needs.higiene + 35);
          nextPose = 'comemorando';
          taskToComplete = 'rt_arrumar';
          toastText = 'Visual renovado (+35 Higiene)!';
        } else if (actionType === 'abrir_bau') {
          profile.needs.diversao = clampStat(profile.needs.diversao + 15);
          nextPose = 'agachado';
          taskToComplete = 'rt_arrumar';
          toastText = 'Você mexeu no baú e organizou seus tesouros (+15 Diversão)!';
        } else if (actionType === 'sentar_mesa') {
          profile.needs.fome = clampStat(profile.needs.fome + 16);
          profile.needs.energia = clampStat(profile.needs.energia + 10);
          nextPose = 'sentado';
          taskToComplete = 'rt_descansar';
          toastText = 'Sentou à mesa para um lanche rápido (+16 Fome · +10 Energia)!';
        }

        if (taskToComplete) {
          const rt = profile.routineTasks.find((t) => t.id === taskToComplete);
          if (rt && !rt.done) {
            rt.done = true;
            profile.moedas += rt.rewardCoins;
            toastText += ` · Tarefa da rotina: +${rt.rewardCoins} moedas!`;
          }
        }

        if (nextPose) {
          worldPlayer.action = nextPose;
          broadcastToRoom(worldPlayer.roomKey, { type: 'player:updated', payload: { player: worldPlayer } });
        }

        scheduleSave();
        sendJson(ws, { type: 'profile:update', payload: { profile } });
        sendJson(ws, { type: 'toast', payload: { message: toastText, kind: 'success' } });
      } else if (msg.type === 'liveTrade:invite') {
        const toId = String(payload.toId || '');
        const targetProfile = state.profiles[toId];
        const targetWs = socketsByPlayer.get(toId);
        if (!targetProfile || !targetWs || toId === profile.id) {
          sendJson(ws, { type: 'toast', payload: { message: 'O jogador precisa estar online para abrir a Mesa de Troca ao vivo.', kind: 'error' } });
          return;
        }

        const session: LiveTradeSession = {
          sessionId: `lt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          a: {
            playerId: profile.id,
            playerName: profile.name,
            slots: [],
            coins: 0,
            locked: false,
            confirmed: false,
          },
          b: {
            playerId: targetProfile.id,
            playerName: targetProfile.name,
            slots: [],
            coins: 0,
            locked: false,
            confirmed: false,
          },
          status: 'convite',
          createdAt: Date.now(),
        };
        liveTradeSessions.set(session.sessionId, session);

        const sysMsg: ChatMessage = {
          id: `sys_${Date.now()}`,
          roomKey: worldPlayer.roomKey,
          senderId: 'sistema',
          senderName: 'Sistema',
          senderColor: '#22d3ee',
          text: `${profile.name} convidou ${targetProfile.name} para uma mesa de troca!`,
          type: 'system',
          timestamp: Date.now(),
        };
        if (!roomChats[worldPlayer.roomKey]) roomChats[worldPlayer.roomKey] = [];
        roomChats[worldPlayer.roomKey].push(sysMsg);
        broadcastToRoom(worldPlayer.roomKey, { type: 'chat:message', payload: { message: sysMsg } });

        sendJson(ws, { type: 'liveTrade:updated', payload: { session } });
        sendJson(targetWs, { type: 'liveTrade:updated', payload: { session } });
        sendJson(targetWs, { type: 'toast', payload: { message: `${profile.name} abriu um convite de Troca ao Vivo!`, kind: 'info' } });
      } else if (msg.type === 'liveTrade:accept_invite') {
        const sessionId = String(payload.sessionId || '');
        const session = liveTradeSessions.get(sessionId);
        if (!session || session.status !== 'convite' || session.b.playerId !== profile.id) return;

        session.status = 'negociando';
        sendJson(socketsByPlayer.get(session.a.playerId), { type: 'liveTrade:updated', payload: { session } });
        sendJson(ws, { type: 'liveTrade:updated', payload: { session } });
      } else if (msg.type === 'liveTrade:toggle_item') {
        const sessionId = String(payload.sessionId || '');
        const instanceId = String(payload.instanceId || '');
        const session = liveTradeSessions.get(sessionId);
        if (!session || session.status !== 'negociando') return;

        const side =
          session.a.playerId === profile.id
            ? session.a
            : session.b.playerId === profile.id
            ? session.b
            : null;
        if (!side) return;

        const idx = side.slots.findIndex((s) => s.instanceId === instanceId);
        if (idx >= 0) {
          side.slots.splice(idx, 1);
        } else {
          if (side.slots.length >= LIVE_TRADE_MAX_SLOTS) {
            sendJson(ws, {
              type: 'toast',
              payload: { message: `A mesa de troca tem limite máximo de ${LIVE_TRADE_MAX_SLOTS} itens por jogador.`, kind: 'error' },
            });
            return;
          }
          const invItem = profile.inventory.find((i) => i.instanceId === instanceId);
          if (!invItem) return;
          const catItem = getCatalogItem(invItem.itemId);
          if (!catItem || !catItem.tradeable) return;
          side.slots.push({ instanceId: invItem.instanceId, itemId: invItem.itemId });
        }

        // Security lock reset whenever either side edits items
        session.a.locked = false;
        session.b.locked = false;
        session.a.confirmed = false;
        session.b.confirmed = false;

        sendJson(socketsByPlayer.get(session.a.playerId), { type: 'liveTrade:updated', payload: { session } });
        sendJson(socketsByPlayer.get(session.b.playerId), { type: 'liveTrade:updated', payload: { session } });
      } else if (msg.type === 'liveTrade:set_coins') {
        const sessionId = String(payload.sessionId || '');
        const coins = Math.max(0, Math.min(profile.moedas, Math.floor(Number(payload.coins || 0))));
        const session = liveTradeSessions.get(sessionId);
        if (!session || session.status !== 'negociando') return;

        const side =
          session.a.playerId === profile.id
            ? session.a
            : session.b.playerId === profile.id
            ? session.b
            : null;
        if (!side) return;

        side.coins = coins;
        session.a.locked = false;
        session.b.locked = false;
        session.a.confirmed = false;
        session.b.confirmed = false;

        sendJson(socketsByPlayer.get(session.a.playerId), { type: 'liveTrade:updated', payload: { session } });
        sendJson(socketsByPlayer.get(session.b.playerId), { type: 'liveTrade:updated', payload: { session } });
      } else if (msg.type === 'liveTrade:lock') {
        const sessionId = String(payload.sessionId || '');
        const session = liveTradeSessions.get(sessionId);
        if (!session || session.status !== 'negociando') return;

        const side =
          session.a.playerId === profile.id
            ? session.a
            : session.b.playerId === profile.id
            ? session.b
            : null;
        if (!side) return;

        side.locked = !side.locked;
        if (!side.locked) {
          session.a.confirmed = false;
          session.b.confirmed = false;
        }

        sendJson(socketsByPlayer.get(session.a.playerId), { type: 'liveTrade:updated', payload: { session } });
        sendJson(socketsByPlayer.get(session.b.playerId), { type: 'liveTrade:updated', payload: { session } });
      } else if (msg.type === 'liveTrade:confirm') {
        const sessionId = String(payload.sessionId || '');
        const session = liveTradeSessions.get(sessionId);
        if (!session || session.status !== 'negociando') return;
        if (!session.a.locked || !session.b.locked) {
          sendJson(ws, { type: 'toast', payload: { message: 'Os dois jogadores precisam travar a oferta antes de confirmar!', kind: 'error' } });
          return;
        }

        const side =
          session.a.playerId === profile.id
            ? session.a
            : session.b.playerId === profile.id
            ? session.b
            : null;
        if (!side) return;

        side.confirmed = true;

        if (!(session.a.confirmed && session.b.confirmed)) {
          sendJson(socketsByPlayer.get(session.a.playerId), { type: 'liveTrade:updated', payload: { session } });
          sendJson(socketsByPlayer.get(session.b.playerId), { type: 'liveTrade:updated', payload: { session } });
          return;
        }

        const profA = state.profiles[session.a.playerId];
        const profB = state.profiles[session.b.playerId];
        if (!profA || !profB) return;

        if (profA.moedas < session.a.coins || profB.moedas < session.b.coins) {
          sendJson(socketsByPlayer.get(profA.id), { type: 'toast', payload: { message: 'Saldo insuficiente para concluir a troca.', kind: 'error' } });
          sendJson(socketsByPlayer.get(profB.id), { type: 'toast', payload: { message: 'Saldo insuficiente para concluir a troca.', kind: 'error' } });
          session.a.confirmed = false;
          session.b.confirmed = false;
          sendJson(socketsByPlayer.get(profA.id), { type: 'liveTrade:updated', payload: { session } });
          sendJson(socketsByPlayer.get(profB.id), { type: 'liveTrade:updated', payload: { session } });
          return;
        }

        const aHasAll = session.a.slots.every((s) => profA.inventory.some((i) => i.instanceId === s.instanceId));
        const bHasAll = session.b.slots.every((s) => profB.inventory.some((i) => i.instanceId === s.instanceId));
        if (!aHasAll || !bHasAll) {
          session.status = 'cancelada';
          sendJson(socketsByPlayer.get(profA.id), { type: 'liveTrade:updated', payload: { session } });
          sendJson(socketsByPlayer.get(profB.id), { type: 'liveTrade:updated', payload: { session } });
          return;
        }

        // Atomic swap of coins & up to 6 items per side
        profA.moedas = profA.moedas - session.a.coins + session.b.coins;
        profB.moedas = profB.moedas - session.b.coins + session.a.coins;

        const moveItems = (src: PlayerProfile, dst: PlayerProfile, slots: LiveTradeSession['a']['slots']) => {
          for (const sl of slots) {
            const idx = src.inventory.findIndex((i) => i.instanceId === sl.instanceId);
            if (idx >= 0) {
              const [moved] = src.inventory.splice(idx, 1);
              src.roomFurniture = src.roomFurniture.filter((f) => f.instanceId !== sl.instanceId);
              const stillHasSame = src.inventory.some((i) => i.itemId === moved.itemId);
              if (!stillHasSame) {
                if (src.avatar.shirtId === moved.itemId) src.avatar.shirtId = 'shirt_sem';
                if (src.avatar.pantsId === moved.itemId) src.avatar.pantsId = 'pants_shorts_branco';
                if (src.avatar.shoesId === moved.itemId) src.avatar.shoesId = null;
                if (src.avatar.accessoryId === moved.itemId) src.avatar.accessoryId = null;
                const wp = activePlayers.get(src.id);
                if (wp) {
                  wp.avatar = src.avatar;
                  broadcastToRoom(wp.roomKey, { type: 'player:updated', payload: { player: wp } });
                }
              }
              dst.inventory.push(moved);
            }
          }
        };

        moveItems(profA, profB, session.a.slots);
        moveItems(profB, profA, session.b.slots);

        profA.needs.diversao = clampStat(profA.needs.diversao + 12);
        profB.needs.diversao = clampStat(profB.needs.diversao + 12);
        updateQuestProgress(profA, 'trades_or_buys', 1);
        updateQuestProgress(profB, 'trades_or_buys', 1);

        session.status = 'concluida';
        scheduleSave();

        sendJson(socketsByPlayer.get(profA.id), { type: 'profile:update', payload: { profile: profA } });
        sendJson(socketsByPlayer.get(profB.id), { type: 'profile:update', payload: { profile: profB } });
        sendJson(socketsByPlayer.get(profA.id), { type: 'liveTrade:updated', payload: { session } });
        sendJson(socketsByPlayer.get(profB.id), { type: 'liveTrade:updated', payload: { session } });
        sendJson(socketsByPlayer.get(profA.id), { type: 'toast', payload: { message: 'Troca ao vivo concluída com sucesso!', kind: 'success' } });
        sendJson(socketsByPlayer.get(profB.id), { type: 'toast', payload: { message: 'Troca ao vivo concluída com sucesso!', kind: 'success' } });
      } else if (msg.type === 'liveTrade:cancel') {
        const sessionId = String(payload.sessionId || '');
        const session = liveTradeSessions.get(sessionId);
        if (!session) return;
        if (session.a.playerId !== profile.id && session.b.playerId !== profile.id) return;

        session.status = 'cancelada';
        sendJson(socketsByPlayer.get(session.a.playerId), { type: 'liveTrade:updated', payload: { session } });
        sendJson(socketsByPlayer.get(session.b.playerId), { type: 'liveTrade:updated', payload: { session } });
        sendJson(socketsByPlayer.get(session.a.playerId), { type: 'toast', payload: { message: 'Mesa de troca encerrada.', kind: 'info' } });
        sendJson(socketsByPlayer.get(session.b.playerId), { type: 'toast', payload: { message: 'Mesa de troca encerrada.', kind: 'info' } });
      } else if (msg.type === 'market:list') {
        const instanceId = String(payload.instanceId || '');
        const priceCoins = Math.max(10, Math.min(99999, Math.floor(Number(payload.priceCoins || 50))));
        const itemIdx = profile.inventory.findIndex((i) => i.instanceId === instanceId);
        if (itemIdx < 0) return;

        const invItem = profile.inventory[itemIdx];
        const catItem = getCatalogItem(invItem.itemId);
        if (!catItem || !catItem.tradeable) return;

        // Remove from inventory & room if placed & unequip if equipped
        profile.inventory.splice(itemIdx, 1);
        profile.roomFurniture = profile.roomFurniture.filter((f) => f.instanceId !== instanceId);

        const stillHasSame = profile.inventory.some((i) => i.itemId === invItem.itemId);
        if (!stillHasSame) {
          if (profile.avatar.shirtId === invItem.itemId) profile.avatar.shirtId = 'shirt_sem';
          if (profile.avatar.pantsId === invItem.itemId) profile.avatar.pantsId = 'pants_shorts_branco';
          if (profile.avatar.shoesId === invItem.itemId) profile.avatar.shoesId = null;
          if (profile.avatar.accessoryId === invItem.itemId) profile.avatar.accessoryId = null;
          worldPlayer.avatar = profile.avatar;
        }

        const listing: MarketListing = {
          listingId: `lst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sellerId: profile.id,
          sellerName: profile.name,
          itemId: invItem.itemId,
          instanceId: invItem.instanceId,
          priceCoins,
          createdAt: Date.now(),
        };
        state.marketListings.unshift(listing);
        scheduleSave();

        sendJson(ws, { type: 'profile:update', payload: { profile } });
        broadcastAll({ type: 'market:updated', payload: { marketListings: state.marketListings } });
        sendJson(ws, { type: 'toast', payload: { message: `${catItem.name} anunciado por ${priceCoins} moedas!`, kind: 'success' } });
      } else if (msg.type === 'market:cancel') {
        const listingId = String(payload.listingId || '');
        const idx = state.marketListings.findIndex((l) => l.listingId === listingId && l.sellerId === profile.id);
        if (idx < 0) return;
        const [removed] = state.marketListings.splice(idx, 1);
        profile.inventory.push({
          instanceId: removed.instanceId,
          itemId: removed.itemId,
          obtainedAt: Date.now(),
        });
        scheduleSave();
        sendJson(ws, { type: 'profile:update', payload: { profile } });
        broadcastAll({ type: 'market:updated', payload: { marketListings: state.marketListings } });
      } else if (msg.type === 'market:buy') {
        const listingId = String(payload.listingId || '');
        const idx = state.marketListings.findIndex((l) => l.listingId === listingId);
        if (idx < 0) {
          sendJson(ws, { type: 'toast', payload: { message: 'Anúncio não está mais disponível.', kind: 'error' } });
          return;
        }
        const listing = state.marketListings[idx];
        if (listing.sellerId === profile.id) {
          sendJson(ws, { type: 'toast', payload: { message: 'Você já é o vendedor deste anúncio.', kind: 'error' } });
          return;
        }
        if (profile.moedas < listing.priceCoins) {
          sendJson(ws, { type: 'toast', payload: { message: 'Moedas insuficientes para comprar no Bazar.', kind: 'error' } });
          return;
        }

        state.marketListings.splice(idx, 1);
        profile.moedas -= listing.priceCoins;
        profile.inventory.push({
          instanceId: listing.instanceId,
          itemId: listing.itemId,
          obtainedAt: Date.now(),
        });
        updateQuestProgress(profile, 'trades_or_buys', 1);

        const sellerProfile = state.profiles[listing.sellerId];
        if (sellerProfile) {
          sellerProfile.moedas += listing.priceCoins;
          const sellerWs = socketsByPlayer.get(sellerProfile.id);
          sendJson(sellerWs, { type: 'profile:update', payload: { profile: sellerProfile } });
          sendJson(sellerWs, {
            type: 'toast',
            payload: { message: `${profile.name} comprou seu item por ${listing.priceCoins} moedas!`, kind: 'success' },
          });
        }

        scheduleSave();
        sendJson(ws, { type: 'profile:update', payload: { profile } });
        broadcastAll({ type: 'market:updated', payload: { marketListings: state.marketListings } });
        const cat = getCatalogItem(listing.itemId);
        sendJson(ws, { type: 'toast', payload: { message: `Comprado: ${cat?.name || 'Item'}!`, kind: 'success' } });
      } else if (msg.type === 'trade:send') {
        const toId = String(payload.toId || '');
        const targetProfile = state.profiles[toId];
        if (!targetProfile || toId === profile.id) {
          sendJson(ws, { type: 'toast', payload: { message: 'Jogador precisa estar online para troca direta.', kind: 'error' } });
          return;
        }
        const offeredInstanceIds = Array.isArray(payload.offeredInstanceIds) ? payload.offeredInstanceIds.map(String) : [];
        const requestedInstanceIds = Array.isArray(payload.requestedInstanceIds) ? payload.requestedInstanceIds.map(String) : [];
        const offeredCoins = Math.max(0, Math.floor(Number(payload.offeredCoins || 0)));
        const requestedCoins = Math.max(0, Math.floor(Number(payload.requestedCoins || 0)));

        if (offeredCoins > profile.moedas) {
          sendJson(ws, { type: 'toast', payload: { message: 'Você não tem moedas suficientes para essa oferta.', kind: 'error' } });
          return;
        }

        const offeredItemIds: string[] = [];
        for (const instId of offeredInstanceIds) {
          const found = profile.inventory.find((i) => i.instanceId === instId);
          if (!found) return;
          offeredItemIds.push(found.itemId);
        }

        const requestedItemIds: string[] = [];
        for (const instId of requestedInstanceIds) {
          const found = targetProfile.inventory.find((i) => i.instanceId === instId);
          if (!found) return;
          requestedItemIds.push(found.itemId);
        }

        const trade: TradeOffer = {
          tradeId: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          fromId: profile.id,
          fromName: profile.name,
          toId: targetProfile.id,
          toName: targetProfile.name,
          offeredInstanceIds,
          offeredItemIds,
          offeredCoins,
          requestedInstanceIds,
          requestedItemIds,
          requestedCoins,
          status: 'pendente',
          createdAt: Date.now(),
        };
        state.trades[trade.tradeId] = trade;
        scheduleSave();

        // System chat notification matching mockup ("Sistema: Julia pediu uma troca")
        const sysMsg: ChatMessage = {
          id: `sys_${Date.now()}`,
          roomKey: worldPlayer.roomKey,
          senderId: 'sistema',
          senderName: 'Sistema',
          senderColor: '#22d3ee',
          text: `${profile.name} pediu uma troca com ${targetProfile.name}`,
          type: 'system',
          timestamp: Date.now(),
        };
        if (!roomChats[worldPlayer.roomKey]) roomChats[worldPlayer.roomKey] = [];
        roomChats[worldPlayer.roomKey].push(sysMsg);
        broadcastToRoom(worldPlayer.roomKey, { type: 'chat:message', payload: { message: sysMsg } });

        sendJson(ws, { type: 'trade:updated', payload: { trade } });
        sendJson(socketsByPlayer.get(targetProfile.id), { type: 'trade:updated', payload: { trade } });
        sendJson(ws, { type: 'toast', payload: { message: `Proposta de troca enviada para ${targetProfile.name}!`, kind: 'success' } });
      } else if (msg.type === 'trade:respond') {
        const tradeId = String(payload.tradeId || '');
        const accept = Boolean(payload.accept);
        const trade = state.trades[tradeId];
        if (!trade || trade.status !== 'pendente' || trade.toId !== profile.id) return;

        const fromProfile = state.profiles[trade.fromId];
        if (!fromProfile) return;

        if (!accept) {
          trade.status = 'recusada';
          scheduleSave();
          sendJson(ws, { type: 'trade:updated', payload: { trade } });
          sendJson(socketsByPlayer.get(fromProfile.id), { type: 'trade:updated', payload: { trade } });
          return;
        }

        // Validate both still have items & coins
        if (fromProfile.moedas < trade.offeredCoins || profile.moedas < trade.requestedCoins) {
          sendJson(ws, { type: 'toast', payload: { message: 'Moedas insuficientes para concluir a troca.', kind: 'error' } });
          return;
        }
        const fromHasAll = trade.offeredInstanceIds.every((id) => fromProfile.inventory.some((i) => i.instanceId === id));
        const toHasAll = trade.requestedInstanceIds.every((id) => profile.inventory.some((i) => i.instanceId === id));
        if (!fromHasAll || !toHasAll) {
          sendJson(ws, { type: 'toast', payload: { message: 'Um dos itens não está mais no inventário.', kind: 'error' } });
          return;
        }

        // Swap coins
        fromProfile.moedas = fromProfile.moedas - trade.offeredCoins + trade.requestedCoins;
        profile.moedas = profile.moedas - trade.requestedCoins + trade.offeredCoins;

        // Swap items
        for (const instId of trade.offeredInstanceIds) {
          const idx = fromProfile.inventory.findIndex((i) => i.instanceId === instId);
          if (idx >= 0) {
            const [moved] = fromProfile.inventory.splice(idx, 1);
            fromProfile.roomFurniture = fromProfile.roomFurniture.filter((f) => f.instanceId !== instId);
            profile.inventory.push(moved);
          }
        }
        for (const instId of trade.requestedInstanceIds) {
          const idx = profile.inventory.findIndex((i) => i.instanceId === instId);
          if (idx >= 0) {
            const [moved] = profile.inventory.splice(idx, 1);
            profile.roomFurniture = profile.roomFurniture.filter((f) => f.instanceId !== instId);
            fromProfile.inventory.push(moved);
          }
        }

        trade.status = 'aceita';
        updateQuestProgress(profile, 'trades_or_buys', 1);
        updateQuestProgress(fromProfile, 'trades_or_buys', 1);
        scheduleSave();

        sendJson(ws, { type: 'profile:update', payload: { profile } });
        sendJson(ws, { type: 'trade:updated', payload: { trade } });
        sendJson(ws, { type: 'toast', payload: { message: 'Troca concluída com sucesso!', kind: 'success' } });

        const fromWs = socketsByPlayer.get(fromProfile.id);
        sendJson(fromWs, { type: 'profile:update', payload: { profile: fromProfile } });
        sendJson(fromWs, { type: 'trade:updated', payload: { trade } });
        sendJson(fromWs, { type: 'toast', payload: { message: `${profile.name} aceitou sua troca!`, kind: 'success' } });
      } else if (msg.type === 'friend:add') {
        const friendId = String(payload.friendId || '');
        const friendName = String(payload.friendName || '');
        if (!friendId || friendId === profile.id) return;

        if (!profile.friends.some((f) => f.id === friendId)) {
          profile.friends.push({ id: friendId, name: friendName || 'Morador' });
          updateQuestProgress(profile, 'friends', 1);
          scheduleSave();
          sendJson(ws, { type: 'profile:update', payload: { profile } });
          sendJson(ws, { type: 'toast', payload: { message: `${friendName} adicionado aos amigos!`, kind: 'success' } });
        }
      } else if (msg.type === 'minigame:complete') {
        ensureProfileFields(profile);
        const rewardCoins = Math.max(5, Math.min(60, Math.floor(Number(payload.rewardCoins || 15))));
        const jobName = String(payload.jobName || 'Trabalho');
        profile.moedas += rewardCoins;
        profile.needs.energia = clampStat(profile.needs.energia - 7);
        profile.needs.fome = clampStat(profile.needs.fome - 6);
        profile.needs.higiene = clampStat(profile.needs.higiene - 4);
        const workTask = profile.routineTasks.find((t) => t.id === 'rt_trabalho');
        if (workTask && !workTask.done) {
          workTask.done = true;
          profile.moedas += workTask.rewardCoins;
        }
        updateQuestProgress(profile, 'minigames', 1);
        scheduleSave();
        sendJson(ws, { type: 'profile:update', payload: { profile } });
        sendJson(ws, {
          type: 'toast',
          payload: { message: `Turno em "${jobName}" concluído: +${rewardCoins} moedas!`, kind: 'success' },
        });
      } else if (msg.type === 'quest:claim') {
        const questId = String(payload.questId || '');
        const quest = profile.quests.find((q) => q.id === questId);
        if (!quest || quest.claimed || quest.progress < quest.target) return;

        quest.claimed = true;
        profile.moedas += quest.rewardCoins;
        profile.gemas += quest.rewardGems;
        scheduleSave();

        sendJson(ws, { type: 'profile:update', payload: { profile } });
        sendJson(ws, {
          type: 'toast',
          payload: {
            message: `Missão "${quest.title}" resgatada: +${quest.rewardCoins} moedas e +${quest.rewardGems} gemas!`,
            kind: 'success',
          },
        });
      }
    });

    ws.on('close', () => {
      const playerId = playerBySocket.get(ws);
      if (playerId) {
        const p = activePlayers.get(playerId);
        const oldRoom = p?.roomKey;
        activePlayers.delete(playerId);
        socketsByPlayer.delete(playerId);
        playerBySocket.delete(ws);

        if (oldRoom) {
          broadcastToRoom(oldRoom, {
            type: 'room:players',
            payload: { roomKey: oldRoom, players: getRoomPlayers(oldRoom) },
          });
        }
        broadcastAll({
          type: 'city:counts',
          payload: {
            roomCounts: getRoomCounts(),
            onlinePlayers: Array.from(activePlayers.values()).map((pl) => ({ id: pl.id, name: pl.name, roomKey: pl.roomKey })),
          },
        });
      }
    });
  });

  // Expose catalog endpoint for inspection if needed
  app.get('/api/catalog', (_req, res) => {
    res.json({ items: CATALOG_ITEMS });
  });

  if (process.env.NODE_ENV !== 'production') {
    app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`OASIS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start OASIS server:', err);
  process.exit(1);
});
