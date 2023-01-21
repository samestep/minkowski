use std::cmp::Ordering;

use serde::Serialize;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

type Point = (f64, f64);
type Edge = (Point, Point);

fn scale(t: f64, (x, y): Point) -> Point {
    (t * x, t * y)
}

fn add((x0, y0): Point, (x1, y1): Point) -> Point {
    (x0 + x1, y0 + y1)
}

fn sub((x0, y0): Point, (x1, y1): Point) -> Point {
    (x0 - x1, y0 - y1)
}

fn cross((x0, y0): Point, (x1, y1): Point) -> f64 {
    x0 * y1 - x1 * y0
}

/// compare the clockwise angle from `u` to `v` with the clockwise angle from `u` to `w`
fn cmp_clockwise_angle(u: Point, v: Point, w: Point) -> Ordering {
    if if cross(u, v) >= 0. {
        cross(u, w) <= 0. || cross(w, v) >= 0.
    } else {
        cross(u, w) <= 0. && cross(w, v) >= 0.
    } {
        Ordering::Greater
    } else {
        Ordering::Less
    }
}

fn vector((v, w): Edge) -> Point {
    sub(w, v)
}

fn intersection((a0, b0): Edge, (a1, b1): Edge) -> Option<(f64, f64, Point)> {
    let v0 = sub(b0, a0);
    let v1 = sub(b1, a1);
    let w = sub(a1, a0);
    let denom = cross(v0, v1);
    let t0 = cross(w, v1) / denom;
    let t1 = cross(w, v0) / denom;
    if 0. < t0 && t0 < 1. && 0. < t1 && t1 < 1. {
        Some((t0, t1, add(a0, scale(t0, v0))))
    } else {
        None
    }
}

fn before(p: &[Point], i: usize) -> Edge {
    (if i == 0 { p[p.len() - 1] } else { p[i - 1] }, p[i])
}

fn after(p: &[Point], i: usize) -> Edge {
    (p[i], p[(i + 1) % p.len()])
}

type Vert = (usize, usize);

/// a sum of an edge from one polygon with a vertex from the other polygon
#[derive(Clone, Copy)]
enum Conv {
    /// edge from first polygon, vertex from second polygon
    Left {
        /// index of initial vertex from first polygon
        i: usize,
        /// index of vertex from second polygon
        j: usize,
    },
    /// vertex from first polygon, edge from second polygon
    Right {
        /// index of vertex from first polygon
        i: usize,
        /// index of initial vertex from second polygon
        j: usize,
    },
}

impl Conv {
    fn tail(&self) -> Vert {
        match self {
            &Conv::Left { i, j } => (i, j),
            &Conv::Right { i, j } => (i, j),
        }
    }

    fn tip(&self, a: &[Point], b: &[Point]) -> Vert {
        match self {
            &Conv::Left { i, j } => ((i + 1) % a.len(), j),
            &Conv::Right { i, j } => (i, (j + 1) % b.len()),
        }
    }

    fn edge(&self, a: &[Point], b: &[Point]) -> Edge {
        let (i0, j0) = self.tail();
        let (i1, j1) = self.tip(a, b);
        (add(a[i0], b[j0]), add(a[i1], b[j1]))
    }
}

fn reduced_convolution(a: &[Point], b: &[Point]) -> Vec<Conv> {
    let mut edges = vec![];
    for i in 0..a.len() {
        let u = vector(before(&a, i));
        let w = vector(after(&a, i));
        // filter out reflex vertices
        if cross(u, w) >= 0. {
            for j in 0..b.len() {
                let v = vector(after(&b, j));
                // compatible
                if cross(u, v) >= 0. && cross(v, w) >= 0. {
                    edges.push(Conv::Right { i, j });
                }
            }
        }
    }
    for j in 0..b.len() {
        let u = vector(before(&b, j));
        let w = vector(after(&b, j));
        if cross(u, w) >= 0. {
            for i in 0..a.len() {
                let v = vector(after(&a, i));
                if cross(u, v) >= 0. && cross(v, w) >= 0. {
                    edges.push(Conv::Left { i, j });
                }
            }
        }
    }
    edges
}

/// post-intersection
enum Pseudovert {
    /// a sum of a vertex from each polygon
    Init(Vert),
    /// part of the first edge, starting at the intersection with the second
    Inter(Conv, Conv, Point),
}

fn orientable_loops(a: Vec<Point>, b: Vec<Point>, edges: Vec<Conv>) -> Vec<Vec<Point>> {
    let mut verts: Vec<Pseudovert> = edges.iter().map(|e| Pseudovert::Init(e.tail())).collect();
    let mut inters = vec![];
    let mut succ: Vec<Option<usize>> = edges
        .iter()
        .enumerate()
        .map(|(n0, &e0)| {
            let k0 = e0.tip(&a, &b);
            let v0 = vector(e0.edge(&a, &b));
            edges
                .iter()
                .enumerate()
                .filter_map(|(n1, &e1)| {
                    if k0 == e1.tail() {
                        return Some((n1, vector(e1.edge(&a, &b))));
                    }
                    if n0 < n1 {
                        if let Some((t0, t1, v)) = intersection(e0.edge(&a, &b), e1.edge(&a, &b)) {
                            let n2 = verts.len();
                            verts.push(Pseudovert::Inter(e0, e1, v));
                            let n3 = verts.len();
                            verts.push(Pseudovert::Inter(e1, e0, v));
                            inters.push((n0, t0, n1, n2, n3));
                            inters.push((n1, t1, n0, n3, n2));
                        }
                    }
                    None
                })
                .max_by(|&(_, v1), &(_, v2)| cmp_clockwise_angle(v0, v1, v2))
                .map(|(n1, _)| n1)
        })
        .collect();
    inters.sort_by(|x, y| x.partial_cmp(y).unwrap());
    succ.resize(verts.len(), None);
    let mut nint = 0;
    for (n0, &e0) in edges.iter().enumerate() {
        let v0 = vector(e0.edge(&a, &b));
        let mut n1 = n0;
        let n2 = succ[n0];
        while nint < inters.len() {
            let (n3, _, n4, n5, n6) = inters[nint];
            if n0 != n3 {
                break;
            }
            let v1 = vector(edges[n4].edge(&a, &b));
            succ[n1] = Some(if cross(v0, v1) >= 0. { n5 } else { n6 });
            n1 = n5;
            nint += 1;
        }
        succ[n1] = n2;
    }
    let mut loops = vec![];
    let mut id = vec![None; verts.len()];
    for n0 in 0..verts.len() {
        if id[n0] != None {
            continue;
        }
        let mut s = Some(n0);
        while let Some(n1) = s {
            if id[n1] != None {
                break;
            }
            id[n1] = Some(n0);
            s = succ[n1];
        }
        if let Some(n1) = s {
            if id[n1] == Some(n0) {
                let mut loop_edges = vec![];
                let mut n2 = n1;
                loop {
                    loop_edges.push(match verts[n2] {
                        Pseudovert::Init((i, j)) => add(a[i], b[j]),
                        Pseudovert::Inter(_, _, v) => v,
                    });
                    n2 = succ[n2].unwrap();
                    if n2 == n1 {
                        break;
                    }
                }
                loops.push(loop_edges);
            }
        }
    }
    loops
}

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
    let edges = convolved.iter().map(|e| e.edge(&a, &b)).collect();
    let polygons = orientable_loops(a, b, convolved);
    serde_wasm_bindgen::to_value(&Minkowski { edges, polygons }).unwrap()
}
