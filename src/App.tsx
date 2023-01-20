import * as FlexLayout from "flexlayout-react";
import {
  CartesianCoordinates,
  Mafs,
  Polygon,
  Theme,
  useMovablePoint,
  vec,
} from "mafs";
import decomp from "poly-decomp";
import { useEffect } from "react";
import { useMediaQuery } from "react-responsive";
import "./App.css";

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

  const a = useMovablePoint([0, 1], leftColor);
  const b = useMovablePoint([-1, 2], leftColor);
  const c = useMovablePoint([-2, 1], leftColor);
  const d = useMovablePoint([-1, 0], leftColor);

  const e = useMovablePoint([1, 0], rightColor);
  const f = useMovablePoint([0, 0], rightColor);
  const g = useMovablePoint([0, -1], rightColor);
  const h = useMovablePoint([1, -1], rightColor);

  const left = decompose([a.point, b.point, c.point, d.point]);
  const right = decompose([e.point, f.point, g.point, h.point]);

  const factory = (node: FlexLayout.TabNode) => {
    const { width, height } = node.getRect();
    switch (node.getComponent()) {
      case "input": {
        return (
          <Mafs width={width} height={height}>
            <CartesianCoordinates />

            <Polygons {...left} {...leftColor} />
            <Polygons {...right} {...rightColor} />

            {a.element}
            {b.element}
            {c.element}
            {d.element}

            {e.element}
            {f.element}
            {g.element}
            {h.element}
          </Mafs>
        );
      }
      case "output": {
        return (
          <Mafs width={width} height={height}>
            <CartesianCoordinates />
            {left.simple && right.simple
              ? left.polygons
                  .flatMap((a) =>
                    right.polygons.map((b) =>
                      minkowski(
                        a,
                        b.map(([x, y]) => [-x, -y])
                      )
                    )
                  )
                  .map((points, i) => (
                    <Polygon key={i} points={points} color={Theme.foreground} />
                  ))
              : []}
          </Mafs>
        );
      }
    }
  };

  return <FlexLayout.Layout model={model} factory={factory} />;
};

export default App;
