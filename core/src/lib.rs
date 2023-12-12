use std::cmp::Ordering;

#[derive(PartialEq, Eq, PartialOrd, Ord)]
enum Region {
    NegativeY,

    /// with zero y
    NonnegativeX,

    PositiveY,

    /// with zero y
    NegativeX,
}

/// comparison should agree with `atan2`, except that all non-finite values are considered equal to
/// each other and less than everything else
#[derive(Clone)]
struct Angle(f64, f64);

impl Angle {
    /// returns `None` unless `x` and `y` are both finite
    fn region(&self) -> Option<Region> {
        use Ordering::*;
        use Region::*;
        let &Angle(x, y) = self;
        if x.is_finite() && y.is_finite() {
            // all finite values can be compared
            Some(match y.partial_cmp(&0.).unwrap() {
                Less => NegativeY,
                Equal => {
                    if x < 0. {
                        NegativeX
                    } else {
                        NonnegativeX
                    }
                }
                Greater => PositiveY,
            })
        } else {
            None
        }
    }
}

impl Ord for Angle {
    fn cmp(&self, other: &Self) -> Ordering {
        let region = self.region();
        region.cmp(&other.region()).then_with(|| {
            if region.is_none() {
                Ordering::Equal
            } else {
                let &Angle(x0, y0) = self;
                let &Angle(x1, y1) = other;
                // guaranteed not to panic, because no multiplication of finite values can give NaN
                (y0 * x1).partial_cmp(&(x0 * y1)).unwrap()
            }
        })
    }
}

impl PartialOrd for Angle {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl PartialEq for Angle {
    fn eq(&self, other: &Self) -> bool {
        self.partial_cmp(other) == Some(Ordering::Equal)
    }
}

impl Eq for Angle {}

pub type Point = (f64, f64);
pub type Edge = (Point, Point);

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

/// sum of one vertex from each polygon
pub struct Vert {
    /// index of vertex from first polygon
    i: usize,
    /// index of vertex from second polygon
    j: usize,
    /// coordinates
    pub z: Point,
}

/// convolution of edge from one polygon with vertex from other polygon
pub struct Conv {
    /// start
    pub p: Vert,
    /// end
    pub q: Vert,
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

pub fn reduced_convolution(a: &[Point], b: &[Point]) -> Vec<Conv> {
    let mut edges = vec![];
    convolve(a, b, &mut edges, |i, j, z| Vert { i, j, z });
    convolve(b, a, &mut edges, |i, j, z| Vert { i: j, j: i, z });
    edges
}

/// post-intersection
#[derive(Clone, Eq, Ord, PartialEq, PartialOrd)]
enum Pseudovert {
    /// sum of one vertex from each polygon
    Given { i: usize, j: usize },
    /// intersection of two indexed edges
    Steiner { m: usize, n: usize },
}

pub fn extract_loops(edges: &[Conv]) -> Vec<Vec<Point>> {
    let mut tips: Vec<Point> = edges.iter().map(|e| e.q.z).collect();
    let mut inters = vec![];
    for (n0, e0) in edges.iter().enumerate() {
        let Vert { i: i00, j: j00, .. } = e0.p;
        let Vert { i: i01, j: j01, .. } = e0.q;

        for n1 in n0 + 1..edges.len() {
            let e1 = &edges[n1];
            let Vert { i: i10, j: j10, .. } = e1.p;
            let Vert { i: i11, j: j11, .. } = e1.q;

            // exclude edges that share a vertex, and edges that came from the same polygon and were
            // translated by the same vertex from the other polygon, because we assume that the
            // input polygons were both simple
            if !((i00 == i10 && (j00 == j10 || (i00, i10) == (i01, i11)))
                || (i01, j01) == (i10, j10)
                || (j00 == j11 && (i00 == i11 || (j00, j10) == (j01, j11)))
                || (i01, j01) == (i11, j11))
            {
                let v = sub(e1.p.z, e0.p.z);
                let denom = cross(e0.v, e1.v);
                let t0 = cross(v, e1.v) / denom;
                let t1 = cross(v, e0.v) / denom;
                if 0. <= t0 && t0 <= 1. && 0. <= t1 && t1 <= 1. {
                    let w = (cross(e0.p.z, e0.q.z), cross(e1.p.z, e1.q.z));
                    let z = (
                        cross((e0.v.0, e1.v.0), w) / denom,
                        cross((e0.v.1, e1.v.1), w) / denom,
                    );
                    inters.push((n0, t0, n0, n1, tips.len()));
                    tips.push(z);
                    inters.push((n1, t1, n0, n1, tips.len()));
                    tips.push(z);
                }
            }
        }
    }

    // the only floating point numbers we put into the vector are the intersection parameters, which
    // we guarantee to be between 0 and 1, so this will never panic
    inters.sort_unstable_by(|foo, bar| foo.partial_cmp(bar).unwrap());

    let mut nodes = Vec::with_capacity(tips.len() * 2);
    let mut n_inter = 0;
    for (n0, e0) in edges.iter().enumerate() {
        let (x, y) = e0.v;
        let angle_out = Angle(x, y);
        let angle_in = Angle(-x, -y);

        let mut start = Pseudovert::Given {
            i: e0.p.i,
            j: e0.p.j,
        };

        while n_inter < inters.len() {
            let (n0_inter, _, m, n, n1) = inters[n_inter];
            if n0_inter != n0 {
                break;
            }

            let end = Pseudovert::Steiner { m, n };
            nodes.push((start, angle_out.clone(), true, n1));
            nodes.push((end.clone(), angle_in.clone(), false, n1));

            start = end;

            n_inter += 1;
        }

        let end = Pseudovert::Given {
            i: e0.q.i,
            j: e0.q.j,
        };
        nodes.push((start, angle_out, true, n0));
        nodes.push((end, angle_in, false, n0));
    }

    nodes.sort_unstable();
    let advance = |mut k: usize| {
        let (p0, _, _, _) = &nodes[k];
        if k == nodes.len() - 1 || {
            let (p1, _, _, _) = &nodes[k + 1];
            *p1 != *p0
        } {
            while k > 0 {
                k -= 1;
                let (p1, _, _, _) = &nodes[k];
                if *p1 != *p0 {
                    return k + 1;
                }
            }
            0
        } else {
            k + 1
        }
    };

    // we initialize this with invalid indices so that it will later panic if we haven't replaced
    // all its contents, which we should always do
    let mut indices = vec![nodes.len(); tips.len()];
    for (k, &(_, _, leaving, n)) in nodes.iter().enumerate() {
        if !leaving {
            indices[n] = k;
        }
    }

    let mut loops = vec![];
    let mut id = vec![None; tips.len()];
    let mut stack = vec![];
    for (n0, &k0) in indices.iter().enumerate() {
        if id[n0].is_some() {
            continue;
        }
        stack.push((n0, k0));
        id[n0] = Some(n0);
        while let Some((n1, k)) = stack.last_mut() {
            *k = advance(*k);
            if *k == indices[*n1] {
                stack.pop();
                continue;
            }
            let (_, _, leaving, n2) = nodes[*k];
            if !leaving {
                continue;
            }
            stack.push((n2, indices[n2]));
            if id[n2].is_some() {
                break;
            }
            id[n2] = Some(n0);
        }
        if let Some(&(n1, _)) = stack.last() {
            let start = stack.iter().position(|&(n, _)| n == n1).unwrap();
            let end = stack.len() - 1;
            if start < end {
                loops.push(stack[start..end].iter().map(|&(n, _)| tips[n]).collect());
            }
            stack.clear();
        }
    }

    loops
}
