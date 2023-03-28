import { mockPolkadotApi } from "./__mocks__/PolkadotApiMock.js";
mockPolkadotApi();
const { ApiPromise } = await import('@polkadot/api');

import { SubmittableExtrinsic } from "@polkadot/api/promise/types.js";
import { Balance } from "../src/interfaces/index.js";
import { Mock } from "moq.ts";
import { DEFAULT_LEGAL_OFFICER } from "./TestData.js";
import type { RuntimeDispatchInfo } from '@polkadot/types/interfaces';
import type { Codec } from '@polkadot/types-codec/types';
import { setQueryFileStorageFee, setAddFile } from "./__mocks__/PolkadotApiMock.js";
const { UUID, FeesEstimator } = await import("../src/index.js");

describe("FeesEstimator", () => {

    const LOC_REQUEST_ID = "9a1575ca-fbe8-4a61-a5b0-357300b7a57d";

    function mockCodecWithToString<T extends Codec>(value: string): T {
        return ({
            toString: () => value,
        }) as T;
    }

    it("estimates fees on file add", async () => {
        const expectedStorageFee = BigInt(100);

        const dispatchInfo = new Mock<RuntimeDispatchInfo>();
        const expectedInclusionFee = BigInt(42);
        dispatchInfo.setup(instance => instance.partialFee).returns(mockCodecWithToString(expectedInclusionFee.toString()));
        const submittable = new Mock<SubmittableExtrinsic>();
        submittable.setup(instance => instance.paymentInfo(DEFAULT_LEGAL_OFFICER)).returns(Promise.resolve(dispatchInfo.object()));

        setQueryFileStorageFee(() => Promise.resolve({ toBigInt: () => expectedStorageFee } as Balance ))
        setAddFile(() => submittable.object())

        const api = new ApiPromise();
        const estimator = new FeesEstimator(api);
        const fees = await estimator.estimateAddFile({
            locId: new UUID(LOC_REQUEST_ID),
            hash: "0xf2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2",
            nature: "Some nature",
            submitter: DEFAULT_LEGAL_OFFICER,
            size: BigInt(42),
            origin: DEFAULT_LEGAL_OFFICER,
        });

        expect(fees.inclusionFee).toBe(expectedInclusionFee);
        expect(fees.storageFee).toBe(expectedStorageFee);
        expect(fees.totalFee).toBe(expectedInclusionFee + expectedStorageFee);
    });

    it("estimates fees without storage", async () => {
        const dispatchInfo = new Mock<RuntimeDispatchInfo>();
        const expectedInclusionFee = BigInt(42);
        dispatchInfo.setup(instance => instance.partialFee).returns(mockCodecWithToString(expectedInclusionFee.toString()));
        const submittable = new Mock<SubmittableExtrinsic>();
        submittable.setup(instance => instance.paymentInfo(DEFAULT_LEGAL_OFFICER)).returns(Promise.resolve(dispatchInfo.object()));

        const api = new ApiPromise();
        const estimator = new FeesEstimator(api);
        const fees = await estimator.estimateWithoutStorage({
            origin: DEFAULT_LEGAL_OFFICER,
            submittable: submittable.object(),
        });

        expect(fees.inclusionFee).toBe(expectedInclusionFee);
        expect(fees.storageFee).toBeUndefined();
        expect(fees.totalFee).toBe(expectedInclusionFee);
    });
});
