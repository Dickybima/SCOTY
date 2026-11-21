# SCOTY

Token launchpad on **Pons v2** (Robinhood Chain, chain ID 4663) — "Type it. Launch it."

- `index.html` — **Explore**: browse launched tokens (search, Trending / New / Market cap / Mine).
- `profile.html` — **Profile**: connected wallet's creator fees (claimable from the Pons V2 fee escrow), portfolio balance, token positions and SCOTY launches. Share a public profile with `profile.html?address=0x…`.
- `create.html` — **Create**: describe an idea → generate name, ticker, description & logo → pick chain → deploy with your wallet.

Static site, no build step. Run locally:

```bash
python3 -m http.server 8000
```

## How launching works

- **Connect Wallet** shows every installed wallet (EIP-6963: MetaMask, Rabby, OKX, Coinbase, Trust, Phantom, …) plus install links.
- **Create** calls `launchToken` on the Pons V2 launch factory `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` (Robinhood Chain, 4663), paying the factory's current `launchFee`. The token is live on Pons as soon as the tx confirms.
- Every SCOTY launch starts its `salt` with the marker `0x53434f5459` ("SCOTY", `launchTag` in `js/config.js`).
- After launch the user is sent to **Explore**, which lists **only SCOTY launches**: it scans the factory's transactions via the Robinhood Chain Blockscout API, decodes `launchToken` input and keeps the ones whose salt carries the marker. Launches from this browser are shown instantly before indexing.

Settings live in `js/config.js`. Factory interface source: [kickpadfamily/contract `IPonsV2.sol`](https://github.com/kickpadfamily/contract/blob/main/src/interfaces/IPonsV2.sol).

## Intro preloader

`js/preloader.js` shows the "Venom Vial" pixel-art intro (a vanilla-JS port of the `venom-vial-preloader` React component) the first time the site is opened in a browser session. The widow carries the SCOTY anchor logo on her back. Click, tap or press Enter to hurry it; add `?intro=1` to any URL to replay it.
