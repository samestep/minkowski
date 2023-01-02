import { Req, Resp } from "./message";
import init, { convolve } from "./wasm/minkowski";

const ready = init();

const respond = (message: Resp) => postMessage(message);

onmessage = async ({ data: { buffer, width, height } }: MessageEvent<Req>) => {
  await ready;
  respond({
    buffer: convolve(new Uint8Array(buffer), width, height).buffer,
    width,
    height,
  });
};
