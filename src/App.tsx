import * as FlexLayout from "flexlayout-react";
import {
  CartesianCoordinates,
  Mafs,
  Point,
  Polygon,
  Theme,
  useMovablePoint,
  vec,
  Vector,
} from "mafs";
import decomp from "poly-decomp";
import React, { useEffect } from "react";
import { useMediaQuery } from "react-responsive";
import "./App.css";

interface Decomp {
  simple: boolean;
  polygons: decomp.Polygon[];
}

const decompose = (points: decomp.Polygon): Decomp => {
  const simple = decomp.isSimple(points);
  let polygons = [points];
  if (simple) {
    const polygon = [...points];
    decomp.makeCCW(polygon);
    polygons = decomp.quickDecomp(polygon);
  }
  return { simple, polygons };
};

interface DecompProps extends Decomp {
  color: string;
}

const Polygons = (props: DecompProps) => {
  return (
    <>
      {props.polygons.map((polygon, i) => (
        <Polygon
          key={i}
          points={polygon}
          color={props.simple ? props.color : Theme.red}
        />
      ))}
    </>
  );
};

const cross = ([a, b]: vec.Vector2, [c, d]: vec.Vector2): number =>
  a * d - b * c;

// https://cp-algorithms.com/geometry/minkowski.html

const reorder = (p: decomp.Polygon): void => {
  let i = 0;
  for (let j = 1; j < p.length; j++) {
    if (p[j][1] < p[i][1] || (p[j][1] === p[i][1] && p[j][0] < p[i][0])) {
      i = j;
    }
  }
  p.push(...p.splice(0, i));
};

const minkowski = (a: decomp.Polygon, b: decomp.Polygon): decomp.Polygon => {
  const p = [...a];
  const q = [...b];
  decomp.makeCCW(p);
  decomp.makeCCW(q);
  // the first vertex must be the lowest
  reorder(p);
  reorder(q);
  // we must ensure cyclic indexing
  p.push(p[0], p[1]);
  q.push(q[0], q[1]);
  // main part
  const r: decomp.Polygon = [];
  let i = 0,
    j = 0;
  while (i < p.length - 2 || j < q.length - 2) {
    r.push(vec.add(p[i], q[j]));
    const z = cross(vec.sub(p[i + 1], p[i]), vec.sub(q[j + 1], q[j]));
    if (z >= 0) ++i;
    if (z <= 0) ++j;
  }
  return r;
};

const interior = (convex: decomp.Polygon, point: vec.Vector2): boolean =>
  convex.every((a, i) => {
    const b = convex[(i + 1) % convex.length];
    const v = vec.sub(b, a);
    const u = vec.sub(point, a);
    return cross(v, u) > 0;
  });

const noInterior = (
  polygons: decomp.Polygon[],
  point: vec.Vector2,
  start: number,
  end: number
): boolean => {
  for (let i = start; i < end; ++i)
    if (interior(polygons[i], point)) return false;
  return true;
};

const Minkowski = (props: {
  left: decomp.Polygon[];
  right: decomp.Polygon[];
}) => {
  const polygons = props.left.flatMap((a) =>
    props.right.map((b) =>
      minkowski(
        a,
        b.map(([x, y]) => [-x, -y])
      )
    )
  );
  const candidates: vec.Vector2[] = [];
  for (let i0 = 0; i0 < polygons.length; ++i0) {
    const p0 = polygons[i0];
    for (let j0 = 0; j0 < p0.length; ++j0) {
      const a0 = p0[j0];
      const b0 = p0[(j0 + 1) % p0.length];
      const v0 = vec.sub(b0, a0);
      if (
        noInterior(polygons, a0, 0, i0) &&
        noInterior(polygons, a0, i0 + 1, polygons.length)
      )
        candidates.push(a0);
      const t = -vec.dot(v0, a0) / vec.dot(v0, v0);
      if (0 < t && t < 1) {
        const c = vec.add(a0, vec.scale(v0, t));
        if (
          noInterior(polygons, c, 0, i0) &&
          noInterior(polygons, c, i0 + 1, polygons.length)
        )
          candidates.push(c);
      }
      for (let i1 = i0 + 1; i1 < polygons.length; ++i1) {
        const p1 = polygons[i1];
        for (let j1 = 0; j1 < p1.length; ++j1) {
          const a1 = p1[j1];
          const b1 = p1[(j1 + 1) % p1.length];
          const v1 = vec.sub(b1, a1);
          const w = vec.sub(a1, a0);
          const denom = cross(v0, v1);
          const t0 = cross(w, v1) / denom;
          const t1 = cross(w, v0) / denom;
          if (0 < t0 && t0 < 1 && 0 < t1 && t1 < 1) {
            const c = vec.add(a0, vec.scale(v0, t0));
            if (
              noInterior(polygons, c, 0, i0) &&
              noInterior(polygons, c, i0 + 1, i1) &&
              noInterior(polygons, c, i1 + 1, polygons.length)
            )
              candidates.push(c);
          }
        }
      }
    }
  }
  const closest = candidates.reduce((v, w) =>
    vec.mag(w) < vec.mag(v) ? w : v
  );
  return (
    <>
      {polygons.map((points, i) => (
        <Polygon key={i} points={points} />
      ))}
      {candidates.map(([x, y], i) => (
        <Point key={i} x={x} y={y} />
      ))}
      <Vector tip={closest} />
    </>
  );
};

const model = FlexLayout.Model.fromJson({
  global: {
    tabEnableClose: false,
    tabEnableRename: false,
    tabSetEnableMaximize: false,
  },
  borders: [],
  layout: {
    type: "row",
    children: [
      {
        type: "tabset",
        children: [{ type: "tab", name: "input", component: "input" }],
      },
      {
        type: "tabset",
        children: [{ type: "tab", name: "output", component: "output" }],
      },
    ],
  },
});

const App = () => {
  const isPortrait = useMediaQuery({ query: "(orientation: portrait)" });

  useEffect(() => {
    model.doAction(
      FlexLayout.Actions.updateModelAttributes({
        rootOrientationVertical: isPortrait,
      })
    );
  }, [isPortrait]);

  const leftColor = { color: Theme.green };
  const rightColor = { color: Theme.blue };

  const leftPoints = [
    useMovablePoint([3, -2], leftColor),
    useMovablePoint([0, 2], leftColor),
    useMovablePoint([-0.5, -1.5], leftColor),
    useMovablePoint([0.5, 0.5], leftColor),
    useMovablePoint([1.5, -1], leftColor),
    useMovablePoint([0, -1.5], leftColor),
  ];

  const rightPoints = [
    useMovablePoint([1, 0], rightColor),
    useMovablePoint([0, 1], rightColor),
    useMovablePoint([0, 0], rightColor),
  ];

  const left = decompose(leftPoints.map((mp) => mp.point));
  const right = decompose(rightPoints.map((mp) => mp.point));

  const factory = (node: FlexLayout.TabNode) => {
    const { width, height } = node.getRect();
    switch (node.getComponent()) {
      case "input": {
        return (
          <Mafs width={width} height={height}>
            <CartesianCoordinates />
            <Polygons {...left} {...leftColor} />
            <Polygons {...right} {...rightColor} />
            {leftPoints.map((mp, i) => (
              <React.Fragment key={i}>{mp.element}</React.Fragment>
            ))}
            {rightPoints.map((mp, i) => (
              <React.Fragment key={i}>{mp.element}</React.Fragment>
            ))}
          </Mafs>
        );
      }
      case "output": {
        return (
          <Mafs width={width} height={height}>
            <CartesianCoordinates />
            {left.simple && right.simple ? (
              <Minkowski left={left.polygons} right={right.polygons} />
            ) : (
              <></>
            )}
          </Mafs>
        );
      }
    }
  };

  return <FlexLayout.Layout model={model} factory={factory} />;
};

export default App;
