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
import init, { initialize, minkowski } from "./wasm/minkowski";

await init();
initialize();

const reducedConvolution = (
  a: vec.Vector2[],
  b: vec.Vector2[]
): [vec.Vector2, vec.Vector2][] => {
  const segments = minkowski(
    new Float64Array(a.map(([x]) => x)),
    new Float64Array(a.map(([, y]) => y)),
    new Float64Array(b.map(([x]) => x)),
    new Float64Array(b.map(([, y]) => y))
  );
  const { xs, ys } = segments;
  segments.free();
  const result: [vec.Vector2, vec.Vector2][] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i += 2) {
    result.push([
      [xs[i], ys[i]],
      [xs[i + 1], ys[i + 1]],
    ]);
  }
  return result;
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

  const rightPoints = [
    useMovablePoint([1.6, 0.3], rightColor),
    useMovablePoint([0.4, 0.3], rightColor),
    useMovablePoint([0, 1.4], rightColor),
    useMovablePoint([-0.4, 0.3], rightColor),
    useMovablePoint([-1.6, 0.3], rightColor),
    useMovablePoint([-0.5, -0.2], rightColor),
    useMovablePoint([-1, -1.2], rightColor),
    useMovablePoint([0, -0.5], rightColor),
    useMovablePoint([1, -1.2], rightColor),
    useMovablePoint([0.5, -0.2], rightColor),
  ];

  const leftPoints = rightPoints.map((mp) =>
    useMovablePoint(vec.rotate(mp.point, 0.1), leftColor)
  );

  const left = leftPoints.map((mp) => mp.point);
  const right = rightPoints.map((mp) => mp.point);

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
            {reducedConvolution(left, right).map(([a, b], i) => (
              <Line.Segment key={i} point1={a} point2={b} />
            ))}
          </Mafs>
        );
      }
    }
  };

  return <FlexLayout.Layout model={model} factory={factory} />;
};

export default App;
