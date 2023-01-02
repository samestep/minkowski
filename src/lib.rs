use fft2d::slice::{fft_2d, ifft_2d};
use num_complex::Complex;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub fn convolve(bytes: Vec<u8>, width: usize, height: usize) -> Vec<u8> {
    let mut buffer: Vec<_> = bytes
        .into_iter()
        .skip(3)
        .step_by(4)
        .map(|a| Complex {
            re: if a == 0 { 0. } else { 1. },
            im: 0.,
        })
        .collect();
    fft_2d(width, height, &mut buffer);
    for i in 0..buffer.len() {
        buffer[i] = buffer[i] * buffer[i];
    }
    ifft_2d(height, width, &mut buffer);
    buffer
        .into_iter()
        .flat_map(|z| [0, 0, 0, if z.norm() < 0.5 { 0 } else { 255 }])
        .collect()
}
