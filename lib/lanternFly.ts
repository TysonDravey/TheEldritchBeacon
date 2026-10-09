import { playSound } from './sound';

// Shared between PuzzleClient.tsx and app/daily/page.tsx's win sequences —
// kept in one place rather than duplicated per-file (see memory/session
// history: duplicating this kind of one-shot DOM logic across both puzzle
// entry points has caused real bugs before when only one copy got updated).
//
// Spawns `count` small lantern icons flying from the completion modal's
// "+N Lanterns" text (data-lantern-earned-badge) to the persistent
// LanternBadge (id="lantern-badge"), landing with a pop + soft tick each.
// Pure DOM/imperative, matching the codebase's own established pattern for
// one-shot visual flourishes (the win-ripple sequence, Auto-Ward's staged
// reveal pings) rather than React state.
export function flyLanternsToWallet(count: number): void {
  if (count <= 0) return;
  const target = document.getElementById('lantern-badge');
  const source = document.querySelector('[data-lantern-earned-badge]');
  if (!target || !source) return;

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;
  const toX = to.left + to.width / 2;
  const toY = to.top + to.height / 2;

  const lanternSvg =
    '<svg width="16" height="19" viewBox="0 0 20 24" fill="none">' +
    '<path d="M10 2c-2.2 2.6-3.6 4.8-3.6 7a3.6 3.6 0 0 0 7.2 0c0-2.2-1.4-4.4-3.6-7Z" fill="#B5860D" stroke="#8B1A1A" stroke-width="1.2"/>' +
    '<rect x="7.2" y="10" width="5.6" height="9" rx="1" fill="#8B1A1A" stroke="#8B1A1A" stroke-width="1.2"/>' +
    '<rect x="6" y="18.5" width="8" height="2" rx="0.5" fill="#3D2B1F" stroke="#3D2B1F" stroke-width="1"/>' +
    '</svg>';

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'lantern-fly';
    el.style.left = `${fromX}px`;
    el.style.top = `${fromY}px`;
    el.style.setProperty('--fly-dx', `${toX - fromX}px`);
    el.style.setProperty('--fly-dy', `${toY - fromY}px`);
    el.style.animationDelay = `${i * 140}ms`;
    el.innerHTML = lanternSvg;
    el.addEventListener('animationend', () => {
      el.remove();
      target.classList.remove('lantern-badge-catch');
      void target.offsetWidth; // restart the pop animation
      target.classList.add('lantern-badge-catch');
      playSound('ward');
    });
    document.body.appendChild(el);
  }
}
