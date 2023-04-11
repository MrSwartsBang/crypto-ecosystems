import { buildApi, LGNT_SMALLEST_UNIT, NONE, PrefixedNumber, approveVaultTransfer } from "@logion/node-api";

import { ActiveProtection, VaultTransferRequest } from "../src/index.js";
import { REQUESTER_ADDRESS, State } from "./Utils.js";
import { checkCoinBalance } from "./Balance.js";

export async function providesVault(state: State) {
    const { client, signer, alice, requesterAccount } = state;

    const userClient = client.withCurrentAddress(requesterAccount);
    let activeProtection = (await userClient.protectionState()) as ActiveProtection;
    activeProtection = await activeProtection.waitForFullyReady();

    // Transfer to vault
    let vaultState = await activeProtection.vaultState();
    const vaultAddress = vaultState.vaultAddress;
    let balanceState = await userClient.balanceState();
    balanceState = await balanceState.transfer({
        signer,
        destination: vaultAddress,
        amount: new PrefixedNumber("5", NONE)
    });
    vaultState = await vaultState.refresh();
    checkCoinBalance(vaultState.balances[0], "5.00");

    // Transfer back from vault
    vaultState = await vaultState.createVaultTransferRequest({
        legalOfficer: alice,
        amount: new PrefixedNumber("1", NONE),
        destination: REQUESTER_ADDRESS,
        signer
    });
    const pendingRequest = vaultState.pendingVaultTransferRequests[0];

    // Alice accepts
    await aliceAcceptsTransfer(state, pendingRequest);

    // Check balances
    vaultState = await vaultState.refresh();
    balanceState = await balanceState.refresh();

    checkCoinBalance(balanceState.balances[0], "3.01k");
    checkCoinBalance(vaultState.balances[0], "4.00");
}

export async function aliceAcceptsTransfer(state: State, request: VaultTransferRequest) {
    const { client, signer, aliceAccount } = state;

    const api = await buildApi(client.config.rpcEndpoints);

    const signerId = aliceAccount.address;
    const amount = new PrefixedNumber(request!.amount, LGNT_SMALLEST_UNIT);
    const submittable = await approveVaultTransfer({
        signerId,
        api,
        requester: request!.origin,
        destination: request!.destination,
        amount,
        block: BigInt(request!.block),
        index: request!.index,
    });
    await signer.signAndSend({
        signerId,
        submittable,
    });

    const authenticated = client.withCurrentAddress(aliceAccount);
    const axios = authenticated.getLegalOfficer(aliceAccount.address).buildAxiosToNode();
    await axios.post(`/api/vault-transfer-request/${request.id}/accept`);
}
