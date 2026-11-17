import React from 'react';

interface OasisLogoProps {
  compact?: boolean;
  hideTagline?: boolean;
  showTagline?: boolean;
}

export const OasisLogo: React.FC<OasisLogoProps> = ({
  compact = false,
  hideTagline = false,
  showTagline = true,
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2.5 shrink-0 select-none">
        <img
          src="/assets/sprites/oasis_logo.png"
          alt="OASIS"
          referrerPolicy="no-referrer"
          className="h-8 sm:h-10 w-auto object-contain pixelated drop-shadow-[0_2px_6px_rgba(168,85,247,0.45)]"
        />
        {!hideTagline && showTagline && (
          <div className="hidden xl:flex items-center gap-2.5 leading-none">
            <span className="h-5 w-px bg-amber-400/50" aria-hidden="true" />
            <span className="text-[11px] font-bold tracking-widest text-amber-300 uppercase whitespace-nowrap">
              CONECTE · CONQUISTE · DIVIRTA-SE
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center select-none">
      <img
        src="/assets/sprites/oasis_logo.png"
        alt="OASIS"
        referrerPolicy="no-referrer"
        className="h-20 sm:h-24 w-auto object-contain pixelated drop-shadow-[0_4px_16px_rgba(168,85,247,0.5)]"
      />
    </div>
  );
};
