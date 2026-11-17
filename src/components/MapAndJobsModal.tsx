import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Coffee,
  Coins,
  Disc3,
  Map as MapIcon,
  Package,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { ROOMS_META } from '../shared/catalog.ts';
import type { DailyQuest, RoomId } from '../shared/types.ts';
import { soundFX } from '../utils/sound.ts';

interface MapAndJobsModalProps {
  initialTab?: 'mapa' | 'trabalhos' | 'missoes';
  myPlayerId: string;
  currentRoomKey: string;
  roomCounts: Record<string, number>;
  quests: DailyQuest[];
  stepsWalked: number;
  onClose: () => void;
  onSelectRoom: (roomKey: string) => void;
  onCompleteMinigame: (rewardCoins: number, jobName: string) => void;
  onClaimQuest: (questId: string) => void;
}

type ActiveGame = null | 'barista' | 'entregas' | 'dj';

const COFFEE_ITEMS = [
  { id: 'espresso', label: 'Espresso', color: '#78350f' },
  { id: 'latte', label: 'Latte', color: '#d97706' },
  { id: 'mocha', label: 'Mocha', color: '#451a03' },
  { id: 'matcha', label: 'Matcha', color: '#16a34a' },
];

const CRATE_TYPES = [
  { id: 'frutas', label: 'Frutas', color: '#ef4444' },
  { id: 'padaria', label: 'Pães', color: '#f59e0b' },
  { id: 'flores', label: 'Flores', color: '#ec4899' },
];

const DJ_LANES = [
  { id: 0, label: 'GRAVE', color: '#8b5cf6' },
  { id: 1, label: 'SYNTH', color: '#ec4899' },
  { id: 2, label: 'BASS', color: '#06b6d4' },
  { id: 3, label: 'DROP', color: '#fbbf24' },
];

export const MapAndJobsModal: React.FC<MapAndJobsModalProps> = ({
  initialTab = 'mapa',
  myPlayerId,
  currentRoomKey,
  roomCounts,
  quests,
  stepsWalked,
  onClose,
  onSelectRoom,
  onCompleteMinigame,
  onClaimQuest,
}) => {
  const [tab, setTab] = useState<'mapa' | 'trabalhos' | 'missoes'>(initialTab);
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);

  // Barista Minigame State
  const [baristaOrder, setBaristaOrder] = useState<string[]>([]);
  const [baristaInput, setBaristaInput] = useState<string[]>([]);
  const [baristaScore, setBaristaScore] = useState(0);
  const [baristaRound, setBaristaRound] = useState(1);

  // Entregas Minigame State
  const [currentCrate, setCurrentCrate] = useState(CRATE_TYPES[0]);
  const [crateCount, setCrateCount] = useState(0);
  const [crateScore, setCrateScore] = useState(0);

  // DJ Minigame State
  const [activeLane, setActiveLane] = useState(0);
  const [djBeatCount, setDjBeatCount] = useState(0);
  const [djScore, setDjScore] = useState(0);

  const startBarista = () => {
    const newOrder = Array.from({ length: 3 }, () => COFFEE_ITEMS[Math.floor(Math.random() * 4)].id);
    setBaristaOrder(newOrder);
    setBaristaInput([]);
    setBaristaScore(0);
    setBaristaRound(1);
    setActiveGame('barista');
  };

  const handleBaristaPick = (id: string) => {
    const nextIdx = baristaInput.length;
    if (id === baristaOrder[nextIdx]) {
      soundFX.playHit();
      const updated = [...baristaInput, id];
      setBaristaInput(updated);
      if (updated.length === baristaOrder.length) {
        const nextScore = baristaScore + 8;
        if (baristaRound >= 3) {
          soundFX.playQuest();
          onCompleteMinigame(14 + nextScore, 'Barista da Cafeteria');
          setActiveGame(null);
        } else {
          setBaristaScore(nextScore);
          setBaristaRound((r) => r + 1);
          setBaristaInput([]);
          setBaristaOrder(
            Array.from({ length: 3 + baristaRound }, () => COFFEE_ITEMS[Math.floor(Math.random() * 4)].id)
          );
        }
      }
    } else {
      soundFX.playMiss();
      setBaristaInput([]);
    }
  };

  const startEntregas = () => {
    setCrateCount(0);
    setCrateScore(0);
    setCurrentCrate(CRATE_TYPES[Math.floor(Math.random() * CRATE_TYPES.length)]);
    setActiveGame('entregas');
  };

  const handleCrateSort = (laneId: string) => {
    const correct = laneId === currentCrate.id;
    if (correct) soundFX.playHit();
    else soundFX.playMiss();

    const newScore = crateScore + (correct ? 3 : 0);
    const nextCount = crateCount + 1;
    if (nextCount >= 8) {
      soundFX.playQuest();
      onCompleteMinigame(12 + newScore, 'Entregador do Mercado');
      setActiveGame(null);
    } else {
      setCrateScore(newScore);
      setCrateCount(nextCount);
      setCurrentCrate(CRATE_TYPES[Math.floor(Math.random() * CRATE_TYPES.length)]);
    }
  };

  const startDj = () => {
    setDjBeatCount(0);
    setDjScore(0);
    setActiveLane(Math.floor(Math.random() * 4));
    setActiveGame('dj');
  };

  useEffect(() => {
    if (activeGame !== 'dj') return;
    const id = setInterval(() => {
      setActiveLane(Math.floor(Math.random() * 4));
    }, 850);
    return () => clearInterval(id);
  }, [activeGame]);

  const handleDjTap = (lane: number) => {
    const hit = lane === activeLane;
    if (hit) soundFX.playHit();
    else soundFX.playMiss();

    const nextScore = djScore + (hit ? 4 : 0);
    const nextBeats = djBeatCount + 1;
    if (nextBeats >= 8) {
      soundFX.playQuest();
      onCompleteMinigame(15 + nextScore, 'DJ da Balada Neon');
      setActiveGame(null);
    } else {
      setDjScore(nextScore);
      setDjBeatCount(nextBeats);
      setActiveLane(Math.floor(Math.random() * 4));
    }
  };

  const roomsList: RoomId[] = ['praca', 'balada', 'cafeteria', 'mercado', 'espaco'];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="oasis-panel w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col max-h-[94dvh]">
        {/* Header */}
        <div className="px-3.5 sm:px-5 py-3 bg-[#121a3a]/90 border-b border-amber-500/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-pixel text-xs sm:text-base text-white tracking-wide truncate">
                MAPA, TRABALHOS E MISSÕES
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                Explore o Oasis, ganhe moedas trabalhando nos minigames ou resgate missões diárias.
              </p>
            </div>
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

        {/* Navigation Tabs (Single-line horizontally scrollable on narrow phones) */}
        <div className="px-3.5 sm:px-5 pt-2.5 pb-2.5 bg-[#0e1530] border-b border-[#242e5c] flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setTab('mapa');
              setActiveGame(null);
            }}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border transition-all ${
              tab === 'mapa'
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                : 'bg-[#172045] text-slate-200 border-[#2d396e] hover:border-amber-400/50'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            <span>Mapa do OASIS</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setTab('trabalhos');
            }}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border transition-all ${
              tab === 'trabalhos'
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                : 'bg-[#172045] text-slate-200 border-[#2d396e] hover:border-amber-400/50'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Trabalhar (Farm F2P)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setTab('missoes');
              setActiveGame(null);
            }}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border transition-all ${
              tab === 'missoes'
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                : 'bg-[#172045] text-slate-200 border-[#2d396e] hover:border-amber-400/50'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Missões Diárias</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5">
          {tab === 'mapa' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {roomsList.map((rId) => {
                const meta = ROOMS_META[rId];
                const targetKey = rId === 'espaco' ? `espaco:${myPlayerId}` : rId;
                const isHere =
                  rId === 'espaco' ? currentRoomKey.startsWith('espaco') : currentRoomKey === rId;
                return (
                  <button
                    key={rId}
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      onSelectRoom(targetKey);
                      onClose();
                    }}
                    className={`rounded-xl border-2 p-4 text-left transition-all cursor-pointer flex flex-col justify-between gap-3 min-h-[112px] ${
                      isHere
                        ? 'bg-[#1b224a] border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.18)]'
                        : 'bg-[#090e21] border-[#263162] hover:border-amber-400/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-pixel text-sm text-white">{meta.name}</span>
                        <span className="font-mono-nums text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-bold shrink-0">
                          {roomCounts[rId] || 0} online
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5">{meta.subtitle}</p>
                    </div>
                    <div className="text-xs font-bold text-amber-300">
                      {isHere ? '✓ Você está aqui' : 'Viajar para este local →'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'trabalhos' && (
            <div className="flex flex-col gap-3.5">
              {activeGame === null ? (
                <>
                  {/* Info strip matching Mockup 2 */}
                  <div className="rounded-xl bg-[#090e21] border border-amber-500/35 px-3.5 py-2.5 text-xs text-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Coins className="w-5 h-5 text-amber-400 shrink-0" />
                      <span>
                        Trabalhe em turnos rápidos para conquistar moedas de forma 100% gratuita e evoluir seu inventário!
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono-nums font-bold text-amber-300 shrink-0">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>15–45 moedas / turno</span>
                    </div>
                  </div>

                  {/* 3 Illustrated Job Cards matching Mockup 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Barista Card */}
                    <div className="rounded-2xl bg-[#090e21] border border-amber-400/60 overflow-hidden flex flex-col justify-between shadow-lg">
                      <div className="h-20 relative bg-gradient-to-br from-[#3b2114] via-[#1f1629] to-[#0f1633] border-b border-amber-500/30 p-3 flex items-center justify-between overflow-hidden">
                        {/* Subtle pixel cafe backdrop */}
                        <div className="w-12 h-12 rounded-xl bg-[#161e3d]/90 border border-amber-400/50 flex items-center justify-center shadow-inner z-10">
                          <Coffee className="w-6 h-6 text-amber-300" />
                        </div>
                        <div className="text-right z-10">
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-950/80 border border-amber-400/50 font-pixel text-[10px] text-amber-200">
                            CAFÉ
                          </span>
                        </div>
                        <div className="absolute right-0 bottom-0 w-24 h-10 bg-amber-500/10 rounded-tl-2xl pointer-events-none" />
                      </div>
                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <div className="font-pixel text-xs sm:text-sm text-white">
                            BARISTA DA CAFETERIA
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            Monte os pedidos de café na ordem exata para os clientes da praça.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={startBarista}
                          className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 border border-amber-200 text-slate-950 text-xs font-bold shadow-[0_2px_0_#92400e] cursor-pointer"
                        >
                          ▶ Iniciar Turno (~25–38 moedas)
                        </button>
                      </div>
                    </div>

                    {/* Entregas Card */}
                    <div className="rounded-2xl bg-[#090e21] border border-emerald-400/60 overflow-hidden flex flex-col justify-between shadow-lg">
                      <div className="h-20 relative bg-gradient-to-br from-[#0f362b] via-[#132638] to-[#0f1633] border-b border-emerald-500/30 p-3 flex items-center justify-between overflow-hidden">
                        <div className="w-12 h-12 rounded-xl bg-[#112735]/90 border border-emerald-400/50 flex items-center justify-center shadow-inner z-10">
                          <Package className="w-6 h-6 text-emerald-300" />
                        </div>
                        <div className="text-right z-10">
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/50 font-pixel text-[10px] text-emerald-200">
                            MERCADO
                          </span>
                        </div>
                        <div className="absolute right-0 bottom-0 w-24 h-10 bg-emerald-500/10 rounded-tl-2xl pointer-events-none" />
                      </div>
                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <div className="font-pixel text-xs sm:text-sm text-white">
                            ENTREGAS DO MERCADO
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            Separe 8 caixas de frutas, pães e flores rapidamente nas esteiras certas.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={startEntregas}
                          className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 border border-emerald-200 text-slate-950 text-xs font-bold shadow-[0_2px_0_#064e3b] cursor-pointer"
                        >
                          ▶ Iniciar Turno (~20–36 moedas)
                        </button>
                      </div>
                    </div>

                    {/* DJ Card */}
                    <div className="rounded-2xl bg-[#090e21] border border-purple-400/60 overflow-hidden flex flex-col justify-between shadow-lg">
                      <div className="h-20 relative bg-gradient-to-br from-[#2d124c] via-[#1c1345] to-[#0d1636] border-b border-purple-500/30 p-3 flex items-center justify-between overflow-hidden">
                        <div className="w-12 h-12 rounded-xl bg-[#1a133d]/90 border border-purple-400/50 flex items-center justify-center shadow-inner z-10">
                          <Disc3 className="w-6 h-6 text-purple-300" />
                        </div>
                        <div className="text-right z-10">
                          <span className="inline-block px-2 py-0.5 rounded bg-purple-950/80 border border-purple-400/50 font-pixel text-[10px] text-fuchsia-200">
                            BALADA
                          </span>
                        </div>
                        <div className="absolute right-0 bottom-0 w-24 h-10 bg-fuchsia-500/10 rounded-tl-2xl pointer-events-none" />
                      </div>
                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <div className="font-pixel text-xs sm:text-sm text-white">
                            DJ DA BALADA NEON
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            Acerte as batidas neon acesas na mesa de som para animar a pista!
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={startDj}
                          className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-gradient-to-b from-purple-500 to-violet-700 hover:from-purple-400 hover:to-violet-600 border border-purple-300 text-white text-xs font-bold shadow-[0_2px_0_#4c1d95] cursor-pointer"
                        >
                          ▶ Iniciar Turno (~25–47 moedas)
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : activeGame === 'barista' ? (
                <div className="rounded-xl bg-[#090e21] border-2 border-amber-400 p-4 sm:p-5 flex flex-col gap-4 items-center">
                  <div className="w-full flex items-center justify-between">
                    <span className="font-pixel text-sm text-amber-300">
                      Pedido {baristaRound}/3
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveGame(null)}
                      className="px-3 py-1.5 rounded-lg bg-[#172045] text-xs text-slate-300 hover:text-white cursor-pointer"
                    >
                      Cancelar turno
                    </button>
                  </div>
                  <div className="text-xs text-slate-300 text-center">
                    Toque nas bebidas na mesma sequência do pedido:
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {baristaOrder.map((ordId, idx) => {
                      const item = COFFEE_ITEMS.find((c) => c.id === ordId);
                      const done = idx < baristaInput.length;
                      return (
                        <div
                          key={`${ordId}_${idx}`}
                          className={`px-3 py-2 rounded-lg border text-xs font-bold ${
                            done
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                              : 'bg-[#171d3b] border-slate-600 text-white'
                          }`}
                        >
                          {idx + 1}. {item?.label}
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg mt-1">
                    {COFFEE_ITEMS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleBaristaPick(c.id)}
                        className="min-h-[52px] py-3 px-3 rounded-xl border-2 border-white/25 text-white text-xs font-bold cursor-pointer active:scale-95 transition-transform"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : activeGame === 'entregas' ? (
                <div className="rounded-xl bg-[#090e21] border-2 border-emerald-400 p-4 sm:p-5 flex flex-col gap-4 items-center">
                  <div className="w-full flex items-center justify-between">
                    <span className="font-pixel text-sm text-emerald-300">
                      Caixa {crateCount + 1}/8 · Pontos: {crateScore}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveGame(null)}
                      className="px-3 py-1.5 rounded-lg bg-[#172045] text-xs text-slate-300 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div
                    className="w-40 h-24 rounded-xl border-4 border-white/30 flex flex-col items-center justify-center shadow-lg"
                    style={{ backgroundColor: currentCrate.color }}
                  >
                    <Package className="w-7 h-7 text-white mb-1" />
                    <span className="font-pixel text-sm text-white">{currentCrate.label}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 w-full max-w-md">
                    {CRATE_TYPES.map((ct) => (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => handleCrateSort(ct.id)}
                        className="min-h-[48px] py-3 px-2 rounded-xl bg-[#182042] hover:bg-[#243063] border border-slate-500 text-white text-xs font-bold cursor-pointer active:scale-95"
                      >
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[#090e21] border-2 border-purple-400 p-4 sm:p-5 flex flex-col gap-4 items-center">
                  <div className="w-full flex items-center justify-between">
                    <span className="font-pixel text-sm text-purple-300">
                      Batida {djBeatCount + 1}/8 · Acertos: {djScore}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveGame(null)}
                      className="px-3 py-1.5 rounded-lg bg-[#172045] text-xs text-slate-300 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="text-xs text-slate-300">
                    Toque no botão neon que está brilhando!
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
                    {DJ_LANES.map((lane) => {
                      const lit = activeLane === lane.id;
                      return (
                        <button
                          key={lane.id}
                          type="button"
                          onClick={() => handleDjTap(lane.id)}
                          className={`min-h-[68px] py-5 rounded-xl border-2 font-pixel text-xs transition-all cursor-pointer active:scale-95 ${
                            lit
                              ? 'scale-105 text-slate-950 border-white shadow-[0_0_20px_rgba(255,255,255,0.6)]'
                              : 'bg-[#151b36] border-slate-700 text-slate-400'
                          }`}
                          style={lit ? { backgroundColor: lane.color } : undefined}
                        >
                          {lane.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'missoes' && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-[#090e21] border border-amber-500/35 p-3.5 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  Passos totais percorridos na cidade hoje:
                </span>
                <span className="font-mono-nums font-bold text-amber-300">
                  {stepsWalked} passos
                </span>
              </div>

              {quests.map((q) => {
                const ready = q.progress >= q.target;
                const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
                return (
                  <div
                    key={q.id}
                    className="rounded-xl bg-[#090e21] border border-[#283160] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{q.title}</span>
                        {q.claimed && (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resgatada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{q.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-[#1a2042] overflow-hidden">
                          <div
                            className="h-full bg-amber-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono-nums text-[11px] text-slate-300">
                          {q.progress}/{q.target}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono-nums text-xs">
                        <div className="text-amber-300 font-bold flex items-center justify-end gap-1">
                          <Coins className="w-3.5 h-3.5" /> +{q.rewardCoins}
                        </div>
                        <div className="text-purple-300 font-bold">+{q.rewardGems} gemas</div>
                      </div>

                      <button
                        type="button"
                        disabled={!ready || q.claimed}
                        onClick={() => {
                          soundFX.playQuest();
                          onClaimQuest(q.id);
                        }}
                        className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
                          q.claimed
                            ? 'bg-slate-800 text-slate-500 cursor-default'
                            : ready
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                            : 'bg-[#1a2042] text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {q.claimed ? 'Concluída' : ready ? 'Resgatar' : 'Em progresso'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gold diamond footer divider matching Mockup 2 */}
        <div className="px-5 py-1.5 bg-[#090e21] border-t border-amber-500/25 flex items-center justify-center gap-3 shrink-0">
          <span className="h-[1px] flex-1 bg-amber-500/30" />
          <span className="w-2 h-2 rotate-45 bg-amber-400 inline-block" />
          <span className="h-[1px] flex-1 bg-amber-500/30" />
        </div>
      </div>
    </div>
  );
};
