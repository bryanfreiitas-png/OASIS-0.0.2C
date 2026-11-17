import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Clock,
  Coins,
  Gem,
  Search,
  Shirt,
  Sparkles,
  Trees,
  X,
  Zap,
} from 'lucide-react';
import { CATALOG_ITEMS, GEM_PACKAGES, SEASON_COLLECTIONS } from '../shared/catalog.ts';
import type { AvatarConfig, Rarity } from '../shared/types.ts';
import { PixelAvatarPreview } from './PixelAvatarPreview.tsx';
import { ItemThumbnail } from './ItemThumbnail.tsx';
import { soundFX } from '../utils/sound.ts';
import { useViewport } from '../utils/useViewport.ts';

interface ShopModalProps {
  moedas: number;
  gemas: number;
  avatar: AvatarConfig;
  onClose: () => void;
  onBuyItem: (itemId: string, payWith: 'moedas' | 'gemas') => void;
  onBuyGems: (packId: string) => void;
  onExchangeGems: (gems: number) => void;
}

type CatalogTab = 'rustica' | 'neon' | 'roupas' | 'gemas';

function formatCountdown(expiresAt: number, now: number): string {
  const diff = expiresAt - now;
  if (diff <= 0) return 'Expirada';
  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days >= 1) {
    return hours > 0 ? `${days}d ${hours}h` : `${days} dias`;
  }
  const mins = Math.max(1, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
  return `${hours}h ${mins}m`;
}

const RARITY_STYLES: Record<Rarity, string> = {
  comum: 'bg-slate-800/80 text-slate-300 border-slate-600/60',
  incomum: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50',
  raro: 'bg-sky-950/80 text-sky-300 border-sky-400/60',
  epico: 'bg-purple-950/80 text-fuchsia-300 border-fuchsia-400/60',
};

export const ShopModal: React.FC<ShopModalProps> = ({
  moedas,
  gemas,
  avatar,
  onClose,
  onBuyItem,
  onBuyGems,
  onExchangeGems,
}) => {
  const { isMobile, isCompactHeight } = useViewport();
  const [tab, setTab] = useState<CatalogTab>('rustica');
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<'all' | Rarity>('all');
  const [previewAvatar, setPreviewAvatar] = useState<AvatarConfig>(avatar);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATALOG_ITEMS.filter((i) => {
      if (tab === 'rustica') {
        if (i.category !== 'movel' || i.themeCollection !== 'rustica') return false;
      } else if (tab === 'neon') {
        if (i.category !== 'movel' || i.themeCollection !== 'neon') return false;
      } else if (tab === 'roupas') {
        if (i.category === 'movel' || i.priceCoins <= 0) return false;
      } else {
        return false;
      }
      if (rarityFilter !== 'all' && i.rarity !== rarityFilter) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tab, search, rarityFilter]);

  const tryOn = (itemId: string) => {
    const item = CATALOG_ITEMS.find((i) => i.id === itemId);
    if (!item || item.category === 'movel') return;
    soundFX.playClick();
    setPreviewAvatar((prev) => ({
      ...prev,
      shirtId: item.category === 'roupa_cima' ? item.id : prev.shirtId,
      pantsId: item.category === 'roupa_baixo' ? item.id : prev.pantsId,
      shoesId: item.category === 'calcado' ? item.id : prev.shoesId,
      accessoryId: item.category === 'acessorio' ? item.id : prev.accessoryId,
    }));
  };

  const activeSeason =
    tab === 'rustica'
      ? SEASON_COLLECTIONS.rustica
      : tab === 'neon'
      ? SEASON_COLLECTIONS.neon
      : null;

  const isSeasonExpired = activeSeason ? now > activeSeason.expiresAt : false;
  const compactPreview = isMobile || isCompactHeight;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="oasis-panel w-full max-w-6xl rounded-2xl overflow-hidden flex flex-col max-h-[94dvh]">
        {/* Header */}
        <div className="px-3.5 sm:px-5 py-3 bg-[#121a3a]/90 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/55 flex items-center justify-center text-amber-300 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-pixel text-xs sm:text-base text-white tracking-wide truncate">
                CATÁLOGO OASIS
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                Coleções temáticas por tempo limitado — quando expiram, viram raridades para troca!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#090e21] border border-amber-500/40">
              <span className="flex items-center gap-1 text-amber-300 font-mono-nums text-[11px] sm:text-xs font-bold whitespace-nowrap">
                <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {moedas.toLocaleString('pt-BR')}
                <span className="hidden sm:inline">moedas</span>
              </span>
              <span className="text-amber-500/35">·</span>
              <span className="flex items-center gap-1 text-purple-300 font-mono-nums text-[11px] sm:text-xs font-bold whitespace-nowrap">
                <Gem className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {gemas.toLocaleString('pt-BR')}
                <span className="hidden sm:inline">gemas</span>
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-[#18224a] hover:bg-[#223066] border border-amber-500/35 text-slate-200 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-3.5 sm:px-5 pt-2.5 pb-2.5 bg-[#0e1530] border-b border-[#242e5c] flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setTab('rustica');
              setSearch('');
              setRarityFilter('all');
            }}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer border transition-all whitespace-nowrap shrink-0 ${
              tab === 'rustica'
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                : 'bg-[#172045] text-slate-200 border-[#2d396e] hover:text-white'
            }`}
          >
            <Trees className="w-4 h-4" />
            <span>Temática Rústica</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-nums ${
                tab === 'rustica'
                  ? 'bg-slate-950/15 text-slate-950'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {formatCountdown(SEASON_COLLECTIONS.rustica.expiresAt, now)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setTab('neon');
              setSearch('');
              setRarityFilter('all');
            }}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer border transition-all whitespace-nowrap shrink-0 ${
              tab === 'neon'
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                : 'bg-[#172045] text-slate-200 border-[#2d396e] hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Temática Neon</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-nums ${
                tab === 'neon'
                  ? 'bg-slate-950/15 text-slate-950'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {formatCountdown(SEASON_COLLECTIONS.neon.expiresAt, now)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setTab('roupas');
              setSearch('');
              setRarityFilter('all');
            }}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border transition-all whitespace-nowrap shrink-0 ${
              tab === 'roupas'
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                : 'bg-[#172045] text-slate-200 border-[#2d396e] hover:text-white'
            }`}
          >
            <Shirt className="w-4 h-4" />
            <span>Roupas & Estilo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setTab('gemas');
            }}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border transition-all whitespace-nowrap shrink-0 ${
              tab === 'gemas'
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                : 'bg-[#172045] text-slate-200 border-[#2d396e] hover:text-white'
            }`}
          >
            <Gem className="w-4 h-4" />
            <span>Gemas & Câmbio</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5">
          {tab === 'gemas' ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-gradient-to-r from-[#2e1065] to-[#1e1b4b] border border-amber-400/45 p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-pixel text-sm text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Trocar Gemas por Moedas</span>
                  </div>
                  <p className="text-xs text-purple-100 mt-1">
                    Cada 1 gema vale 25 moedas na economia de OASIS (você também pode farmar moedas de graça nos minigames!).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[5, 15, 30].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        soundFX.playCoin();
                        onExchangeGems(amt);
                      }}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold font-mono-nums cursor-pointer"
                    >
                      {amt} Gemas → {amt * 25} Moedas
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {GEM_PACKAGES.map((pack) => (
                  <div
                    key={pack.id}
                    className="rounded-xl bg-[#090e21] border-2 border-purple-500/45 p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-purple-300 uppercase">
                        {pack.label}
                      </div>
                      <div className="font-pixel text-2xl text-white mt-2 flex items-center gap-2">
                        <Gem className="w-6 h-6 text-purple-400" />
                        <span>{pack.gems + pack.bonus}</span>
                      </div>
                      {pack.bonus > 0 ? (
                        <div className="text-xs text-emerald-400 font-semibold mt-1">
                          Inclui +{pack.bonus} gemas bônus
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 mt-1">Pacote inicial</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundFX.playQuest();
                        onBuyGems(pack.id);
                      }}
                      className="w-full min-h-[42px] py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Adquirir · {pack.priceBrl} (Demo)
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {activeSeason && (
                <div
                  className={`rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-2.5 ${
                    tab === 'rustica'
                      ? 'bg-gradient-to-r from-[#2c1a0f] to-[#1a1326] border-amber-500/45'
                      : 'bg-gradient-to-r from-[#290b3d] to-[#0f1738] border-fuchsia-500/55'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-pixel text-xs sm:text-sm text-white">
                        {activeSeason.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-black/40 border border-white/15 text-[11px] font-bold text-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {isSeasonExpired
                          ? 'Coleção encerrada'
                          : `Expira em ${formatCountdown(activeSeason.expiresAt, now)}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{activeSeason.subtitle}</p>
                  </div>
                  <div className="text-[11px] text-slate-300 font-semibold">
                    {items.length} móveis disponíveis nesta coleção
                  </div>
                </div>
              )}

              {/* Search & Rarity Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#090e21] border border-[#283260] flex-1 min-w-[180px] max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar móvel ou item..."
                    className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {(['all', 'comum', 'incomum', 'raro', 'epico'] as const).map((rar) => (
                    <button
                      key={rar}
                      type="button"
                      onClick={() => setRarityFilter(rar)}
                      className={`min-h-[34px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold capitalize cursor-pointer border whitespace-nowrap shrink-0 ${
                        rarityFilter === rar
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-[#171d3a] text-slate-300 border-[#283260] hover:text-white'
                      }`}
                    >
                      {rar === 'all' ? 'Todas raridades' : rar}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {tab === 'roupas' && (
                  <div className="lg:col-span-4 rounded-xl bg-[#090e21] border border-amber-500/35 p-3.5 flex flex-col items-center justify-center self-start w-full">
                    <div className="text-[11px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Provador de Estilo
                    </div>
                    <PixelAvatarPreview
                      avatar={previewAvatar}
                      scale={compactPreview ? 3 : 4}
                      width={compactPreview ? 124 : 156}
                      height={compactPreview ? 156 : 200}
                      pedestal
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewAvatar(avatar)}
                      className="mt-1.5 px-3 py-1.5 rounded-lg bg-[#162044] text-xs text-slate-200 hover:text-white cursor-pointer"
                    >
                      Resetar provador
                    </button>
                  </div>
                )}

                <div
                  className={`${
                    tab === 'roupas'
                      ? 'lg:col-span-8 grid-cols-1 sm:grid-cols-2'
                      : 'lg:col-span-12 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                  } grid gap-3`}
                >
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-[#090e21] border border-[#263162] hover:border-amber-400/55 transition-colors p-3 flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <ItemThumbnail
                          item={item}
                          className={item.spriteUrl ? 'w-14 h-14 sm:w-16 sm:h-16' : 'w-11 h-11'}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-2">
                            {item.name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-bold capitalize ${
                                RARITY_STYLES[item.rarity]
                              }`}
                            >
                              {item.rarity}
                            </span>
                            {item.themeCollection && (
                              <span className="text-[10px] text-slate-400">Negociável</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        {tab === 'roupas' && (
                          <button
                            type="button"
                            onClick={() => tryOn(item.id)}
                            className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1a2042] hover:bg-[#252e5e] text-xs font-semibold text-slate-200 cursor-pointer"
                          >
                            Provar
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isSeasonExpired}
                          onClick={() => {
                            soundFX.playCoin();
                            onBuyItem(item.id, 'moedas');
                          }}
                          className="flex-1 min-h-[38px] py-1.5 px-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-45 text-slate-950 text-xs font-bold font-mono-nums cursor-pointer"
                        >
                          {isSeasonExpired ? 'Expirado' : `${item.priceCoins} moedas`}
                        </button>
                        {item.priceGems && !isSeasonExpired && (
                          <button
                            type="button"
                            onClick={() => {
                              soundFX.playCoin();
                              onBuyItem(item.id, 'gemas');
                            }}
                            className="min-h-[38px] py-1.5 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold font-mono-nums cursor-pointer"
                          >
                            {item.priceGems} gemas
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Gold diamond footer divider */}
        <div className="px-5 py-1.5 bg-[#090e21] border-t border-amber-500/25 flex items-center justify-center gap-3 shrink-0">
          <span className="h-[1px] flex-1 bg-amber-500/30" />
          <span className="w-2 h-2 rotate-45 bg-amber-400 inline-block" />
          <span className="h-[1px] flex-1 bg-amber-500/30" />
        </div>
      </div>
    </div>
  );
};
