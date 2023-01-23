import * as FlexLayout from "flexlayout-react";
import {
  CartesianCoordinates,
  Line,
  Mafs,
  Polygon,
  Theme,
  useMovablePoint,
  vec,
} from "mafs";
import React, { useEffect } from "react";
import { useMediaQuery } from "react-responsive";
import "./App.css";
import example from "./example.json";
import init, { initialize, minkowski } from "./wasm/minkowski_web";

await init();
initialize();

const minkowskiSum = (
  a: vec.Vector2[],
  b: vec.Vector2[]
): { edges: [vec.Vector2, vec.Vector2][]; polygons: vec.Vector2[][] } =>
  minkowski(
    new Float64Array(a.map(([x]) => x)),
    new Float64Array(a.map(([, y]) => y)),
    new Float64Array(b.map(([x]) => x)),
    new Float64Array(b.map(([, y]) => y))
  );

const cross = ([x0, y0]: vec.Vector2, [x1, y1]: vec.Vector2) =>
  x0 * y1 - x1 * y0;

const isClockwise = (polygon: vec.Vector2[]) => {
  // https://stackoverflow.com/a/1180256
  let i = 0;
  for (let j = 1; j < polygon.length; ++j) {
    if (
      polygon[j][1] < polygon[i][1] ||
      (polygon[j][1] === polygon[i][1] && polygon[j][0] > polygon[i][0])
    ) {
      i = j;
    }
  }
  const a = polygon[i];
  const b = polygon[i > 0 ? i - 1 : polygon.length - 1];
  const c = polygon[i + 1 < polygon.length ? i + 1 : 0];
  return cross(vec.sub(b, a), vec.sub(c, a)) > 0;
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

  const leftColor = { color: Theme.red };
  const rightColor = { color: Theme.violet };

  const [leftInitial, rightInitial] = example as [vec.Vector2[], vec.Vector2[]];

  const leftPoints = leftInitial.map((point) =>
    useMovablePoint(point, leftColor)
  );

  const rightPoints = rightInitial.map((point) =>
    useMovablePoint(point, rightColor)
  );

  const left = leftPoints.map((mp) => mp.point);
  const right = rightPoints.map((mp) => mp.point);

  const { edges, polygons } = minkowskiSum(left, right);

  const factory = (node: FlexLayout.TabNode) => {
    const { width, height } = node.getRect();
    switch (node.getComponent()) {
      case "input": {
        return (
          <Mafs width={width} height={height}>
            <CartesianCoordinates />
            <Polygon points={left} {...leftColor} />
            <Polygon points={right} {...rightColor} />
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
            {edges.map(([point1, point2], i) => (
              <Line.Segment key={i} point1={point1} point2={point2} />
            ))}
            {polygons.map((polygon, i) => (
              <Polygon
                key={i}
                points={polygon}
                color={isClockwise(polygon) ? Theme.indigo : Theme.blue}
              />
            ))}
          </Mafs>
        );
      }
    }
  };

  return <FlexLayout.Layout model={model} factory={factory} />;
};

export default App;
