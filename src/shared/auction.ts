/** Shared browser/CLI transaction encoding. ABI source stays in the existing generator. */
import { encodeFunctionData, getAddress, maxUint256, parseUnits, zeroAddress } from 'viem';
import type { Address, Hex } from 'viem';
import { AUCTION_ENGINE_ABI } from '../abis/AuctionEngine';
import { ERC20_ABI } from '../abis/ERC20';

export { AUCTION_ENGINE_ABI, ERC20_ABI };

export interface AllocationProof {
  allocation_version: number;
  launch_id: number;
  participant_index: number;
  participant_address: string;
  contributed_wei: string;
  accepted_wei: string;
  refund_wei: string;
  token_amount: string;
  merkle_proof: readonly Hex[];
  merkle_proof_sums: readonly string[];
  merkle_proof_token_sums: readonly string[];
}

export function uint(value: string | bigint | number): bigint {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Unsafe integer');
  if (!/^\d+$/.test(String(value))) throw new Error('Expected an unsigned integer');
  if (String(value).length > 78) throw new Error('Amount exceeds uint256');
  const result = BigInt(value);
  if (result > maxUint256) throw new Error('Amount exceeds uint256');
  return result;
}

export function exactAmount(amount: string, decimals: number): bigint {
  if (amount.length > 335) throw new Error('Amount is too long');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error('Invalid decimals');
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amount)) throw new Error('Use a positive decimal amount');
  if ((amount.split('.')[1]?.length ?? 0) > decimals) throw new Error('Amount exceeds asset precision');
  const result = uint(parseUnits(amount, decimals));
  if (result === 0n) throw new Error('Amount must be positive');
  return result;
}

export function allocationClaimArgs(launchId: bigint | number, proof: AllocationProof, participant?: string) {
  if (proof.allocation_version !== 2 || uint(proof.launch_id) !== uint(launchId)) throw new Error('Allocation version or launch mismatch');
  if (participant && getAddress(proof.participant_address) !== getAddress(participant)) throw new Error('Allocation wallet mismatch');
  const lengths = [proof.merkle_proof.length, proof.merkle_proof_sums.length, proof.merkle_proof_token_sums.length];
  if (lengths[0] !== lengths[1] || lengths[0] !== lengths[2]) throw new Error('Invalid proof lengths');
  if (uint(proof.accepted_wei) + uint(proof.refund_wei) !== uint(proof.contributed_wei)) throw new Error('Allocation does not conserve funds');
  return [uint(launchId), uint(proof.participant_index), uint(proof.accepted_wei), uint(proof.token_amount),
    proof.merkle_proof, proof.merkle_proof_sums.map(uint), proof.merkle_proof_token_sums.map(uint)] as const;
}

export type AuctionAction = 'deposit' | 'claim' | 'withdraw' | 'cancelled-refund' | 'deferred-refund';
export interface EncodedCall { to: Address; data: Hex; value: bigint }

export function auctionCall(engine: Address, launchId: bigint, action: AuctionAction, options: {
  amount?: bigint; asset?: Address; proof?: AllocationProof; participant?: Address;
} = {}): EncodedCall {
  if (!['deposit', 'claim', 'withdraw', 'cancelled-refund', 'deferred-refund'].includes(action)) throw new Error('Unsupported auction action');
  const to = getAddress(engine);
  if (to === zeroAddress || uint(launchId) === 0n) throw new Error('Invalid deployment or launch');
  const amount = uint(options.amount ?? 0n);
  if ((action === 'deposit' || action === 'withdraw') && amount === 0n) throw new Error('Amount must be positive');
  if (action === 'deposit') {
    const native = getAddress(options.asset ?? zeroAddress) === zeroAddress;
    return { to, data: native
      ? encodeFunctionData({ abi: AUCTION_ENGINE_ABI, functionName: 'contribute', args: [launchId] })
      : encodeFunctionData({ abi: AUCTION_ENGINE_ABI, functionName: 'contributeWithQuote', args: [launchId, amount] }),
    value: native ? amount : 0n };
  }
  if (action === 'withdraw') return { to, value: 0n, data: encodeFunctionData({ abi: AUCTION_ENGINE_ABI, functionName: 'withdrawContribution', args: [launchId, amount] }) };
  if (action === 'claim') {
    if (!options.proof) throw new Error('Allocation proof required');
    return { to, value: 0n, data: encodeFunctionData({ abi: AUCTION_ENGINE_ABI, functionName: 'claimAllocation',
      args: allocationClaimArgs(launchId, options.proof, options.participant) }) };
  }
  return { to, value: 0n, data: encodeFunctionData({ abi: AUCTION_ENGINE_ABI,
    functionName: action === 'cancelled-refund' ? 'claimCancelledRefund' : 'withdrawDeferredRefund', args: [launchId] }) };
}

export function approvalCall(asset: Address, spender: Address, amount: bigint): EncodedCall {
  if (getAddress(asset) === zeroAddress || getAddress(spender) === zeroAddress) throw new Error('Invalid approval target');
  return { to: getAddress(asset), value: 0n,
    data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [getAddress(spender), uint(amount)] }) };
}

export function assertActionState(action: AuctionAction, s: {
  state: number; startTime: bigint; endTime: bigint; totalReachableQuote: bigint; targetRaiseQuote: bigint;
}, now: bigint) {
  if (action === 'deposit' && (!(s.state === 0 || s.state === 1 || s.state === 6) || now < s.startTime ||
    (now >= s.endTime && s.totalReachableQuote >= s.targetRaiseQuote))) throw new Error('Auction is not accepting deposits');
  if (action === 'withdraw' && (!(s.state === 1 || s.state === 6) || now < s.endTime ||
    s.totalReachableQuote >= s.targetRaiseQuote)) throw new Error('Withdrawal is not available');
  if (action === 'claim' && s.state !== 4) throw new Error('Allocation is not claimable');
  if (action === 'cancelled-refund' && s.state !== 5) throw new Error('Auction is not cancelled');
}
