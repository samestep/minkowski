import * as FlexLayout from "flexlayout-react";
import "flexlayout-react/style/light.css";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import "./App.css";

const Canvas = (props: {
  rect: FlexLayout.Rect;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  deps?: any[];
  point?: (w: number, h: number, x: number, y: number) => void;
}) => {
  const ratio = window.devicePixelRatio;
  const { x, y, width, height } = props.rect;
  const w = width * ratio;
  const h = height * ratio;

  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(
    () => {
      const canvas = ref.current;
      if (canvas === null) {
        throw Error("canvas is null");
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx === null) {
        throw Error("context is null");
      }

      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      props.draw(ctx, w, h);
    },
    props.deps === undefined ? undefined : [ratio, width, height, ...props.deps]
  );

  const point = ({
    clientX,
    clientY,
  }: {
    clientX: number;
    clientY: number;
  }) => {
    if (props.point !== undefined) {
      props.point(w, h, (clientX - x) * ratio, (clientY - y) * ratio);
    }
  };

  return (
    <canvas
      ref={ref}
      style={{ touchAction: "none" }}
      onMouseDown={point}
      onMouseMove={(e) => {
        if ((e.buttons & 1) != 0) point(e);
      }}
      onTouchStart={(e) => point(e.touches[0])}
      onTouchMove={(e) => point(e.touches[0])}
    />
  );
};

const Input = (props: {
  rect: FlexLayout.Rect;
  setData: (data: ImageData) => void;
}) => {
  const [radius, setRadius] = useState(100);

  return (
    <Canvas
      rect={props.rect}
      draw={(ctx, w, h) => {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius, 0, 2 * Math.PI);
        ctx.fill();

        props.setData(ctx.getImageData(0, 0, w, h));
      }}
      deps={[radius]}
      point={(w, h, x, y) => {
        setRadius(Math.sqrt((x - w / 2) ** 2 + (y - h / 2) ** 2));
      }}
    />
  );
};

const Output = (props: { rect: FlexLayout.Rect; data: ImageData }) => (
  <Canvas
    rect={props.rect}
    draw={(ctx, w, h) => {
      ctx.putImageData(
        props.data,
        (w - props.data.width) / 2,
        (h - props.data.height) / 2
      );
    }}
  />
);

const model = FlexLayout.Model.fromJson({
  global: {},
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

  const [data, setData] = useState(new ImageData(1, 1));

  const factory = (node: FlexLayout.TabNode) => {
    const rect = node.getRect();
    switch (node.getComponent()) {
      case "input": {
        return <Input rect={rect} setData={setData} />;
      }
      case "output": {
        return <Output rect={rect} data={data} />;
      }
    }
  };

  return <FlexLayout.Layout model={model} factory={factory} />;
};

export default App;
