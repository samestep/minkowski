use wasm_bindgen::prelude::wasm_bindgen;

type Point = (f64, f64);
type Edge = (Point, Point);

fn add((x0, y0): Point, (x1, y1): Point) -> Point {
    (x0 + x1, y0 + y1)
}

fn sub((x0, y0): Point, (x1, y1): Point) -> Point {
    (x0 - x1, y0 - y1)
}

fn cross((x0, y0): Point, (x1, y1): Point) -> f64 {
    x0 * y1 - x1 * y0
}

fn vector((v, w): Edge) -> Point {
    sub(w, v)
}

fn before(p: &[Point], i: usize) -> Edge {
    (if i == 0 { p[p.len() - 1] } else { p[i - 1] }, p[i])
}

fn after(p: &[Point], i: usize) -> Edge {
    (p[i], p[(i + 1) % p.len()])
}

fn is_compatible_convex(p: &[Point], i: usize, v: Point) -> bool {
    let u = vector(before(p, i));
    let w = vector(after(p, i));
    cross(u, w) >= 0. && cross(u, v) >= 0. && cross(v, w) >= 0.
}

fn reduced_convolution(a: Vec<Point>, b: Vec<Point>) -> Vec<Edge> {
    let mut c = vec![];
    for i in 0..a.len() {
        for (j, &q) in b.iter().enumerate() {
            let e = after(&a, i);
            if is_compatible_convex(&b, j, vector(e)) {
                let (p0, p1) = e;
                c.push((add(p0, q), add(p1, q)));
            }
        }
    }
    for (i, &p) in a.iter().enumerate() {
        for j in 0..b.len() {
            let e = after(&b, j);
            if is_compatible_convex(&a, i, vector(e)) {
                let (q0, q1) = e;
                c.push((add(p, q0), add(p, q1)));
            }
        }
    }
    c
}

#[wasm_bindgen]
pub fn initialize() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
}

#[wasm_bindgen(getter_with_clone)]
pub struct Segments {
    pub xs: Vec<f64>,
    pub ys: Vec<f64>,
}

#[wasm_bindgen]
pub fn minkowski(xs0: Vec<f64>, ys0: Vec<f64>, xs1: Vec<f64>, ys1: Vec<f64>) -> Segments {
    let a = xs0.into_iter().zip(ys0.into_iter()).collect();
    let b = xs1.into_iter().zip(ys1.into_iter()).collect();
    let (xs, ys) = reduced_convolution(a, b)
        .into_iter()
        .flat_map(|(v, w)| [v, w])
        .unzip();
    Segments { xs, ys }
}
