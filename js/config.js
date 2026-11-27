// ─────────────────────────────────────────────────────────────
// SCOTY on Elysium — launches go straight to Montra (montramarkets.xyz).
//
// Elysium is Kinetiq's Hyperliquid L2 (chain 99901, gas in HYPE). Montra opens
// every coin in its own Uniswap v4 pool through the Montra hook; the creator's
// first buy rides in the same transaction as the launch.
//
// Addresses: Montra LaunchFactory / LaunchRouter / hook as used by public
// integrations that launch and trade on montramarkets.xyz, the shared Uniswap v4
// PoolManager and StateView on Elysium, and the Montra registry DefiLlama reads.
// RPC and explorer from the Hyperlane chain registry. Verify before large launches.
// ─────────────────────────────────────────────────────────────
window.SCOTY_CONFIG = {
  protocol: "Montra",
  protocolUrl: "https://montramarkets.xyz",
  network: "Elysium",
  x: { handle: "Scotydotfun", url: "https://x.com/Scotydotfun" },

  chains: [
    {
      key: "elysium",
      name: "Elysium",
      chainId: 99901,
      symbol: "HYPE",
      coingeckoId: "hyperliquid",
      rpc: "https://rpc-elysium-mainnet.t.conduit.xyz",
      explorer: "https://elysium.kinetiq.xyz/explorer",
      txUrl: (h) => `https://elysium.kinetiq.xyz/explorer/transaction/${h}`,
      addressUrl: (a) => `https://elysium.kinetiq.xyz/explorer/address/${a}`,
      tokenUrl: (a) => `https://elysium.kinetiq.xyz/explorer/address/${a}`,
      montraTokenUrl: (a) => `https://montramarkets.xyz/token/${a}`,
      // Montra
      factory: "0x38d3ef3a06d18fa3286fb5deafe611be725fcd15",   // LaunchFactory
      router: "0xc6e9a8e1a99023b67067b8a3605403b8d7b3a157",    // LaunchRouter (buy / sell)
      lens: "0xb4c202910c40c3a83f6c55683460790aaec487d4",      // seedPreview for first-buy maths
      hook: "0x6b1216a40b65c83e9c9e18a562c446697b8cf8ec",      // Montra v4 hook
      registry: "0xF1E2FA75422F889e565F3142bdbf60B28dce2aa7",
      // Uniswap v4 on Elysium (shared PoolManager)
      poolManager: "0xe2e105d3f7209a9da11f83ccf3e7398a753823f1",
      stateView: "0x27eD73aE0652fdCf71d6793412A7525f32bE9dfE",
      factoryDeployBlock: 588508,
    },
  ],

  // On-chain marker: every launch from this site starts its salt with these bytes
  // ("SCOTY" in hex). Only launches carrying it are listed in Explore.
  launchTag: "0x53434f5459",

  // The official $SCOTY token, featured at the top of Explore ("" for none)
  officialToken: "0x3c1941ad71a81b840b103412f901a647b34178ac",

  // Hyperliquid HIP-3 dexes listed under "Stocks" on the Leverage page
  hlStockDexes: ["xyz"],

  // Where $SCOTY burns go (tokens sent here are gone for good); burns that reduce totalSupply count too
  burnAddresses: ["0x000000000000000000000000000000000000dEaD"],

  // Token addresses hidden from Explore and Profile (e.g. test launches)
  hiddenTokens: [],
  // Launches before this time (ms) are test launches and are hidden too (cleared 2026-11-27)
  hideLaunchedBefore: 1795775676000,

  // Supply every SCOTY launch mints (whole tokens). Montra allows 1e9 … 1e15.
  supply: 1000000000,
  // Montra's 'fees to holders' recipient
  holdersRecipient: "0x0000000000000000000000000000000000000001",

  // Montra LaunchFactory
  factoryAbi: [
    "function launch((string name, string symbol, string metadataURI, (string logo, string description, (string telegram, string twitter, string discord, string website, string extra) socials) profile, uint256 configId, uint256 supply, bytes32 salt, address[] feeRecipients, uint16[] feeShares, uint256 firstBuyAmount, uint256 firstBuyMinOut, (uint256 deadline, uint8 v, bytes32 r, bytes32 s) permit) p) payable returns (address token, bytes32 poolId)",
    "function configCount() view returns (uint256)",
    "function getConfig(uint256 id) view returns ((uint256 moduleSetId, address quote, uint256 baseSupply, int24 tickSpacing, int24 startTick, uint24 graduationTicks, uint24 lpLineTicks, uint24 totalFeePips, uint24 totalFeeMinPips, uint24 protocolFeePips, uint24 lpFeePips, uint24 earlyBuyFeeStartPips, uint32 earlyBuyFeeWindow, address liquidityPolicy, bool liquiditySealed, uint32 streamDuration, uint16 pushBountyBps, uint128 pushFloor, bool enabled, bool exists))",
    "function launchEnabled() view returns (bool)",
    "function launchFee() view returns (uint256)",
    "event TokenLaunched(address indexed token, address indexed creator, bytes32 indexed poolId, uint256 configId, address quote, bool quoteIsCurrency0, uint256 supply, int24 startTick, address feeRecipient, bool feeLocked, uint256 firstBuyIn, uint256 firstBuyOut)",
  ],
  lensAbi: [
    "function seedPreview(address factory, uint256 configId, uint256 supply) view returns (int24 startTick, (int24 tickLower, int24 tickUpper, uint128 liquidity) seed)",
  ],
  // Montra LaunchRouter: quote and swap on any pool of the shared PoolManager
  routerAbi: [
    "function quoteExactIn((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, bool zeroForOne, uint128 amountIn) returns (uint256)",
    "function swapExactIn(((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, bool zeroForOne, uint128 amountIn, uint128 minOut, address recipient, uint256 deadline) params) payable returns (uint256)",
  ],
  stateViewAbi: [
    "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    "function getLiquidity(bytes32 poolId) view returns (uint128)",
  ],
  poolManagerAbi: [
    "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)",
    "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
  ],
  tokenAbi: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ],
  // Custom errors so reverts read as words
  montraErrors: [
    "error FirstBuySlippage(uint256 out, uint256 minOut)",
    "error SupplyOutOfRange(uint256 supply)",
    "error SupplyNotWholeCoins(uint256 supply)",
  ],

  // Token metadata limits we enforce before signing
  limits: { name: 64, symbol: 16, description: 1000, social: 256 },

  // Vercel functions
  uploadUrl: "/api/upload",       // images and metadata JSON → Vercel Blob
  launchesUrl: "/api/launches",   // SCOTY launch index (GET list, POST {tx} to register)

  // Wallets offered in the connect dialog when they are not installed
  wallets: [
    { name: "MetaMask", rdns: "io.metamask", url: "https://metamask.io/download/" },
    { name: "Rabby", rdns: "io.rabby", url: "https://rabby.io/" },
    { name: "OKX Wallet", rdns: "com.okex.wallet", url: "https://www.okx.com/web3" },
    { name: "Coinbase Wallet", rdns: "com.coinbase.wallet", url: "https://www.coinbase.com/wallet/downloads" },
    { name: "Trust Wallet", rdns: "com.trustwallet.app", url: "https://trustwallet.com/download" },
    { name: "Phantom", rdns: "app.phantom", url: "https://phantom.com/download" },
  ],
};
