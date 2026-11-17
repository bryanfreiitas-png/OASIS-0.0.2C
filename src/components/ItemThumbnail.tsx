import React from 'react';
import type { CatalogItem } from '../shared/types.ts';

interface ItemThumbnailProps {
  item: CatalogItem;
  className?: string;
}

export const ItemThumbnail: React.FC<ItemThumbnailProps> = ({ item, className = 'w-11 h-11' }) => {
  if (item.spriteUrl) {
    return (
      <div
        className={`${className} rounded-lg bg-[#161e3d] border border-[#2f3b70] shrink-0 flex items-center justify-center p-1 overflow-hidden`}
      >
        <img
          src={item.spriteUrl}
          alt={item.name}
          loading="lazy"
          className="w-full h-full object-contain [image-rendering:pixelated]"
        />
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-lg border border-white/20 shrink-0 flex items-center justify-center`}
      style={{ backgroundColor: item.primaryColor }}
    >
      <span
        className="w-4 h-4 rounded-sm"
        style={{ backgroundColor: item.accentColor }}
      />
    </div>
  );
};
