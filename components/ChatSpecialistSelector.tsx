'use client';

import React from 'react';
import { Specialty } from '../lib/prompts';
import { CHAT_SPECIALISTS } from '../lib/chat-specialists';

interface ChatSpecialistSelectorProps {
  selectedSpecialty: Specialty;
  onSelect: (specialty: Specialty) => void;
}

export const ChatSpecialistSelector: React.FC<ChatSpecialistSelectorProps> = ({
  selectedSpecialty,
  onSelect,
}) => {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {CHAT_SPECIALISTS.map((specialist) => {
          const isSelected = selectedSpecialty === specialist.id;
          const isHighlighted = Boolean(specialist.highlight);

          let buttonClassName =
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ';

          if (isHighlighted) {
            buttonClassName += isSelected
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md scale-105 ring-2 ring-cyan-300'
              : 'bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-800 border-2 border-cyan-400 shadow-sm ring-2 ring-cyan-200 hover:border-cyan-500 hover:from-cyan-100 hover:to-blue-100 animate-pulse-slow';
          } else {
            buttonClassName += isSelected
              ? 'bg-blue-600 text-white shadow-sm scale-105'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-blue-50';
          }

          return (
            <button
              key={specialist.id}
              onClick={() => onSelect(specialist.id)}
              className={buttonClassName}
              title={specialist.description}
            >
              <span>{specialist.icon}</span>
              <span>{specialist.label}</span>
              {isHighlighted && !isSelected && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-cyan-600 text-white text-[9px] font-bold leading-none">
                  NEW
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};


