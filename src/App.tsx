import { javascript } from "@codemirror/lang-javascript";
import interact from "@replit/codemirror-interact";
import CodeMirror from "@uiw/react-codemirror";
import * as FlexLayout from "flexlayout-react";
import { Coordinates, Line, Mafs, Point, Polygon, Theme, vec } from "mafs";
import { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";
import "./App.css";
import example from "./example.js?raw";
import init, { initialize, minkowski } from "./wasm/minkowski_web";

await init();
initialize();

interface MinkowskiOutput {
  edges: [vec.Vector2, vec.Vector2][];
  polygons: vec.Vector2[][];
}

const minkowskiSum = (a: vec.Vector2[], b: vec.Vector2[]): MinkowskiOutput =>
  minkowski(
    new Float64Array(a.map(([x]) => x)),
    new Float64Array(a.map(([, y]) => y)),
    new Float64Array(b.map(([x]) => x)),
    new Float64Array(b.map(([, y]) => y))
  );

interface CalculateOutput extends MinkowskiOutput {
  left: vec.Vector2[];
  right: vec.Vector2[];
}

const calculate = (code: string): CalculateOutput => {
  let left: vec.Vector2[] = [];
  let right: vec.Vector2[] = [];
  try {
    const [l, r] = new Function(code)() as [vec.Vector2[], vec.Vector2[]];
    left = l.map(([x, y]) => [Number(x), Number(y)]);
    right = r.map(([x, y]) => [Number(x), Number(y)]);
  } catch (e) {
    console.error(e);
  }
  let edges: [vec.Vector2, vec.Vector2][] = [];
  let polygons: vec.Vector2[][] = [];
  try {
    ({ edges, polygons } = minkowskiSum(left, right));
  } catch (e) {
    console.error(e);
  }
  return { left, right, edges, polygons };
};

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
        children: [{ type: "tab", name: "code", component: "code" }],
      },
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

  const [code, setCode] = useState(example);

  const { left, right, edges, polygons } = calculate(code);

  const factory = (node: FlexLayout.TabNode) => {
    const { width, height } = node.getRect();
    switch (node.getComponent()) {
      case "code": {
        return (
          <CodeMirror
            width={`${width}px`}
            height={`${height}px`}
            theme="dark"
            extensions={[
              javascript(),
              interact({
                // https://github.com/replit/codemirror-interact/blob/a0aef2b37e628bc196992b69529afad530d40116/dev/index.ts
                rules: [
                  {
                    regexp: /-?\b\d+\.?\d*\b/g,
                    cursor: "ew-resize",
                    onDrag: (text, setText, e) => {
                      // TODO: size aware
                      // TODO: small interval with shift key?
                      const newVal = Number(text) + e.movementX;
                      if (isNaN(newVal)) return;
                      setText(newVal.toString());
                    },
                  },
                  // kaboom vec2 slider
                  {
                    regexp: /vec2\(-?\b\d+\.?\d*\b\s*(,\s*-?\b\d+\.?\d*\b)?\)/g,
                    cursor: "move",
                    onDrag: (text, setText, e) => {
                      const res =
                        /vec2\((?<x>-?\b\d+\.?\d*\b)\s*(,\s*(?<y>-?\b\d+\.?\d*\b))?\)/.exec(
                          text
                        );
                      let x = Number(res?.groups?.x);
                      let y = Number(res?.groups?.y);
                      if (isNaN(x)) return;
                      if (isNaN(y)) y = x;
                      setText(`vec2(${x + e.movementX}, ${y - e.movementY})`);
                    },
                  },
                ],
              }),
            ]}
            onChange={(value) => {
              setCode(value);
            }}
            value={example}
          />
        );
      }
      case "input": {
        return (
          <Mafs width={width} height={height} zoom={true}>
            <Coordinates.Cartesian />
            <Polygon points={left} {...leftColor} />
            <Polygon points={right} {...rightColor} />
            {left.map(([x, y], i) => (
              <Point key={i} x={x} y={y} {...leftColor} />
            ))}
            {right.map(([x, y], i) => (
              <Point key={i} x={x} y={y} {...rightColor} />
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
