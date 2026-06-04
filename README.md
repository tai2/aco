# aco

A TypeScript CLI scaffold (subcommand-capable). This README will be expanded as functionality lands.

## Install

```sh
npm i -g aco
```

Or run without installing:

```sh
npx aco --help
```

## Usage

```sh
aco init
aco config set <key> <value>
aco config get <key>
aco --help
aco config --help
```

## Development

Tool versions (Node, pnpm) are pinned in `mise.toml` — install [mise](https://mise.jdx.dev) and run `mise install` to match.

```sh
pnpm install
pnpm dev -- --help         # run the CLI via tsx watch
pnpm typecheck             # tsc --noEmit
pnpm test                  # vitest run
pnpm build                 # produce dist/cli.js via tsup
```

## License

MIT
