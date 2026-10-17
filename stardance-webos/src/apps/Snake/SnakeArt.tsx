import type { Direction } from "./engine";
import { UNICORN_SKINS, type UnicornSkin } from "./unicornSkins";

export const DIRECTION_ANGLE: Record<Direction, number> = { up: 0, right: 90, down: 180, left: 270 };

export { UNICORN_SKINS };
export type { UnicornSkin };

export function ClassicSnakeHead({ direction }: { direction: Direction }) {
  return (
    <svg className="snake__classic-head-art" viewBox="0 0 40 40" aria-hidden="true" style={{ transform: `rotate(${DIRECTION_ANGLE[direction]}deg)` }}>
      <path d="M20 2C10 2 3 10 3 20s7 18 17 18 17-8 17-18S30 2 20 2Z" />
      <path className="snake__classic-eye" d="M12 15v4m16-4v4" />
      <path className="snake__classic-mouth" d="M15 25c3 4 7 4 10 0" />
    </svg>
  );
}

export function Cupcake({ special = false }: { special?: boolean }) {
  return (
    <svg className={`snake__cupcake ${special ? "snake__cupcake--special" : ""}`} viewBox="0 0 40 40" aria-hidden="true">
      {special && <path className="snake__cupcake-aura" d="M20 1 23 8 31 5 29 13 38 16 31 21 36 29 27 28 24 38 18 31 11 37 11 28 2 26 8 19 3 12 12 12 14 3Z" />}
      <path className="snake__icing" d="M10 18c-3.1 0-5-2.3-5-5.1 0-2.5 1.8-4.5 4.3-4.9C10 4.8 12.8 3 16 4.2c2.6-3 7.6-2.8 9.8.6 3.5-.8 6.8 1.9 6.7 5.3 2.3 1 3.7 3 3.5 5.4-.2 2.7-2.3 4.5-5.2 4.5H10Z" />
      <path className="snake__wrapper" d="m9 18 22-1-3.2 17H12.2L9 18Z" />
      <path className="snake__wrapper-line" d="m14 20 1 12m6-12v12m6-13-1 13" />
      <path className="snake__sprinkle" d="m13 11 3-2m7 1 3-2m3 6 3-1m-17-2 2 2m8 1 2-2" />
      {special && <path className="snake__candle" d="M19 2v8m-3-6 3-4 3 4" />}
    </svg>
  );
}

export function UnicornHead({ direction, flying = false, skin = "lavender" }: { direction: Direction; flying?: boolean; skin?: UnicornSkin }) {
  return (
    <svg
      className={`snake__unicorn snake__unicorn--${skin} ${flying ? "snake__unicorn--flying" : ""}`}
      viewBox="0 0 48 48"
      aria-hidden="true"
      style={{ transform: `rotate(${DIRECTION_ANGLE[direction]}deg)` }}
    >
      {skin === "rainbow" && <defs><linearGradient id="unicorn-rainbow-mane" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff719c" /><stop offset=".35" stopColor="#ffc45b" /><stop offset=".68" stopColor="#62d8c2" /><stop offset="1" stopColor="#9c80ff" /></linearGradient></defs>}
      {skin === "cotton-candy" && <defs><linearGradient id="unicorn-cotton-face" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffabd0" /><stop offset="1" stopColor="#83d9f0" /></linearGradient></defs>}
      {flying && (
        <g className="snake__wings">
          <path d="M15 23C5 8 2 18 9 29c-6-7-10 1-2 10 5 5 11 1 15-7Zm18 0C43 8 46 18 39 29c6-7 10 1 2 10-5 5-11 1-15-7Z" />
        </g>
      )}
      <path className="snake__ear" d="m12 16-3-9 10 6m17 3 3-9-10 6" />
      <path className="snake__horn" d="m21 13 4-12 5 13" />
      <path className="snake__mane" d="M9 20c-6 0-8 7-3 10-4 5 1 10 6 8-1 5 5 7 8 3 4 5 10 2 9-3 6 1 9-4 5-8 5-5 1-11-5-10-5-6-13-6-20 0Z" />
      <path className="snake__face" d="M11 19c1-6 7-9 13-9s12 3 13 9l-2 17c-1 6-5 9-11 9s-10-3-11-9l-2-17Z" />
      <path className="snake__forelock" d="M11 19c1-7 7-10 13-10 5 0 9 2 11 7-4-2-7-2-10 0-4 2-8 2-14 3Z" />
      <path className="snake__eye" d="M16 27c1.5-2.3 4-2.3 5.5 0m5 0c1.5-2.3 4-2.3 5.5 0" />
      <ellipse className="snake__blush" cx="15" cy="33" rx="3.4" ry="2" />
      <ellipse className="snake__blush" cx="33" cy="33" rx="3.4" ry="2" />
      <path className="snake__smile" d="M21 34c2 2 4 2 6 0" />
      {skin === "midnight" && <g className="snake__stars"><path d="m15 20 1 2 2 1-2 1-1 2-1-2-2-1 2-1Zm18 11 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" /></g>}
    </svg>
  );
}
