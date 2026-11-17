import React, { useState } from 'react';
import { Armchair, Check, Shirt, Tag, X } from 'lucide-react';
import { getCatalogItem } from '../shared/catalog.ts';
import type { AvatarConfig, InventoryItem, ItemCategory } from '../shared/types.ts';
import { PixelAvatarPreview } from './PixelAvatarPreview.tsx';
import { ItemThumbnail } from './ItemThumbnail.tsx';
import { soundFX } from '../utils/sound.ts';
import { useViewport } from '../utils/useViewport.ts';

interface InventoryModalProps {
  avatar: AvatarConfig;
  inventory: InventoryItem[];
  onClose: () => void;
  onEquip: (category: ItemCategory, itemId: string | null) => void;
  onListOnMarket: (instanceId: string, priceCoins: number) => void;
  onGoToSpace: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  avatar,
  inventory,
  onClose,
  onEquip,
  onListOnMarket,
  onGoToSpace,
}) => {
  const { isMobile, isCompactHeight } = useViewport();
  const [tab, setTab] = useState<'roupas' | 'moveis'>('roupas');
  const [listingItem, setListingItem] = useState<InventoryItem | null>(null);
  const [sellPrice, setSellPrice] = useState(120);

  const isEquipped = (itemId: string, category: ItemCategory) => {
    if (category === 'roupa_cima') return avatar.shirtId === itemId;
    if (category === 'roupa_baixo') return avatar.pantsId === itemId;
    if (category === 'calcado') return avatar.shoesId === itemId;
    if (category === 'acessorio') return avatar.accessoryId === itemId;
    return false;
  };

  const filtered = inventory.filter((inv) => {
    const cat = getCatalogItem(inv.itemId);
    if (!cat) return false;
    return tab === 'moveis' ? cat.category === 'movel' : cat.category !== 'movel';
  });

  const compactPreview = isMobile || isCompactHeight;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="oasis-panel w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col max-h-[94dvh]">
        {/* Header */}
        <div className="px-3.5 sm:px-5 py-3 bg-[#121a3a]/90 border-b border-amber-500/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0">
              <Shirt className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-pixel text-xs sm:text-base text-white tracking-wide truncate">
                INVENTÁRIO E GUARDA-ROUPA
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                Equipe roupas em tempo real, decore seu espaço ou anuncie itens no Bazar.
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Avatar Live Wardrobe Preview */}
          <div className="md:col-span-4 rounded-xl bg-[#090e21] border border-amber-500/35 p-3.5 flex flex-col items-center justify-between gap-2">
            <div className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">
              Visual Equipado
            </div>
            <PixelAvatarPreview
              avatar={avatar}
              scale={compactPreview ? 3 : 4}
              width={compactPreview ? 124 : 156}
              height={compactPreview ? 156 : 200}
              pedestal
            />
            <div className="w-full flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  onEquip('roupa_cima', 'shirt_sem');
                }}
                className="w-full min-h-[38px] py-2 px-3 rounded-xl bg-[#172045] hover:bg-[#223066] border border-[#2f3d78] text-xs font-semibold text-slate-100 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Shirt className="w-3.5 h-3.5 text-slate-300" />
                <span>Tirar Camisa / Top</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  onGoToSpace();
                  onClose();
                }}
                className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 border border-amber-200 text-xs font-bold text-slate-950 shadow-[0_2px_0_#92400e] cursor-pointer"
              >
                Ir para Nosso Espaço (Mobiliar)
              </button>
            </div>
          </div>

          {/* Items Grid */}
          <div className="md:col-span-8 flex flex-col gap-3.5">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setTab('roupas');
                }}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border transition-all ${
                  tab === 'roupas'
                    ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                    : 'bg-[#172045] text-slate-200 border-[#2d396e] hover:text-white'
                }`}
              >
                <Shirt className="w-4 h-4" />
                <span>Roupas & Acessórios</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setTab('moveis');
                }}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border transition-all ${
                  tab === 'moveis'
                    ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-[0_2px_0_#92400e]'
                    : 'bg-[#172045] text-slate-200 border-[#2d396e] hover:text-white'
                }`}
              >
                <Armchair className="w-4 h-4" />
                <span>Móveis & Decoração</span>
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl bg-[#090e21] border border-[#242c52] p-8 text-center text-sm text-slate-400">
                Nenhum item nesta categoria ainda. Visite o Catálogo ou o Bazar para adquirir!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map((inv) => {
                  const cat = getCatalogItem(inv.itemId);
                  if (!cat) return null;
                  const equipped = isEquipped(cat.id, cat.category);
                  return (
                    <div
                      key={inv.instanceId}
                      className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 ${
                        equipped
                          ? 'bg-emerald-950/35 border-emerald-400/70'
                          : 'bg-[#090e21] border-[#263162]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <ItemThumbnail
                          item={cat}
                          className={cat.spriteUrl ? 'w-12 h-12' : 'w-10 h-10'}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-white truncate">
                            {cat.name}
                          </div>
                          <div className="text-[11px] text-slate-400 capitalize">
                            {cat.rarity} · {cat.category.replace('_', ' ')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {cat.category !== 'movel' ? (
                          <button
                            type="button"
                            onClick={() => {
                              soundFX.playClick();
                              onEquip(
                                cat.category,
                                equipped
                                  ? cat.category === 'roupa_cima'
                                    ? 'shirt_sem'
                                    : null
                                  : cat.id
                              );
                            }}
                            className={`flex-1 min-h-[38px] py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                              equipped
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-[#1c244d] hover:bg-[#27326b] text-white'
                            }`}
                          >
                            {equipped && <Check className="w-3.5 h-3.5" />}
                            <span>{equipped ? 'Equipado' : 'Equipar'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              soundFX.playClick();
                              onGoToSpace();
                              onClose();
                            }}
                            className="flex-1 min-h-[38px] py-1.5 px-3 rounded-lg text-xs font-bold bg-[#1c244d] hover:bg-[#27326b] text-amber-300 cursor-pointer"
                          >
                            Colocar no Espaço
                          </button>
                        )}

                        {cat.tradeable && (
                          <button
                            type="button"
                            onClick={() => {
                              setListingItem(inv);
                              setSellPrice(Math.max(20, Math.round(cat.priceCoins * 0.9)));
                            }}
                            className="min-h-[38px] py-1.5 px-3 rounded-lg text-xs font-bold bg-[#162044] hover:bg-[#202f63] border border-[#2e3e7a] text-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Tag className="w-3 h-3 text-amber-300" />
                            <span>Vender</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick List Item Sub-Dialog */}
            {listingItem && (
              <div className="rounded-xl bg-[#151e42] border-2 border-amber-400 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">
                    Anunciar {getCatalogItem(listingItem.itemId)?.name} no Bazar
                  </div>
                  <div className="text-xs text-slate-300">
                    Outros jogadores poderão comprar com moedas.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={99999}
                    value={sellPrice}
                    onChange={(e) => setSellPrice(Number(e.target.value))}
                    className="w-24 px-2.5 py-2 rounded-lg bg-[#090e21] border border-amber-400/70 text-amber-300 font-mono-nums text-sm font-bold"
                  />
                  <span className="text-xs text-amber-300 font-semibold">moedas</span>
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playCoin();
                      onListOnMarket(listingItem.instanceId, sellPrice);
                      setListingItem(null);
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Publicar
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingItem(null)}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-700 text-xs text-slate-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
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
