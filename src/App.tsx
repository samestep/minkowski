import * as FlexLayout from "flexlayout-react";
import "flexlayout-react/style/light.css";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import "./App.css";
import { Req, Resp } from "./message";
import RawWorker from "./worker?worker";

class WasmWorker {
  private worker = new RawWorker();
  private working = false;
  private queue: Req | undefined = undefined;

  onmessage: ((r: Resp) => void) | undefined = undefined;

  constructor() {
    this.worker.onmessage = (e: MessageEvent<Resp>) => {
      if (this.queue === undefined) {
        this.working = false;
      } else {
        this.worker.postMessage(this.queue);
        this.queue = undefined;
      }
      if (this.onmessage !== undefined) {
        this.onmessage(e.data);
      }
    };
  }

  request(message: Req) {
    if (this.working) {
      this.queue = message;
    } else {
      this.working = true;
      this.worker.postMessage(message);
    }
  }
}

const worker = new WasmWorker();

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
  setData: (left: ImageData, right: ImageData) => void;
}) => {
  const [[x, y], setPos] = useState([100, 100]);
  const r = 100;

  return (
    <Canvas
      rect={props.rect}
      draw={(ctx, w, h) => {
        const drawLeft = () => {
          ctx.fillStyle = "#aaa";
          ctx.fillRect(w / 2 - x - r, h / 2 - y - r, 2 * r, 2 * r);
        };

        const drawRight = () => {
          ctx.fillStyle = "#555";
          ctx.beginPath();
          ctx.arc(w / 2 + x, h / 2 + y, r, 0, 2 * Math.PI);
          ctx.fill();
        };

        ctx.clearRect(0, 0, w, h);
        drawLeft();
        const left = ctx.getImageData(0, 0, w, h);

        ctx.clearRect(0, 0, w, h);
        drawRight();
        const right = ctx.getImageData(0, 0, w, h);

        ctx.clearRect(0, 0, w, h);
        drawLeft();
        drawRight();

        props.setData(left, right);
      }}
      deps={[x, y]}
      point={(w, h, x, y) => {
        setPos([x - w / 2, y - h / 2]);
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

      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
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

  useEffect(() => {
    worker.onmessage = ({ data, width, height }: Resp) => {
      setData(new ImageData(new Uint8ClampedArray(data), width, height));
    };
  });

  const factory = (node: FlexLayout.TabNode) => {
    const rect = node.getRect();
    switch (node.getComponent()) {
      case "input": {
        return (
          <Input
            rect={rect}
            setData={(left, right) => {
              worker.request({
                left: {
                  data: left.data.buffer,
                  width: left.width,
                  height: left.height,
                },
                right: {
                  data: right.data.buffer,
                  width: right.width,
                  height: right.height,
                },
              });
            }}
          />
        );
      }
      case "output": {
        return <Output rect={rect} data={data} />;
      }
    }
  };

  return <FlexLayout.Layout model={model} factory={factory} />;
};

export default App;
