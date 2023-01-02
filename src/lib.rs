use fft2d::slice::{fft_2d, ifft_2d};
use num_complex::{Complex, Complex64};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub fn initialize() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
}

#[wasm_bindgen]
pub struct Image {
    data: Vec<u8>,
    pub width: usize,
    pub height: usize,
}

#[wasm_bindgen]
impl Image {
    #[wasm_bindgen(constructor)]
    pub fn new(data: Vec<u8>, width: usize, height: usize) -> Image {
        Image {
            data,
            width,
            height,
        }
    }

    pub fn get_data(image: Image) -> Vec<u8> {
        image.data
    }
}

fn encode(data: Vec<u8>) -> impl DoubleEndedIterator<Item = Complex64> {
    data.into_iter()
        .skip(3)
        .step_by(4)
        .map(|a| Complex::new(if a == 0 { 0. } else { 1. }, 0.))
}

#[wasm_bindgen]
pub fn minkowski_diff(left: Image, right: Image) -> Image {
    assert_eq!((left.width, left.height), (right.width, right.height));
    let width = left.width.max(right.width);
    let height = left.height.max(right.height);
    let mut buffer: Vec<_> = encode(left.data).collect();
    let mut other: Vec<_> = encode(right.data).rev().collect();
    fft_2d(width, height, &mut buffer);
    fft_2d(width, height, &mut other);
    for i in 0..buffer.len() {
        buffer[i] *= other[i];
    }
    ifft_2d(height, width, &mut buffer);
    let mut data = vec![0; width * height * 4];
    for y in 0..height {
        for x in 0..width {
            if buffer[y * width + x].norm() > 0.5 {
                data[(((y + height / 2) % height) * width + (x + width / 2) % width) * 4 + 3] = 255;
            }
        }
    }
    Image {
        data,
        width,
        height,
    }
}
