/** LaunchFactory Contract ABI */
export const LAUNCH_FACTORY_ABI = [
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "launchId", type: "uint256" },
      { indexed: true, name: "token", type: "address" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" },
    ],
    name: "LaunchCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "launchId", type: "uint256" },
      { indexed: true, name: "token", type: "address" },
      { indexed: false, name: "imageURI", type: "string" },
    ],
    name: "LaunchImageURI",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "launchId", type: "uint256" },
      { indexed: false, name: "newState", type: "uint8" },
    ],
    name: "LaunchStateChanged",
    type: "event",
  },
  // View functions
  {
    inputs: [{ name: "launchId", type: "uint256" }],
    name: "getLaunchInfo",
    outputs: [
      {
        components: [
          { name: "token", type: "address" },
          { name: "creator", type: "address" },
          { name: "state", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "tokenType", type: "uint8" },
          { name: "devReserveBps", type: "uint256" },
          { name: "fundraisingBps", type: "uint256" },
          { name: "poolBps", type: "uint256" },
          { name: "targetMarketCapUsdt", type: "uint256" },
          { name: "auctionDuration", type: "uint32" },
          { name: "creatorTaxBps", type: "uint16" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "launchId", type: "uint256" }],
    name: "getTokenByLaunchId",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "token", type: "address" }],
    name: "getLaunchIdByToken",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalLaunches",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "nonces",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "defaultAuctionDuration",
    outputs: [{ name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "creationFee",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getModules",
    outputs: [
      { name: "auctionEngine", type: "address" },
      { name: "feeDistributor", type: "address" },
      { name: "stakingVault", type: "address" },
      { name: "liquidityManager", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // Write functions
  {
    inputs: [
      {
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "tokenType", type: "uint8" },
          { name: "devReserveBps", type: "uint256" },
          { name: "fundraisingBps", type: "uint256" },
          { name: "poolBps", type: "uint256" },
          { name: "targetMarketCapUsdt", type: "uint256" },
          { name: "copyrightAuthor", type: "address" },
          { name: "startTime", type: "uint256" },
          { name: "creatorTaxBps", type: "uint16" },
          { name: "auctionAsset", type: "address" },
          { name: "targetRaiseQuote", type: "uint256" },
          { name: "poolQuoteAsset", type: "address" },
          { name: "imageURI", type: "string" },
        ],
        name: "config",
        type: "tuple",
      },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    name: "createLaunch",
    outputs: [
      { name: "launchId", type: "uint256" },
      { name: "token", type: "address" },
    ],
    stateMutability: "payable",
    type: "function",
  },
] as const;
