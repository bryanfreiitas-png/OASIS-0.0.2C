import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Palette,
  RotateCw,
  Shirt,
  Sparkles,
  User,
} from 'lucide-react';
import { CATALOG_ITEMS, HAIR_COLORS, SKIN_TONES } from '../shared/catalog.ts';
import type { AvatarConfig, Gender } from '../shared/types.ts';
import { type TurnaroundView } from '../utils/pixelAvatarRenderer.ts';
import { OasisLogo } from './OasisLogo.tsx';
import { PixelAvatarPreview } from './PixelAvatarPreview.tsx';
import { soundFX } from '../utils/sound.ts';
import { useViewport } from '../utils/useViewport.ts';

interface CharacterCreatorProps {
  initialName?: string;
  initialBio?: string;
  initialAvatar?: AvatarConfig;
  isEditing?: boolean;
  onCancel?: () => void;
  onComplete: (data: { name: string; bio: string; avatar: AvatarConfig }) => void;
}

const MALE_ROTATE_VIEWS: TurnaroundView[] = [
  'frente',
  '3/4',
  'costas',
  '3/4_esquerda',
];
const FEMALE_ROTATE_VIEWS: TurnaroundView[] = ['frente', '3/4', 'direita', 'costas', 'esquerda'];

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({
  initialName = '',
  initialBio = 'Pronto para curtir a Praça Central!',
  initialAvatar,
  isEditing = false,
  onCancel,
  onComplete,
}) => {
  const { isMobile, isCompactHeight } = useViewport();

  const [name, setName] = useState(initialName || 'Morador_Oasis');
  const [bio, setBio] = useState(initialBio);
  const [avatar, setAvatar] = useState<AvatarConfig>(
    initialAvatar || {
      gender: 'masculino',
      skinTone: '#e09664',
      hairStyle: 'topete_fade',
      hairColor: '#1e1b26',
      eyeColor: '#1a1523',
      tattoo: true,
      shirtId: 'shirt_sem',
      pantsId: 'pants_shorts_branco',
      shoesId: 'shoes_chinelo',
      accessoryId: null,
    }
  );

  const [step, setStep] = useState<'aparencia' | 'roupas'>('aparencia');
  const [clothCategory, setClothCategory] = useState<'cima' | 'baixo' | 'calcado'>('cima');
  const [viewIndex, setViewIndex] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  const switchGender = (gender: Gender) => {
    soundFX.playClick();
    setViewIndex(1);
    setAvatar((prev) => ({
      ...prev,
      gender,
      hairStyle: gender === 'feminino' ? 'coque_alto' : 'topete_fade',
      hairColor: gender === 'feminino' ? '#4a2c20' : '#1e1b26',
      tattoo: gender === 'masculino',
      shirtId: gender === 'feminino' ? 'shirt_top_branco' : 'shirt_sem',
      pantsId: 'pants_shorts_branco',
      shoesId: gender === 'feminino' ? null : 'shoes_chinelo',
    }));
  };

  const rotateViews = avatar.gender === 'feminino' ? FEMALE_ROTATE_VIEWS : MALE_ROTATE_VIEWS;
  const activeRotateView = rotateViews[viewIndex % rotateViews.length];

  const starterShirts = CATALOG_ITEMS.filter(
    (i) => i.category === 'roupa_cima' && i.priceCoins <= 150
  );
  const starterPants = CATALOG_ITEMS.filter(
    (i) => i.category === 'roupa_baixo' && i.priceCoins <= 120
  );
  const starterShoes = CATALOG_ITEMS.filter(
    (i) => i.category === 'calcado' && i.priceCoins <= 140
  );

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setErrorMsg('Escolha um nome com pelo menos 2 caracteres.');
      setStep('aparencia');
      return;
    }
    soundFX.playQuest();
    onComplete({ name: cleanName, bio: bio.trim() || 'Explorando OASIS!', avatar });
  };

  const compactPreview = isMobile || isCompactHeight;

  return (
    <div className="h-dvh w-full bg-[#090d1f] text-slate-100 flex flex-col justify-between overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(245,158,11,0.18), transparent 45%), radial-gradient(circle at 80% 75%, rgba(139,92,246,0.24), transparent 45%)',
        }}
      />

      <div className="relative z-10 w-full max-w-4xl mx-auto px-2.5 sm:px-5 py-2.5 sm:py-5 flex flex-col gap-2.5 sm:gap-4 my-auto">
        {/* Compact Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="oasis-capsule rounded-full px-2.5 py-1 flex items-center">
              <OasisLogo compact showTagline={false} />
            </div>
            <div>
              <h1 className="font-pixel text-xs sm:text-lg text-white leading-tight">
                {isEditing ? 'Editar Personagem' : 'Criar Personagem'}
              </h1>
              <p className="text-[11px] sm:text-xs text-amber-200/80">
                Passo {step === 'aparencia' ? '1 de 2 · Modelo & Cores' : '2 de 2 · Roupas Iniciais'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Step Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-[#0e1530] border border-amber-500/40">
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setStep('aparencia');
                }}
                className={`min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  step === 'aparencia'
                    ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Aparência</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setStep('roupas');
                }}
                className={`min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  step === 'roupas'
                    ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                <Shirt className="w-3.5 h-3.5" />
                <span>Roupas</span>
              </button>
            </div>

            {isEditing && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#162044] hover:bg-[#223066] text-slate-200 text-xs font-semibold border border-amber-500/35 cursor-pointer"
              >
                Voltar
              </button>
            )}
          </div>
        </div>

        {/* Main Card: Balanced 2-col on Desktop & Landscape Tablet/Phone, Clean Stacked on Portrait */}
        <div
          className={`oasis-panel rounded-2xl p-3 sm:p-5 grid gap-3.5 sm:gap-5 items-center ${
            isCompactHeight ? 'grid-cols-12' : 'grid-cols-1 md:grid-cols-12'
          }`}
        >
          {/* LEFT: Compact Character Pedestal */}
          <div
            className={`${
              isCompactHeight ? 'col-span-4' : 'md:col-span-5'
            } flex flex-col items-center justify-center bg-[#090e21]/90 rounded-xl border border-amber-500/35 p-2.5 sm:p-4 relative`}
          >
            <button
              type="button"
              title="Girar personagem"
              onClick={() => {
                soundFX.playClick();
                setViewIndex((v) => (v + 1) % rotateViews.length);
              }}
              className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-[#162044] hover:bg-[#223066] border border-amber-400/50 text-[11px] font-semibold text-amber-200 flex items-center gap-1 cursor-pointer"
            >
              <RotateCw className="w-3 h-3" />
              <span>Girar</span>
            </button>

            <PixelAvatarPreview
              avatar={avatar}
              view={activeRotateView}
              expression="normal"
              action="parado"
              scale={compactPreview ? 2.5 : 3}
              width={compactPreview ? 110 : 136}
              height={compactPreview ? 140 : 176}
              pedestal
            />

            <div className="mt-1 text-center w-full">
              <div className="font-pixel text-xs sm:text-sm text-white truncate max-w-[180px] mx-auto">
                {name || 'Seu Nome'}
              </div>
              <div className="text-[10px] sm:text-[11px] text-amber-300/90 capitalize mt-0.5">
                {avatar.gender} · Bônus: 450 moedas
              </div>
            </div>
          </div>

          {/* RIGHT: Step 1 OR Step 2 */}
          <div
            className={`${
              isCompactHeight ? 'col-span-8' : 'md:col-span-7'
            } flex flex-col gap-3`}
          >
            {step === 'aparencia' ? (
              <>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Modelo do Personagem</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => switchGender('masculino')}
                      className={`min-h-[40px] py-2 px-3 rounded-xl border-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        avatar.gender === 'masculino'
                          ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-md'
                          : 'bg-[#090e21] text-slate-200 border-[#283366] hover:border-amber-400/60'
                      }`}
                    >
                      Masculino
                    </button>
                    <button
                      type="button"
                      onClick={() => switchGender('feminino')}
                      className={`min-h-[40px] py-2 px-3 rounded-xl border-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        avatar.gender === 'feminino'
                          ? 'bg-pink-500 text-white border-pink-300 shadow-md'
                          : 'bg-[#090e21] text-slate-200 border-[#283366] hover:border-pink-400/60'
                      }`}
                    >
                      Feminino
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-1.5">
                    Cor de Pele
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SKIN_TONES.map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setAvatar((p) => ({ ...p, skinTone: tone.hex }));
                        }}
                        className={`min-h-[34px] flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold cursor-pointer ${
                          avatar.skinTone === tone.hex
                            ? 'border-amber-400 bg-[#1a244d] text-white'
                            : 'border-[#283366] bg-[#090e21] text-slate-300 hover:border-amber-400/60'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/40 shrink-0"
                          style={{ backgroundColor: tone.hex }}
                        />
                        <span>{tone.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-1.5">
                    Cor do Cabelo
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {HAIR_COLORS.map((hc) => (
                      <button
                        key={hc.id}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setAvatar((p) => ({ ...p, hairColor: hc.hex }));
                        }}
                        className={`min-h-[34px] flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold cursor-pointer ${
                          avatar.hairColor === hc.hex
                            ? 'border-amber-400 bg-[#1a244d] text-white'
                            : 'border-[#283366] bg-[#090e21] text-slate-300 hover:border-amber-400/60'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: hc.hex }}
                        />
                        <span>{hc.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-200 mb-1">
                      Nome no OASIS
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrorMsg('');
                      }}
                      placeholder="Ex: MagnuS"
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#090e21] border border-[#2d3a70] text-white text-xs sm:text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-200 mb-1">
                      Frase de Perfil
                    </label>
                    <input
                      type="text"
                      maxLength={70}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Ex: Bora trocar móveis!"
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#090e21] border border-[#2d3a70] text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {errorMsg && <p className="text-xs text-rose-400 font-semibold">{errorMsg}</p>}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      setStep('roupas');
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#162044] hover:bg-[#223066] border border-amber-400/50 text-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Shirt className="w-4 h-4 text-amber-300" />
                    <span>Escolher Roupas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="flex-1 min-w-[150px] min-h-[42px] py-2 px-4 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 border border-amber-200 text-slate-950 font-pixel text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-[0_3px_0_#92400e] cursor-pointer"
                  >
                    <span>{isEditing ? 'Salvar Aparência' : 'Entrar no OASIS'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-amber-500/25 pb-2 overflow-x-auto no-scrollbar">
                  {([
                    { id: 'cima', label: 'Parte de Cima' },
                    { id: 'baixo', label: 'Parte de Baixo' },
                    { id: 'calcado', label: 'Calçados' },
                  ] as const).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        soundFX.playClick();
                        setClothCategory(cat.id);
                      }}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                        clothCategory === cat.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-[#090e21] text-slate-300 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[190px] overflow-y-auto pr-1">
                  {clothCategory === 'cima' &&
                    starterShirts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setAvatar((p) => ({ ...p, shirtId: item.id }));
                        }}
                        className={`min-h-[40px] px-3 py-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                          avatar.shirtId === item.id
                            ? 'border-amber-400 bg-[#1a244d] text-white'
                            : 'border-[#283366] bg-[#090e21] text-slate-300 hover:border-amber-400/60'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        {item.spriteUrl ? (
                          <img
                            src={item.spriteUrl}
                            alt={item.name}
                            className="w-6 h-6 object-contain [image-rendering:pixelated] shrink-0"
                          />
                        ) : (
                          item.shape !== 'none' && (
                            <span
                              className="w-4 h-4 rounded border border-white/20 shrink-0"
                              style={{ backgroundColor: item.primaryColor }}
                            />
                          )
                        )}
                      </button>
                    ))}

                  {clothCategory === 'baixo' &&
                    starterPants.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setAvatar((p) => ({ ...p, pantsId: item.id }));
                        }}
                        className={`min-h-[40px] px-3 py-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                          avatar.pantsId === item.id
                            ? 'border-amber-400 bg-[#1a244d] text-white'
                            : 'border-[#283366] bg-[#090e21] text-slate-300 hover:border-amber-400/60'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        <span
                          className="w-4 h-4 rounded border border-white/20 shrink-0"
                          style={{ backgroundColor: item.primaryColor }}
                        />
                      </button>
                    ))}

                  {clothCategory === 'calcado' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setAvatar((p) => ({ ...p, shoesId: null }));
                        }}
                        className={`min-h-[40px] px-3 py-2 rounded-xl border text-left text-xs font-semibold cursor-pointer ${
                          avatar.shoesId === null
                            ? 'border-amber-400 bg-[#1a244d] text-white'
                            : 'border-[#283366] bg-[#090e21] text-slate-300 hover:border-amber-400/60'
                        }`}
                      >
                        Descalço
                      </button>
                      {starterShoes.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            soundFX.playClick();
                            setAvatar((p) => ({ ...p, shoesId: item.id }));
                          }}
                          className={`min-h-[40px] px-3 py-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between cursor-pointer ${
                            avatar.shoesId === item.id
                              ? 'border-amber-400 bg-[#1a244d] text-white'
                              : 'border-[#283366] bg-[#090e21] text-slate-300 hover:border-amber-400/60'
                          }`}
                        >
                          <span className="truncate">{item.name}</span>
                          <span
                            className="w-4 h-4 rounded border border-white/20 shrink-0"
                            style={{ backgroundColor: item.primaryColor }}
                          />
                        </button>
                      ))}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-amber-200/90 bg-[#090e21]/80 border border-amber-500/30 rounded-lg px-3 py-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Você começa com 450 moedas, 15 gemas e móveis iniciais para personalizar seu
                    espaço.
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      setStep('aparencia');
                    }}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#090e21] hover:bg-[#162044] border border-amber-500/40 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="flex-1 min-w-[150px] min-h-[42px] py-2 px-4 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 border border-amber-200 text-slate-950 font-pixel text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-[0_3px_0_#92400e] cursor-pointer"
                  >
                    <span>{isEditing ? 'Salvar Aparência' : 'Entrar no OASIS'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
