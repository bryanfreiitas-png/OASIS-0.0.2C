import React from 'react';
import { Edit, Home, UserPlus, Users, X } from 'lucide-react';
import type { PlayerProfile } from '../shared/types.ts';
import { PixelAvatarPreview } from './PixelAvatarPreview.tsx';
import { soundFX } from '../utils/sound.ts';
import { useViewport } from '../utils/useViewport.ts';

interface FriendsAndProfileModalProps {
  profile: PlayerProfile;
  onlinePlayers: Array<{ id: string; name: string; roomKey: string }>;
  onClose: () => void;
  onAddFriend: (id: string, name: string) => void;
  onVisitSpace: (ownerId: string) => void;
  onEditCharacter: () => void;
}

export const FriendsAndProfileModal: React.FC<FriendsAndProfileModalProps> = ({
  profile,
  onlinePlayers,
  onClose,
  onAddFriend,
  onVisitSpace,
  onEditCharacter,
}) => {
  const { isMobile, isCompactHeight } = useViewport();
  const otherOnline = onlinePlayers.filter((p) => p.id !== profile.id);
  const compactPreview = isMobile || isCompactHeight;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="oasis-panel w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col max-h-[94dvh]">
        <div className="px-3.5 sm:px-5 py-3 bg-[#121a3a]/90 border-b border-amber-500/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-purple-300 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="font-pixel text-xs sm:text-base text-white tracking-wide truncate">
              PERFIL E AMIGOS EM OASIS
            </h2>
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

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* My Profile Card */}
          <div className="md:col-span-5 rounded-xl bg-[#090e21] border border-amber-500/35 p-4 flex flex-col items-center text-center gap-3">
            <PixelAvatarPreview
              avatar={profile.avatar}
              scale={compactPreview ? 2.6 : 3}
              width={compactPreview ? 112 : 130}
              height={compactPreview ? 146 : 170}
              pedestal
            />
            <div>
              <div className="font-pixel text-sm sm:text-base text-white">{profile.name}</div>
              <p className="text-xs text-slate-300 mt-1">{profile.bio}</p>
              <div className="text-xs text-amber-300 font-mono-nums mt-2">
                {profile.stepsWalked} passos caminhados · {profile.inventory.length} itens
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onEditCharacter();
              }}
              className="w-full min-h-[42px] py-2 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 border border-amber-200 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_2px_0_#92400e] cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Editar Personagem</span>
            </button>
          </div>

          {/* Friends & Online Citizens */}
          <div className="md:col-span-7 flex flex-col gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
                Meus Amigos ({profile.friends.length})
              </div>
              <div className="flex flex-col gap-2">
                {profile.friends.length === 0 ? (
                  <div className="rounded-xl bg-[#090e21] border border-[#252e59] p-3 text-xs text-slate-400">
                    Você ainda não adicionou amigos. Clique em outro morador na praça para adicionar!
                  </div>
                ) : (
                  profile.friends.map((f) => (
                    <div
                      key={f.id}
                      className="px-3.5 py-2.5 rounded-xl bg-[#090e21] border border-[#252e59] flex items-center justify-between gap-2"
                    >
                      <span className="text-sm font-bold text-white truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          onVisitSpace(f.id);
                          onClose();
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1c244d] hover:bg-[#2a3673] text-xs font-bold text-sky-300 flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Home className="w-3.5 h-3.5" />
                        <span>Visitar Espaço</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2">
                Jogadores Online Agora ({otherOnline.length})
              </div>
              {otherOnline.length === 0 ? (
                <div className="rounded-xl bg-[#090e21] border border-[#252e59] p-3 text-xs text-slate-400">
                  Outros jogadores reais aparecerão aqui assim que entrarem na cidade!
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {otherOnline.map((op) => {
                    const already = profile.friends.some((f) => f.id === op.id);
                    return (
                      <div
                        key={op.id}
                        className="px-3.5 py-2.5 rounded-xl bg-[#090e21] border border-[#252e59] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">{op.name}</div>
                          <div className="text-[11px] text-slate-400">Em: {op.roomKey}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!already && (
                            <button
                              type="button"
                              onClick={() => onAddFriend(op.id, op.name)}
                              className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onVisitSpace(op.id);
                              onClose();
                            }}
                            className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1c244d] text-sky-300 text-xs font-bold cursor-pointer"
                          >
                            Espaço
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
