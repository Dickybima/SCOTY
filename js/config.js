// ─────────────────────────────────────────────────────────────
// SCOTY on Robinhood Chain — launches go straight to the Pons V2
// launch factory, so every token is live on Pons the moment it is
// created and shows up in Explore.
//
// Factory address and interface taken from Kickpad's open-source
// integration (github.com/kickpadfamily/contract, src/interfaces/IPonsV2.sol)
// and Pons V2 docs. Verify before large launches.
// ─────────────────────────────────────────────────────────────
window.SCOTY_CONFIG = {
  protocol: "Pons v2",
  network: "Robinhood Chain",
  x: { handle: "Scotydotfun", url: "https://x.com/Scotydotfun" },

  chains: [
    {
      key: "robinhood",
      name: "Robinhood Chain",
      chainId: 4663,
      symbol: "ETH",
      rpc: "https://rpc.mainnet.chain.robinhood.com",
      explorer: "https://robinhoodchain.blockscout.com",
      explorerApi: "https://robinhoodchain.blockscout.com/api/v2",
      factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e", // Pons V2 launch factory
      launchConfigId: 0,
      feeEscrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e", // Pons V2 creator-fee escrow
    },
  ],

  // On-chain marker: every launch from this site starts its salt with these bytes
  // ("SCOTY" in hex). Explore only lists launches carrying this marker.
  launchTag: "0x53434f5459",

  // Pons V2 metadata caps (PonsV2LaunchDeployer, in bytes). Longer strings
  // revert the launch with MetadataTooLong.
  limits: { name: 64, symbol: 16, logo: 512, description: 2048, social: 256 },

  // Custom errors Pons V2 contracts can revert with, so failures are readable
  ponsErrors: [
    "error AlreadyGraduated()",
    "error CombinedFeeTooHigh()",
    "error CreatorTaxTooHigh()",
    "error CurveGraduated()",
    "error CurveNotQuotable()",
    "error ExemptionListTooLong()",
    "error FeeTransferFailed()",
    "error InsufficientInputAmount()",
    "error InsufficientLiquidity()",
    "error InsufficientOutputAmount()",
    "error InvalidBasisPoints()",
    "error InvalidBps()",
    "error InvalidLaunchConfigId()",
    "error InvalidLaunchEconomics()",
    "error InvalidTokenParams()",
    "error LaunchConfigDisabled()",
    "error LaunchDependenciesNotWired()",
    "error LaunchDeployerNotSet()",
    "error LaunchEconomicsMismatch()",
    "error LaunchFeeNotPaid()",
    "error MetadataTooLong()",
    "error MinimumOutputRequired()",
    "error NativeValueMismatch()",
    "error NotWhitelisted()",
    "error PairTokenDecimalsMismatch()",
    "error PairTokenNotApproved()",
    "error SlippageExceeded()",
    "error SupplyTooHigh()",
    "error SupplyTooLow()",
    "error TransferFailed()",
    "error UnexpectedNativeValue()",
    "error ReentrancyGuardReentrantCall()",
  ],

  // Pons V2 launch factory (subset used by SCOTY)
  factoryAbi: [
    "function launchFee() view returns (uint256)",
    "function maxCreatorTaxBps() view returns (uint256)",
    "function getLaunchedToken(address token) view returns ((address token, address curve, address deployer, address creatorFeeRecipient, address pairToken, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, uint16 creatorTaxBps, bool buybackEnabled, uint8 phase, uint256 sweptQuote, uint256 sweptTokens, uint256 sweptAt, bool exists))",
    "function canLaunch(address launcher) view returns (bool)",
    "function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)",
    "function launchToken((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params, uint256 launchConfigId, address pairToken, address[] snipeTaxExemptions) payable returns (address token, address curve)",
  ],

  // Pons V2 bonding curve (one per token): used for the creator's initial buy
  curveAbi: [
    "function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)",
    "function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256 quoteOut)",
    "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
    "function realQuoteReserve() view returns (uint256)",
    "function graduationThreshold() view returns (uint256)",
    "function sellableTokens() view returns (uint256)",
    "function graduated() view returns (bool)",
    "function feeBps() view returns (uint256)",
    "function creatorTaxBps() view returns (uint256)",
    "event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)",
    "event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)",
  ],

  // Pons V2 launch token (ERC-20 + on-chain metadata)
  tokenAbi: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function getTokenInfo() view returns (address tokenDeployer, string tokenLogo, string tokenDescription, (string twitter, string telegram, string discord, string website, string farcaster) tokenSocials)",
  ],

  // Logo upload endpoint (Vercel function in /api/upload.js, stores to Vercel Blob)
  uploadUrl: "/api/upload",

  // Pons V2 fee escrow: creator fees accrue here per recipient wallet
  feeEscrowAbi: [
    "function balanceOf(address recipient) view returns (uint256)",
    "function claim(uint256 amount) returns (uint256 claimed)",
  ],

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
