import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Coins,
  Lock,
  LockOpen,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { getCatalogItem } from '../shared/catalog.ts';
import { LIVE_TRADE_MAX_SLOTS } from '../shared/types.ts';
import type { InventoryItem, LiveTradeSession } from '../shared/types.ts';
import { ItemThumbnail } from './ItemThumbnail.tsx';
import { soundFX } from '../utils/sound.ts';

interface LiveTradeModalProps {
  session: LiveTradeSession;
  myPlayerId: string;
  myMoedas: number;
  myInventory: InventoryItem[];
  onAcceptInvite: (sessionId: string) => void;
  onToggleItem: (sessionId: string, instanceId: string) => void;
  onSetCoins: (sessionId: string, coins: number) => void;
  onToggleLock: (sessionId: string) => void;
  onConfirm: (sessionId: string) => void;
  onCancel: (sessionId: string) => void;
  onCloseFinished: () => void;
}

export const LiveTradeModal: React.FC<LiveTradeModalProps> = ({
  session,
  myPlayerId,
  myMoedas,
  myInventory,
  onAcceptInvite,
  onToggleItem,
  onSetCoins,
  onToggleLock,
  onConfirm,
  onCancel,
  onCloseFinished,
}) => {
  const isSideA = session.a.playerId === myPlayerId;
  const mySide = isSideA ? session.a : session.b;
  const partnerSide = isSideA ? session.b : session.a;

  const [coinDraft, setCoinDraft] = useState<string>(String(mySide.coins));
  const [filter, setFilter] = useState<'todos' | 'roupas' | 'moveis'>('todos');

  useEffect(() => {
    setCoinDraft(String(mySide.coins));
  }, [mySide.coins]);

  const tradeableInventory = myInventory.filter((inv) => {
    const cat = getCatalogItem(inv.itemId);
    if (!cat || !cat.tradeable) return false;
    if (filter === 'moveis') return cat.category === 'movel';
    if (filter === 'roupas') return cat.category !== 'movel';
    return true;
  });

  const bothLocked = mySide.locked && partnerSide.locked;

  const renderSlotsGrid = (
    slots: typeof mySide.slots,
    interactive: boolean,
    accent: 'amber' | 'sky'
  ) => {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: LIVE_TRADE_MAX_SLOTS }).map((_, idx) => {
          const slot = slots[idx];
          const cat = slot ? getCatalogItem(slot.itemId) : null;
          if (!slot || !cat) {
            return (
              <div
                key={`empty_${idx}`}
                className="h-18 sm:h-20 rounded-xl border-2 border-dashed border-[#2b3568] bg-[#090e21]/70 flex flex-col items-center justify-center text-[10px] text-slate-500"
              >
                <span>Slot {idx + 1}</span>
              </div>
            );
          }
          return (
            <button
              key={slot.instanceId}
              type="button"
              disabled={!interactive}
              onClick={() => {
                if (!interactive) return;
                soundFX.playClick();
                onToggleItem(session.sessionId, slot.instanceId);
              }}
              title={interactive ? 'Clique para remover da mesa' : cat.name}
              className={`h-18 sm:h-20 rounded-xl border-2 p-2 flex flex-col items-center justify-center gap-1 text-center transition-all ${
                accent === 'amber'
                  ? 'border-amber-400/70 bg-[#182042] hover:border-rose-400 cursor-pointer'
                  : 'border-sky-400/60 bg-[#151d3b] cursor-default'
              }`}
            >
              <ItemThumbnail item={cat} className="w-8 h-8 sm:w-9 sm:h-9" />
              <span className="text-[10px] font-bold text-white leading-tight line-clamp-2">
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="oasis-panel w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col max-h-[94dvh]">
        {/* Header */}
        <div className="px-3.5 sm:px-5 py-3 bg-[#121a3a]/90 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/60 flex items-center justify-center text-amber-300 shrink-0">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-pixel text-xs sm:text-base text-white truncate">
                  MESA DE TROCA AO VIVO
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    session.status === 'negociando'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : session.status === 'convite'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : session.status === 'concluida'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {session.status === 'negociando'
                    ? 'Sincronizado'
                    : session.status === 'convite'
                    ? 'Aguardando Aceite'
                    : session.status === 'concluida'
                    ? 'Concluída'
                    : 'Encerrada'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                Negociando com <strong className="text-sky-300">{partnerSide.playerName}</strong> ·
                Máx. {LIVE_TRADE_MAX_SLOTS} itens por lado
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (session.status === 'concluida' || session.status === 'cancelada') {
                onCloseFinished();
              } else {
                onCancel(session.sessionId);
              }
            }}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#1d2547] hover:bg-rose-600/80 border border-amber-500/35 text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span>
              {session.status === 'concluida' || session.status === 'cancelada'
                ? 'Fechar'
                : 'Cancelar'}
            </span>
          </button>
        </div>

        {/* Invite State */}
        {session.status === 'convite' && (
          <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-300">
              <Sparkles className="w-7 h-7" />
            </div>
            {isSideA ? (
              <>
                <h3 className="text-base font-bold text-white">
                  Convite enviado para {partnerSide.playerName}!
                </h3>
                <p className="text-xs text-slate-300 max-w-md">
                  Assim que {partnerSide.playerName} aceitar a mesa de troca, os dois inventários de 6
                  lugares abrirão em tempo real para vocês mostrarem itens e moedas.
                </p>
                <button
                  type="button"
                  onClick={() => onCancel(session.sessionId)}
                  className="min-h-[42px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                >
                  Cancelar Convite
                </button>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-white">
                  {partnerSide.playerName} convidou você para uma Troca ao Vivo!
                </h3>
                <p className="text-xs text-slate-300 max-w-md">
                  Mostre até {LIVE_TRADE_MAX_SLOTS} roupas ou móveis e combine moedas em segurança
                  antes de confirmar.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      onAcceptInvite(session.sessionId);
                    }}
                    className="min-h-[42px] px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Aceitar Mesa de Troca</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancel(session.sessionId)}
                    className="min-h-[42px] px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Recusar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Finished / Cancelled */}
        {(session.status === 'concluida' || session.status === 'cancelada') && (
          <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-4 overflow-y-auto">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 ${
                session.status === 'concluida'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-rose-500/20 border-rose-400 text-rose-300'
              }`}
            >
              {session.status === 'concluida' ? (
                <CheckCircle2 className="w-8 h-8" />
              ) : (
                <X className="w-8 h-8" />
              )}
            </div>
            <h3 className="text-base font-bold text-white">
              {session.status === 'concluida'
                ? 'Troca concluída com sucesso!'
                : 'Mesa de troca encerrada.'}
            </h3>
            <p className="text-xs text-slate-300 max-w-md">
              {session.status === 'concluida'
                ? 'Todos os itens e moedas acordados foram transferidos instantaneamente para os inventários.'
                : 'Nenhum item ou moeda foi transferido nesta sessão.'}
            </p>
            <button
              type="button"
              onClick={onCloseFinished}
              className="min-h-[42px] px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Voltar à Cidade
            </button>
          </div>
        )}

        {/* Active Live Two-Sided Trade Table */}
        {session.status === 'negociando' && (
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 flex flex-col gap-3.5">
            <div className="rounded-xl bg-[#090e21] border border-emerald-500/35 px-3.5 py-2 flex items-center gap-2 text-[11px] text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Proteção anti-golpe:</strong> sempre que alguém altera itens ou moedas, as
                travas são reiniciadas. Só é possível confirmar quando os dois travarem a oferta.
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {/* LEFT: MY OFFER */}
              <div
                className={`rounded-xl border-2 p-3 sm:p-3.5 flex flex-col gap-3 ${
                  mySide.confirmed
                    ? 'bg-emerald-950/25 border-emerald-400'
                    : mySide.locked
                    ? 'bg-[#141c3b] border-amber-400'
                    : 'bg-[#090e21] border-[#2d386d]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-amber-300">
                    Sua Oferta ({mySide.slots.length}/{LIVE_TRADE_MAX_SLOTS} slots)
                  </div>
                  <div className="flex items-center gap-1.5">
                    {mySide.locked ? (
                      <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-[10px] font-bold text-amber-200 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Travada
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                        <LockOpen className="w-3 h-3" /> Editando
                      </span>
                    )}
                    {mySide.confirmed && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400 text-[10px] font-bold text-emerald-200">
                        Confirmado
                      </span>
                    )}
                  </div>
                </div>

                {renderSlotsGrid(mySide.slots, true, 'amber')}

                {/* Coins + Lock/Confirm Controls */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#242c52]">
                  <div className="flex items-center gap-1.5 bg-[#151c3a] border border-[#303c75] rounded-lg px-2.5 py-2">
                    <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                    <input
                      type="number"
                      min={0}
                      max={myMoedas}
                      value={coinDraft}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCoinDraft(raw);
                        const num = Math.max(0, Math.min(myMoedas, Math.floor(Number(raw) || 0)));
                        onSetCoins(session.sessionId, num);
                      }}
                      className="w-20 bg-transparent text-xs font-mono-nums font-bold text-amber-300 focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-400">moedas</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      onToggleLock(session.sessionId);
                    }}
                    className={`min-h-[38px] px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      mySide.locked
                        ? 'bg-slate-700 hover:bg-slate-600 text-white'
                        : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                    }`}
                  >
                    {mySide.locked ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>{mySide.locked ? 'Destravar' : 'Travar Oferta'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!bothLocked || mySide.confirmed}
                    onClick={() => {
                      soundFX.playQuest();
                      onConfirm(session.sessionId);
                    }}
                    className="ml-auto min-h-[38px] px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{mySide.confirmed ? 'Aguardando...' : 'Confirmar Troca'}</span>
                  </button>
                </div>
              </div>

              {/* RIGHT: PARTNER OFFER */}
              <div
                className={`rounded-xl border-2 p-3 sm:p-3.5 flex flex-col gap-3 ${
                  partnerSide.confirmed
                    ? 'bg-emerald-950/25 border-emerald-400'
                    : partnerSide.locked
                    ? 'bg-[#141c3b] border-sky-400'
                    : 'bg-[#090e21] border-[#2d386d]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-sky-300">
                    Oferta de {partnerSide.playerName} ({partnerSide.slots.length}/
                    {LIVE_TRADE_MAX_SLOTS} slots)
                  </div>
                  <div className="flex items-center gap-1.5">
                    {partnerSide.locked ? (
                      <span className="px-2 py-0.5 rounded bg-sky-400/20 border border-sky-400/50 text-[10px] font-bold text-sky-200 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Travada
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-400">
                        Escolhendo...
                      </span>
                    )}
                    {partnerSide.confirmed && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400 text-[10px] font-bold text-emerald-200">
                        Confirmado
                      </span>
                    )}
                  </div>
                </div>

                {renderSlotsGrid(partnerSide.slots, false, 'sky')}

                <div className="flex items-center justify-between pt-2 border-t border-[#242c52] text-xs">
                  <span className="text-slate-300 font-semibold">Moedas oferecidas:</span>
                  <span className="flex items-center gap-1.5 font-mono-nums font-bold text-amber-300 px-3 py-1 rounded-lg bg-[#151c3a] border border-[#2d386d]">
                    <Coins className="w-3.5 h-3.5" />
                    {partnerSide.coins.toLocaleString('pt-BR')} moedas
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Inventory Picker */}
            <div className="rounded-xl bg-[#090e21] border border-amber-500/35 p-3.5 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-white">
                  Seu Inventário Negociável (toque para mostrar/retirar da mesa)
                </div>
                <div className="flex items-center gap-1.5">
                  {(['todos', 'roupas', 'moveis'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                        filter === f
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-[#171f40] text-slate-300 hover:text-white'
                      }`}
                    >
                      {f === 'todos' ? 'Todos' : f === 'roupas' ? 'Roupas' : 'Móveis'}
                    </button>
                  ))}
                </div>
              </div>

              {tradeableInventory.length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center">
                  Nenhum item negociável encontrado nesta categoria.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-36 overflow-y-auto pr-1">
                  {tradeableInventory.map((inv) => {
                    const cat = getCatalogItem(inv.itemId);
                    if (!cat) return null;
                    const inSlot = mySide.slots.some((s) => s.instanceId === inv.instanceId);
                    return (
                      <button
                        key={inv.instanceId}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          onToggleItem(session.sessionId, inv.instanceId);
                        }}
                        className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                          inSlot
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-[#141a35] border-[#263060] text-slate-200 hover:border-amber-400/60'
                        }`}
                      >
                        <ItemThumbnail item={cat} className="w-7 h-7" />
                        <span className="text-[11px] font-semibold truncate">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

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
