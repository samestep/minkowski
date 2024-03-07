import * as FlexLayout from "flexlayout-react";
import {
  Coordinates,
  Line,
  Mafs,
  Point,
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
  // https://stackoverflow.com/a/1165943
  let sum = 0;
  for (let i = 0; i < polygon.length; ++i) {
    const [x0, y0] = polygon[i];
    const [x1, y1] = polygon[(i + 1) % polygon.length];
    sum += (x1 - x0) * (y1 + y0);
  }
  return sum > 0;
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
          <Mafs width={width} height={height} zoom={true}>
            <Coordinates.Cartesian />
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
          <Mafs width={width} height={height} zoom={true}>
            <Coordinates.Cartesian />
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
            {polygons.flatMap((polygon, i) => {
              const color = isClockwise(polygon) ? Theme.indigo : Theme.blue;
              return polygon.map(([x, y], j) => (
                <Point
                  key={polygons.length * i + j}
                  x={x}
                  y={y}
                  color={color}
                />
              ));
            })}
          </Mafs>
        );
      }
    }
  };

  return <FlexLayout.Layout model={model} factory={factory} />;
};

export default App;
