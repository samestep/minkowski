.PHONY: all
all: check build

.PHONY: check
check: prettier tsc

.PHONY: build
build: dist

.PHONY: dev
dev: src/wasm node_modules

.cargo:
	cargo install --root=.cargo --version=0.2.84 wasm-bindgen-cli
	touch .cargo

wasm := target/wasm32-unknown-unknown/release/minkowski_web.wasm

$(wasm): crates/minkowski/Cargo.toml $(wildcard crates/minkowski/src/*) crates/minkowski-web/Cargo.toml $(wildcard crates/minkowski-web/src/*)
	cargo build --package=minkowski-web --target=wasm32-unknown-unknown --release

src/wasm: .cargo $(wasm)
	.cargo/bin/wasm-bindgen --target=web --out-dir=src/wasm $(wasm)
	touch src/wasm

node_modules: package.json yarn.lock
	yarn
	touch node_modules

.PHONY: prettier
prettier: node_modules
	npx prettier --check .

.PHONY: tsc
tsc: src/wasm node_modules
	npx tsc

dist: src/wasm node_modules
	npx vite build
