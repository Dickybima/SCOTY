# SCOTY

Token launchpad on **Pons v2** — "Type it. Launch it."

- `index.html` — **Explore**: browse launched tokens (search, Trending / New / Market cap / Mine).
- `create.html` — **Create**: describe an idea → generate name, ticker, description & logo → pick chain → deploy with your wallet.

Static site, no build step. Run locally:

```bash
python3 -m http.server 8000
```

## Connecting Pons v2

Edit `js/config.js`:
- `chains[].factory` — Pons v2 factory contract address per chain
- `factoryAbi` — the real `createToken` signature and `TokenCreated` event
- `launchFee` — native value sent with the create call

While `factory` is empty, the site runs in **demo mode** (launches simulated and stored in the browser).
Explore currently shows sample tokens; connect a Pons v2 indexer/subgraph in `js/explore.js` to show real data.
