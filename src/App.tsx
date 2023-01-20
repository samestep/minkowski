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
import { useEffect } from "react";
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
  const closest = polygons
    .flatMap((p) =>
      p.map((a, i) => {
        const b = p[(i + 1) % p.length];
        // https://math.stackexchange.com/a/2193733
        const v = vec.sub(b, a);
        const u = a;
        const t = -vec.dot(v, u) / vec.dot(v, v);
        if (t <= 0) {
          return a;
        } else if (t < 1) {
          return vec.add(a, vec.scale(v, t));
        } else {
          return b;
        }
      })
    )
    .reduce((v, w) => (vec.mag(w) < vec.mag(v) ? w : v));
  return (
    <>
      {polygons.map((points, i) => (
        <Polygon key={i} points={points} />
      ))}
      {polygons.flat().map(([x, y]) => (
        <Point x={x} y={y} />
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
            {leftPoints.map((mp) => mp.element)}
            {rightPoints.map((mp) => mp.element)}
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
