import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, zeroAddress } from 'viem';
import { AUCTION_ENGINE_ABI, allocationClaimArgs, assertActionState, auctionCall, exactAmount } from '../src/shared/auction';

const engine = '0x1111111111111111111111111111111111111111';
const participant = '0x2222222222222222222222222222222222222222';
test('amounts never round or accept floating/exponent input', () => {
  assert.equal(exactAmount('0.000001', 6), 1n);
  for (const bad of ['1e3', '-1', '0', 'NaN', '0.0000001', '1.0000001']) assert.throws(() => exactAmount(bad, 6));
  assert.throws(() => exactAmount('1', -1));
});
test('native contribution and withdrawal encode the canonical ABI', () => {
  const call = auctionCall(engine, 7n, 'deposit', { amount: 3n, asset: zeroAddress });
  assert.equal(call.value, 3n);
  assert.deepEqual(decodeFunctionData({ abi: AUCTION_ENGINE_ABI, data: call.data }), { functionName: 'contribute', args: [7n] });
  const withdrawal = auctionCall(engine, 7n, 'withdraw', { amount: 2n });
  assert.deepEqual(decodeFunctionData({ abi: AUCTION_ENGINE_ABI, data: withdrawal.data }), { functionName: 'withdrawContribution', args: [7n, 2n] });
});
test('claim proof is bound to wallet/launch and conserves funds', () => {
  const proof = { allocation_version: 2, launch_id: 7, participant_index: 0, participant_address: participant,
    contributed_wei: '10', accepted_wei: '6', refund_wei: '4', token_amount: '60', merkle_proof: [], merkle_proof_sums: [], merkle_proof_token_sums: [] };
  assert.equal(allocationClaimArgs(7n, proof, participant)[2], 6n);
  assert.throws(() => allocationClaimArgs(8n, proof, participant));
  assert.throws(() => allocationClaimArgs(7n, proof, engine));
  assert.throws(() => allocationClaimArgs(7n, { ...proof, refund_wei: '5' }));
});
test('extended funding and frozen snapshots follow contract transitions', () => {
  const s = { state: 1, startTime: 10n, endTime: 20n, totalReachableQuote: 5n, targetRaiseQuote: 10n };
  assertActionState('deposit', s, 21n);
  assertActionState('withdraw', s, 21n);
  assert.throws(() => assertActionState('withdraw', s, 19n));
  for (const action of ['deposit', 'withdraw'] as const) assert.throws(() => assertActionState(action, { ...s, totalReachableQuote: 10n }, 20n));
  assert.throws(() => assertActionState('claim', s, 30n));
  assertActionState('claim', { ...s, state: 4 }, 30n);
});
