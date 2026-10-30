/** AuctionEngine Contract ABI — generated from contract/artifacts by `npm run generate:platform-abis`. Do not edit by hand. */
export const AUCTION_ENGINE_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AcceptedExceedsCap",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AcceptedExceedsContribution",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AcceptedExceedsTarget",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AcceptedTotalMismatch",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AccessControlBadConfirmation",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "neededRole",
        "type": "bytes32"
      }
    ],
    "name": "AccessControlUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AdapterNotAllowed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AdapterNotRequired",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      }
    ],
    "name": "AddressEmptyCode",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AlreadyClaimed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AlreadyEnded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AlreadyStarted",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AuctionExists",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AuctionInactive",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AuctionNeedsFinalization",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AuctionNotCancelled",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AuctionNotClaimable",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AuctionNotEnded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AuctionNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ClaimsIncomplete",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ContributionNotAuthorized",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "implementation",
        "type": "address"
      }
    ],
    "name": "ERC1967InvalidImplementation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ERC1967NonPayable",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EnforcedPause",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ExpectedPause",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ExplicitTargetRequired",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "FailedCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "FundraisingTooSmall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidAcceptedSum",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidAuction",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidAuctionTime",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidIndex",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidInitialization",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidPageSize",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidPaymentAmount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidProof",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidProofLength",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidRaise",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidTokenAllocation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidTokenSum",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidWithdrawal",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "LiquidityManagerUnset",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NativePriceUnavailable",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoActivationWindow",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoContribution",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoDeferredRefund",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoTokenBalance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotInitializing",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PaymentAssetMatchesAuctionAsset",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "QuoteAssetNotSet",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "RecoveryUnavailable",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "RefundFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "RouteChanged",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "RouteNotRegistered",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "SafeERC20FailedOperation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SettlementDeadlinePassed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SettlementDelayNotElapsed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SettlementDelayOutOfRange",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SettlementFloorUnreachable",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SettlementNotPending",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SettlementNotTimedOut",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SettlementRootImmutable",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SettlementTimedOut",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SettlementUnavailable",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "StartTimeInPast",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TokenAllocationExceeded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TokenAmountExceedsSale",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TokenTotalMismatch",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UUPSUnauthorizedCallContext",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "slot",
        "type": "bytes32"
      }
    ],
    "name": "UUPSUnsupportedProxiableUUID",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "WithdrawalUnavailable",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroAdapter",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroAddress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroContribution",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroDecimals",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroMinOut",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroPrice",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroReceived",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroRecipient",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroRoot",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "enum IAuctionEngine.AuctionState",
        "name": "finalState",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalContributed",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalReachable",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "participantCount",
        "type": "uint256"
      }
    ],
    "name": "AuctionEnded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalContributed",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalReachable",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "participantCount",
        "type": "uint256"
      }
    ],
    "name": "AuctionExtended",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "tokensForSale",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "targetRaiseQuote",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "individualCapQuote",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "quotePriceAtCreation",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "targetMarketCapUsdt",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "startTime",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      }
    ],
    "name": "AuctionInitialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "participant",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "acceptedAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "tokenAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "refundAmount",
        "type": "uint256"
      }
    ],
    "name": "Claimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "contributor",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalContributed",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalReachable",
        "type": "uint256"
      }
    ],
    "name": "Contributed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "contributor",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "paymentAsset",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "auctionAsset",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amountIn",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amountOut",
        "type": "uint256"
      }
    ],
    "name": "ContributionConverted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "gate",
        "type": "address"
      }
    ],
    "name": "ContributionGateUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "contributor",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "remainingContribution",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalContributed",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalReachable",
        "type": "uint256"
      }
    ],
    "name": "ContributionWithdrawn",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "version",
        "type": "uint64"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Paused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "participant",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "RefundDeferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "previousAdminRole",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newAdminRole",
        "type": "bytes32"
      }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "allocationRoot",
        "type": "bytes32"
      }
    ],
    "name": "SettlementActivated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "adapter",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "allowed",
        "type": "bool"
      }
    ],
    "name": "SettlementAdapterAllowed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "SettlementCancelled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "adapter",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "minAmountOut",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      }
    ],
    "name": "SettlementConfigured",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "adapter",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "inputAsset",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "outputAsset",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amountIn",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amountOut",
        "type": "uint256"
      }
    ],
    "name": "SettlementConverted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newDelay",
        "type": "uint256"
      }
    ],
    "name": "SettlementDelayUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "allocationRoot",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalAccepted",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalTokens",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "activateAfter",
        "type": "uint256"
      }
    ],
    "name": "SettlementProposed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "SettlementRejected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Unpaused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "implementation",
        "type": "address"
      }
    ],
    "name": "Upgraded",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DEFAULT_TARGET_MARKET_CAP_USDT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "FACTORY_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "GUARDIAN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_PARTICIPATION_BPS",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "SETTLEMENT_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "SETTLEMENT_TIMEOUT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "TOTAL_SUPPLY",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "TWAP_INTERVAL",
    "outputs": [
      {
        "internalType": "uint32",
        "name": "",
        "type": "uint32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "UPGRADER_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "UPGRADE_INTERFACE_VERSION",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "activateSettlement",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "allocationDomainSeparator",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "targetMarketCapUsdt",
        "type": "uint256"
      }
    ],
    "name": "calculateTargetRaiseNative",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "cancelTimedOutSettlement",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "acceptedAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "tokenAmount",
        "type": "uint256"
      },
      {
        "internalType": "bytes32[]",
        "name": "merkleProof",
        "type": "bytes32[]"
      },
      {
        "internalType": "uint256[]",
        "name": "merkleProofSums",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "merkleProofTokenSums",
        "type": "uint256[]"
      }
    ],
    "name": "claimAllocation",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "claimCancelledRefund",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "participant",
        "type": "address"
      }
    ],
    "name": "claimCancelledRefundFor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minAmountOut",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      }
    ],
    "name": "configureSettlement",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "contribute",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "paymentAsset",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amountIn",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minAmountOut",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      }
    ],
    "name": "contributeWithAsset",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "contributeWithQuote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "contributionGate",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "endAuction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "getAuctionQuotePrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "price",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "getAuctionStatus",
    "outputs": [
      {
        "components": [
          {
            "internalType": "enum IAuctionEngine.AuctionState",
            "name": "state",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "totalContributedQuote",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "totalReachableQuote",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "participantCount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "tokensForSale",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "targetRaiseQuote",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "individualCapQuote",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "quotePriceAtCreation",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "startTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "endTime",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "allocationRoot",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "settlementActivateAfter",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "auctionAsset",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "poolQuoteAsset",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "fundedAt",
            "type": "uint256"
          }
        ],
        "internalType": "struct IAuctionEngine.AuctionStatus",
        "name": "status",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "participant",
        "type": "address"
      }
    ],
    "name": "getContributionInfo",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "contributed",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "participantIndex",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "claimed",
            "type": "bool"
          }
        ],
        "internalType": "struct IAuctionEngine.ContributionInfo",
        "name": "info",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getNativeUsdPrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "price",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "getParticipant",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "offset",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "limit",
        "type": "uint256"
      }
    ],
    "name": "getParticipants",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "participants",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "amounts",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleAdmin",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "contributionAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "acceptedAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "tokenAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "refundAmount",
        "type": "uint256"
      }
    ],
    "name": "hashAllocationLeaf",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "admin",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "factory",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "liquidityManager",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "legacyNativeUsdPool",
        "type": "address"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "launchId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "tokensForSale",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "targetRaiseQuote",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "targetMarketCapUsdt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "startTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "endTime",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "auctionAsset",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "poolQuoteAsset",
            "type": "address"
          }
        ],
        "internalType": "struct IAuctionEngine.AuctionConfig",
        "name": "config",
        "type": "tuple"
      }
    ],
    "name": "initializeAuction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "allocationRoot",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "totalAccepted",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalTokens",
        "type": "uint256"
      }
    ],
    "name": "proposeSettlement",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "proxiableUUID",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      }
    ],
    "name": "recoverTokenDust",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "rejectSettlement",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "callerConfirmation",
        "type": "address"
      }
    ],
    "name": "renounceRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "gate",
        "type": "address"
      }
    ],
    "name": "setContributionGate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bool",
        "name": "allowed",
        "type": "bool"
      }
    ],
    "name": "setFallbackAllowed",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "price",
        "type": "uint256"
      }
    ],
    "name": "setFallbackNativeUsdPrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      }
    ],
    "name": "setLegacyNativeUsdPool",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "liquidityManager",
        "type": "address"
      }
    ],
    "name": "setLiquidityManager",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "pool",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "nativeIsToken0",
        "type": "bool"
      },
      {
        "internalType": "uint8",
        "name": "nativeDecimals",
        "type": "uint8"
      },
      {
        "internalType": "uint8",
        "name": "usdDecimals",
        "type": "uint8"
      }
    ],
    "name": "setNativeUsdPool",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "adapter",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "allowed",
        "type": "bool"
      }
    ],
    "name": "setSettlementAdapterAllowed",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "newDelay",
        "type": "uint256"
      }
    ],
    "name": "setSettlementDelay",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "settlementDelay",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "startAuction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newImplementation",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "upgradeToAndCall",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "withdrawContribution",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "launchId",
        "type": "uint256"
      }
    ],
    "name": "withdrawDeferredRefund",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
] as const;
