use anyhow::anyhow;
use minkowski::{extract_loops, reduced_convolution, Point};

fn main() -> anyhow::Result<()> {
    let (a, b): (Vec<Point>, Vec<Point>) = serde_json::from_str(&std::fs::read_to_string(
        std::env::args()
            .nth(1)
            .ok_or(anyhow!("expected filename"))?,
    )?)?;
    let convolved = reduced_convolution(&a, &b);
    let polygons = extract_loops(&convolved);
    println!("{:?}", polygons);
    Ok(())
}
