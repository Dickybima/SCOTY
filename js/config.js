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
    },
  ],

  // Pons V2 launch factory (subset used by SCOTY)
  factoryAbi: [
    "function launchFee() view returns (uint256)",
    "function maxCreatorTaxBps() view returns (uint256)",
    "function canLaunch(address launcher) view returns (bool)",
    "function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)",
    "function launchToken((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params, uint256 launchConfigId, address pairToken, address[] snipeTaxExemptions) payable returns (address token, address curve)",
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
