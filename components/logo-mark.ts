// Hand-traced vector of public/logos/mazj-wordmark.png (559x412, the only
// source of the mark). Coordinates are stroke CENTERLINES on the PNG's pixel
// grid; the 49-unit stroke reproduces the drawn letterforms (gate: IoU >= 0.97
// vs the PNG). strokes[] is WRITE order (Arabic is right-to-left, so م is the
// rightmost letterform) and each d runs in natural pen direction; LogoLoop's
// stroke-dashoffset draw depends on both.
export const MARK = {
  viewBox: "0 0 559 412",
  strokeWidth: 49,
  strokes: [
    {id: "meem", d: "M 355.4 387.3 C 382.5 387.3 410.7 359.1 410.7 332 V 80.9 C 410.7 53.8 438.9 25.6 466 25.6 H 478 C 505.1 25.6 533.3 53.8 533.3 80.9 V 368.2"},
    {id: "zain", d: "M 263.3 67.2 V 332 C 263.3 359.1 235.1 387.3 208 387.3"},
    {id: "jeem", d: "M 0 26.2 H 91.3 C 118.4 26.2 146.6 54.4 146.6 81.5 V 93.6 C 146.6 120.7 118.4 148.9 91.3 148.9 H 24.7 V 332 C 24.7 359.1 53.2 387.3 80.4 387.3"},
  ],
  dots: [
    {id: "zain-dot", cx: 262.7, cy: 23.6, r: 24.1},
    {id: "jeem-dot", cx: 111.2, cy: 261.2, r: 24.1},
  ],
} as const;
