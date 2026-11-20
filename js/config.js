// ─────────────────────────────────────────────────────────────
// SCOTY ✕ Pons v2 on Robinhood Chain
// Fill in the real Pons v2 launch-factory address + ABI below.
// While `factory` is empty, SCOTY runs in DEMO mode: launches are
// simulated and saved in this browser only (no transaction sent).
//
// Verify addresses from official Pons sources before going live, e.g.
// https://docs.bitquery.io/docs/blockchain/robinhood/pons-api/
// ─────────────────────────────────────────────────────────────
window.SCOTY_CONFIG = {
  protocol: "Pons v2",
  network: "Robinhood Chain",

  chains: [
    {
      key: "robinhood",
      name: "Robinhood Chain",
      chainId: 4663,
      symbol: "ETH",
      rpc: "https://rpc.mainnet.chain.robinhood.com",
      explorer: "https://robinhoodchain.blockscout.com",
      factory: "", // ← Pons v2 launch factory address (mainnet)
    },
    {
      key: "robinhood-testnet",
      name: "Robinhood Testnet",
      chainId: 46630,
      symbol: "ETH",
      rpc: "https://rpc.testnet.chain.robinhood.com",
      explorer: "https://explorer.testnet.chain.robinhood.com",
      factory: "", // ← Pons v2 launch factory address (testnet), if any
    },
  ],

  // Pons v2 launch-factory ABI — PLACEHOLDER, replace with the real one.
  // The create call must emit an event carrying the new token address.
  factoryAbi: [
    "function createToken(string name, string symbol, string metadataURI) payable returns (address token)",
    "event TokenCreated(address indexed token, address indexed creator, string name, string symbol)",
  ],

  // Native ETH sent with the create call (e.g. launch fee / initial buy), in ether units
  launchFee: "0",
};
