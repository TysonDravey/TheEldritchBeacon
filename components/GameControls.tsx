'use client';

import { useState } from 'react';

interface GameControlsProps {
  onHint: () => void;
  onUndo: () => void;
  onRestart: () => void;
  hintsUsed: number;
  canUndo: boolean;
  completed: boolean;
}

function PlaqButton({
  label,
  onClick,
  disabled,
  badge,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  badge?: number;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`relative transition-all duration-100 select-none ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:brightness-110 active:scale-95'
      }`}
    >
      <img
        src="/buttons/button_01.png"
        alt=""
        draggable={false}
        style={{ width: 100, height: 48, display: 'block', filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-serif text-sm font-bold"
        style={{ color: 'rgba(242,233,210,0.95)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
      >
        {label}
      </span>
      {badge != null && badge > 0 && (
        <span
          className="absolute top-0.5 right-0.5 font-serif text-xs leading-none px-1 rounded-sm"
          style={{
            background: 'rgba(139,0,0,0.85)',
            color: 'rgba(242,233,210,0.95)',
            fontSize: 10,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export default function GameControls({
  onHint,
  onUndo,
  onRestart,
  hintsUsed,
  canUndo,
  completed,
}: GameControlsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 mt-4">
        <PlaqButton
          label="Hint"
          onClick={onHint}
          disabled={completed}
          badge={hintsUsed}
          title="Request a hint"
        />
        <PlaqButton
          label="Undo"
          onClick={onUndo}
          disabled={!canUndo || completed}
          title="Undo last move"
        />
        <PlaqButton
          label="Restart"
          onClick={() => setConfirming(true)}
          title="Restart puzzle"
        />
      </div>

      {/* Restart confirmation dialog */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(8,5,2,0.88)' }}
          onClick={() => setConfirming(false)}
        >
          <div
            className="relative select-none"
            style={{ width: 440 }}
            onClick={e => e.stopPropagation()}
          >
            <img
              src="/scrolls/scroll_short_03.png"
              alt=""
              draggable={false}
              style={{ width: '100%', display: 'block' }}
            />

            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ padding: '14% 18%' }}
            >
              <div
                className="text-center w-full"
                style={{
                  background: 'rgba(242,233,216,0.78)',
                  padding: '10px 16px',
                  borderRadius: 3,
                  border: '1px solid rgba(26,18,9,0.18)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)',
                }}
              >
                <h2 className="font-serif text-lg font-bold text-ink">Restart Puzzle?</h2>
                <p className="font-serif text-xs mt-1" style={{ color: 'rgba(26,18,9,0.65)' }}>
                  All progress will be lost.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => { onRestart(); setConfirming(false); }}
                  className="relative transition-all duration-100 hover:brightness-110 active:scale-95"
                  title="Confirm restart"
                >
                  <img
                    src="/buttons/button_01.png"
                    alt=""
                    draggable={false}
                    style={{ width: 140, height: 70, display: 'block', filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
                  />
                  <span
                    className="absolute inset-0 flex items-center justify-center font-serif text-sm font-bold"
                    style={{ color: 'rgba(242,233,210,0.95)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    Restart
                  </span>
                </button>

                <button
                  onClick={() => setConfirming(false)}
                  className="relative transition-all duration-100 hover:brightness-110 active:scale-95"
                  style={{ opacity: 0.75 }}
                  title="Cancel"
                >
                  <img
                    src="/buttons/button_01.png"
                    alt=""
                    draggable={false}
                    style={{ width: 140, height: 70, display: 'block', filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
                  />
                  <span
                    className="absolute inset-0 flex items-center justify-center font-serif text-sm"
                    style={{ color: 'rgba(242,233,210,0.95)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    Cancel
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
