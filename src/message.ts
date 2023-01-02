/** image */
export interface Im {
  data: ArrayBuffer;
  width: number;
  height: number;
}

/** request */
export interface Req {
  left: Im;
  right: Im;
}

/** response */
export interface Resp extends Im {}
