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

fn pos_cross((x0, y0): Point, (x1, y1): Point) -> bool {
    x0 * y1 >= x1 * y0
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

/// sum of one vertex from each polygon
struct Vert {
    /// index of vertex from first polygon
    i: usize,
    /// index of vertex from second polygon
    j: usize,
    /// coordinates
    z: Point,
}

/// convolution of edge from one polygon with vertex from other polygon
struct Conv {
    /// start
    p: Vert,
    /// end
    q: Vert,
    /// delta
    v: Point,
}

fn convolve(
    a: &[Point],
    b: &[Point],
    edges: &mut Vec<Conv>,
    make_vert: impl Fn(usize, usize, Point) -> Vert,
) {
    let mut i0 = 0;
    let mut a0 = a[i0];
    let mut before = sub(a0, a[a.len() - 1]);

    let mut walk_b = |i1| {
        let a1 = a[i1];
        let after = sub(a1, a0);

        // filter out reflex vertices
        if pos_cross(before, after) {
            let mut j0 = 0;
            let mut b0 = b[j0];
            let mut z0 = add(a0, b0);

            let mut check = |j1| {
                let b1 = b[j1];
                let z1 = add(a0, b1);
                let v = sub(b1, b0);

                // compatible
                if pos_cross(before, v) && pos_cross(v, after) {
                    edges.push(Conv {
                        p: make_vert(i0, j0, z0),
                        q: make_vert(i0, j1, z1),
                        v,
                    });
                }

                j0 = j1;
                b0 = b1;
                z0 = z1;
            };

            for j1 in 1..b.len() {
                check(j1);
            }
            check(0);
        }

        i0 = i1;
        a0 = a1;
        before = after;
    };

    for i1 in 1..a.len() {
        walk_b(i1);
    }
    walk_b(0);
}

fn reduced_convolution(a: &[Point], b: &[Point]) -> Vec<Conv> {
    let mut edges = vec![];
    convolve(a, b, &mut edges, |i, j, z| Vert { i, j, z });
    convolve(b, a, &mut edges, |i, j, z| Vert { i: j, j: i, z });
    edges
}

/// post-intersection
enum Pseudovert<'a> {
    /// a sum of a vertex from each polygon
    Init(&'a Vert),
    /// part of the first edge, starting at the intersection with the second
    Inter(&'a Conv, &'a Conv, Point),
}

fn extract_loops(edges: &[Conv]) -> Vec<Vec<Point>> {
    let mut verts: Vec<Pseudovert> = edges.iter().map(|e| Pseudovert::Init(&e.p)).collect();
    let mut inters = vec![];
    let mut succ: Vec<Option<usize>> = edges
        .iter()
        .enumerate()
        .map(|(n0, e0)| {
            let k0 = (e0.q.i, e0.q.j);
            edges
                .iter()
                .enumerate()
                .filter_map(|(n1, e1)| {
                    if k0 == (e1.p.i, e1.p.j) {
                        return Some((n1, e1.v));
                    }
                    if n0 < n1 {
                        if let Some((t0, t1, v)) = intersection((e0.p.z, e0.q.z), (e1.p.z, e1.q.z))
                        {
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
                .max_by(|&(_, v1), &(_, v2)| cmp_clockwise_angle(e0.v, v1, v2))
                .map(|(n1, _)| n1)
        })
        .collect();
    inters.sort_by(|x, y| x.partial_cmp(y).unwrap());
    succ.resize(verts.len(), None);
    let mut nint = 0;
    for (n0, e0) in edges.iter().enumerate() {
        let mut n1 = n0;
        let n2 = succ[n0];
        while nint < inters.len() {
            let (n3, _, n4, n5, n6) = inters[nint];
            if n0 != n3 {
                break;
            }
            succ[n1] = Some(if pos_cross(e0.v, edges[n4].v) { n5 } else { n6 });
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
                        Pseudovert::Init(&Vert { z, .. }) => z,
                        Pseudovert::Inter(_, _, z) => z,
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
    serde_wasm_bindgen::to_value(&Minkowski {
        edges: convolved.iter().map(|e| (e.p.z, e.q.z)).collect(),
        polygons: extract_loops(&convolved),
    })
    .unwrap()
}
