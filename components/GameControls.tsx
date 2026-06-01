'use client';

interface GameControlsProps {
  onHint: () => void;
  onUndo: () => void;
  onRestart: () => void;
  hintsUsed: number;
  canUndo: boolean;
  completed: boolean;
}

export default function GameControls({
  onHint,
  onUndo,
  onRestart,
  hintsUsed,
  canUndo,
  completed,
}: GameControlsProps) {
  function handleRestart() {
    if (window.confirm('Restart this puzzle? All progress will be lost.')) {
      onRestart();
    }
  }

  const baseBtn =
    'font-serif text-sm border border-ink px-4 py-2 rounded-sm transition-colors duration-100 select-none';
  const activeBtn = `${baseBtn} bg-parchment text-ink hover:bg-parchment-dark`;
  const disabledBtn = `${baseBtn} bg-parchment text-ink opacity-40 cursor-not-allowed`;

  return (
    <div className="flex items-center gap-3 mt-4">
      {/* Hint */}
      <button
        onClick={onHint}
        disabled={completed}
        className={completed ? disabledBtn : activeBtn}
        title="Request a hint"
      >
        Hint
        {hintsUsed > 0 && (
          <span className="ml-1.5 text-xs text-red-ink">({hintsUsed})</span>
        )}
      </button>

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo || completed}
        className={!canUndo || completed ? disabledBtn : activeBtn}
        title="Undo last move"
      >
        Undo
      </button>

      {/* Restart */}
      <button
        onClick={handleRestart}
        className={activeBtn}
        title="Restart puzzle"
      >
        Restart
      </button>
    </div>
  );
}
