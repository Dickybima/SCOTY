# SCOTY

Token launchpad on **Pons v2** (Robinhood Chain, chain ID 4663) — "Type it. Launch it."

- `index.html` — **Explore**: browse launched tokens (search, Trending / New / Market cap / Mine).
- `create.html` — **Create**: describe an idea → generate name, ticker, description & logo → pick chain → deploy with your wallet.

Static site, no build step. Run locally:

```bash
python3 -m http.server 8000
```

## How launching works

- **Connect Wallet** shows every installed wallet (EIP-6963: MetaMask, Rabby, OKX, Coinbase, Trust, Phantom, …) plus install links.
- **Create** calls `launchToken` on the Pons V2 launch factory `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` (Robinhood Chain, 4663), paying the factory's current `launchFee`. The token is live on Pons as soon as the tx confirms.
- After launch the user is sent to **Explore**, which lists launches read from the factory via the Robinhood Chain Blockscout API, merged with launches made from this browser so a new token shows instantly.

Settings live in `js/config.js`. Factory interface source: [kickpadfamily/contract `IPonsV2.sol`](https://github.com/kickpadfamily/contract/blob/main/src/interfaces/IPonsV2.sol).
