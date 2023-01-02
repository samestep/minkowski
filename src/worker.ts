import { Req, Resp } from "./message";
import init, { Image, initialize, minkowski_diff } from "./wasm/minkowski";

const ready = init().then(() => {
  initialize();
});

const respond = (message: Resp) => postMessage(message);

onmessage = async ({ data: { left, right } }: MessageEvent<Req>) => {
  await ready;
  const diff = minkowski_diff(
    new Image(new Uint8Array(left.data), left.width, left.height),
    new Image(new Uint8Array(right.data), right.width, right.height)
  );
  const { width, height } = diff;
  const data = Image.get_data(diff).buffer;
  respond({ data, width, height });
};
