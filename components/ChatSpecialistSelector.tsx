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
        {CHAT_SPECIALISTS.map((specialist) => (
          <button
            key={specialist.id}
            onClick={() => onSelect(specialist.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${
                selectedSpecialty === specialist.id
                  ? 'bg-blue-600 text-white shadow-sm scale-105'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
              }
            `}
            title={specialist.description}
          >
            <span>{specialist.icon}</span>
            <span>{specialist.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};


