const vec2 = (x, y) => [x, y];

const scale = (s, v) => v.map(([x, y]) => [s * x, s * y]);

return [
  scale(0.01, [vec2(50, 50), vec2(-50, 50), vec2(-50, -50)]),
  scale(0.01, [
    vec2(200, 100),
    vec2(100, 100),
    vec2(100, -100),
    vec2(-100, -100),
    vec2(-100, 100),
    vec2(-200, 100),
    vec2(-200, -200),
    vec2(200, -200),
  ]),
];
