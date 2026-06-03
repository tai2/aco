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

```sh
npm install
npm run dev -- --help      # run the CLI via tsx watch
npm run typecheck          # tsc --noEmit
npm run test               # vitest run
npm run build              # produce dist/cli.js via tsup
```

## License

MIT
