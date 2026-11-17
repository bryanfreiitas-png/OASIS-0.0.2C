export type RoomId = 'praca' | 'balada' | 'cafeteria' | 'mercado' | 'espaco';

export type Gender = 'masculino' | 'feminino';

export type Direction = 'frente' | 'direita' | 'costas' | 'esquerda';

export type ExpressionId =
  | 'normal'
  | 'feliz'
  | 'bravo'
  | 'oculos'
  | 'chorando'
  | 'piscando'
  | 'surpreso'
  | 'irritado'
  | 'apaixonado';

export type ActionId =
  | 'parado'
  | 'andando'
  | 'correndo'
  | 'pulando'
  | 'dancando'
  | 'sentado'
  | 'deitado'
  | 'acenando'
  | 'pensando'
  | 'comemorando'
  | 'agachado';

export type HairStyleId =
  | 'topete_fade'
  | 'coque_alto'
  | 'ondulado_longo'
  | 'curto_baguncado'
  | 'bob_moderno'
  | 'moicano_neon'
  | 'trancas';

export interface AvatarConfig {
  gender: Gender;
  skinTone: string;
  hairStyle: HairStyleId;
  hairColor: string;
  eyeColor: string;
  tattoo: boolean;
  shirtId: string | null;
  pantsId: string | null;
  shoesId: string | null;
  accessoryId: string | null;
}

export type ItemCategory =
  | 'roupa_cima'
  | 'roupa_baixo'
  | 'calcado'
  | 'acessorio'
  | 'movel';

export type Rarity = 'comum' | 'incomum' | 'raro' | 'epico';

export interface CatalogItem {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  priceCoins: number;
  priceGems?: number;
  rarity: Rarity;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  shape: string;
  tradeable: boolean;
  spriteUrl?: string;
  spriteShirtFolder?: string;
  themeCollection?: 'rustica' | 'neon';
  expiresAt?: number;
}

export interface InventoryItem {
  instanceId: string;
  itemId: string;
  obtainedAt: number;
}

export interface PlacedFurniture {
  instanceId: string;
  itemId: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
}

export type RoomTheme =
  | 'madeira_classica'
  | 'neon_roxo'
  | 'praia_areia'
  | 'marmore_luxo';

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  metric: 'steps' | 'friends' | 'messages' | 'trades_or_buys' | 'minigames';
  target: number;
  progress: number;
  rewardCoins: number;
  rewardGems: number;
  claimed: boolean;
}

export interface MarketListing {
  listingId: string;
  sellerId: string;
  sellerName: string;
  itemId: string;
  instanceId: string;
  priceCoins: number;
  createdAt: number;
}

export interface TradeOffer {
  tradeId: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  offeredInstanceIds: string[];
  offeredItemIds: string[];
  offeredCoins: number;
  requestedInstanceIds: string[];
  requestedItemIds: string[];
  requestedCoins: number;
  status: 'pendente' | 'aceita' | 'recusada';
  createdAt: number;
}

export const LIVE_TRADE_MAX_SLOTS = 6;

export interface LiveTradeSlotItem {
  instanceId: string;
  itemId: string;
}

export interface LiveTradeSide {
  playerId: string;
  playerName: string;
  slots: LiveTradeSlotItem[];
  coins: number;
  locked: boolean;
  confirmed: boolean;
}

export interface LiveTradeSession {
  sessionId: string;
  a: LiveTradeSide;
  b: LiveTradeSide;
  status: 'convite' | 'negociando' | 'concluida' | 'cancelada';
  createdAt: number;
}

export interface PlayerNeeds {
  energia: number;
  fome: number;
  diversao: number;
  higiene: number;
}

export interface RoutineTask {
  id: string;
  title: string;
  done: boolean;
  rewardCoins: number;
}

export interface SpaceInfoPayload {
  ownerName: string;
  theme: RoomTheme;
  furniture: PlacedFurniture[];
  plotTiles: string[];
  plotMaxBlocks: number;
}

export interface ChatMessage {
  id: string;
  roomKey: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  type: 'chat' | 'system' | 'action';
  timestamp: number;
}

export interface WorldPlayer {
  id: string;
  name: string;
  bio: string;
  avatar: AvatarConfig;
  roomKey: string;
  x: number;
  y: number;
  direction: Direction;
  expression: ExpressionId;
  action: ActionId;
  bubbleText?: string;
  bubbleExpiresAt?: number;
  isOnline: boolean;
  isNpc?: boolean;
  npcRole?: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  bio: string;
  moedas: number;
  gemas: number;
  stepsWalked: number;
  avatar: AvatarConfig;
  inventory: InventoryItem[];
  roomFurniture: PlacedFurniture[];
  roomTheme: RoomTheme;
  plotTiles: string[];
  plotMaxBlocks: number;
  needs: PlayerNeeds;
  routineTasks: RoutineTask[];
  friends: Array<{ id: string; name: string }>;
  quests: DailyQuest[];
}

export interface RoomMeta {
  id: RoomId;
  name: string;
  subtitle: string;
  floorPrimary: string;
  floorSecondary: string;
  wallColor: string;
  accentColor: string;
}
