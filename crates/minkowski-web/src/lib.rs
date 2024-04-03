use minkowski::{extract_loops, reduced_convolution, Edge, Point};
use serde::Serialize;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

#[wasm_bindgen]
pub fn initialize() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
}

#[derive(Serialize)]
pub struct Minkowski {
    pub edges: Vec<Edge>,
    pub polygons: Vec<Vec<Point>>,
}

#[wasm_bindgen]
pub fn minkowski(xs0: Vec<f64>, ys0: Vec<f64>, xs1: Vec<f64>, ys1: Vec<f64>) -> JsValue {
    let a: Vec<Point> = xs0.into_iter().zip(ys0.into_iter()).collect();
    let b: Vec<Point> = xs1.into_iter().zip(ys1.into_iter()).collect();
    let convolved = reduced_convolution(&a, &b);
    serde_wasm_bindgen::to_value(&Minkowski {
        edges: convolved.iter().map(|e| (e.p.z, e.q.z)).collect(),
        polygons: extract_loops(&convolved)
            .into_iter()
            .map(|v| v.into_iter().map(|(p, _)| p).collect())
            .collect(),
    })
    .unwrap()
}
