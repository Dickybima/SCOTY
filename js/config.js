// ─────────────────────────────────────────────────────────────
// SCOTY ✕ Pons v2 configuration
// Fill in the real Pons v2 factory address + ABI for each chain.
// While `factory` is empty, SCOTY runs in DEMO mode: launches are
// simulated and saved in this browser only (no transaction sent).
// ─────────────────────────────────────────────────────────────
window.SCOTY_CONFIG = {
  protocol: "Pons v2",

  chains: [
    {
      key: "arc",
      name: "Arc Testnet",
      chainId: 5042002,
      symbol: "USDC",
      rpc: "https://rpc.testnet.arc.network",
      explorer: "https://testnet.arcscan.app",
      factory: "", // ← Pons v2 factory address on this chain
    },
    {
      key: "base",
      name: "Base",
      chainId: 8453,
      symbol: "ETH",
      rpc: "https://mainnet.base.org",
      explorer: "https://basescan.org",
      factory: "",
    },
  ],

  // Pons v2 factory ABI — replace with the real one.
  // createToken must return / emit the new token address.
  factoryAbi: [
    "function createToken(string name, string symbol, string metadataURI) payable returns (address token)",
    "event TokenCreated(address indexed token, address indexed creator, string name, string symbol)",
  ],

  // Optional ETH/native value sent with createToken (as a string, in ether units)
  launchFee: "0",
};
