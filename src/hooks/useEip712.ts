import { JsonRpcSigner } from "ethers";
import type { TypedDataDomain, TypedDataField } from "ethers";
import { useCallback, useState } from "react";
import { BACKEND_URL } from "../config/appConfig";

export type Eip712Challenge = {
  nonce: string;
  domain: TypedDataDomain;
  types: Record<string, TypedDataField[]>;
  message: {
    address: string;
    nonce: string;
    statement: string;
    uri: string;
    issuedAt: string;
  };
};

export function useEip712Auth(
  signer: JsonRpcSigner | null,
  account: string | null,
  chainId: number | null
) {
  const [challenge, setChallenge] = useState<Eip712Challenge | null>(null);
  const [signature, setSignature] = useState("");
  const [result, setResult] = useState<
    | {
        address: string;
        nonce: string;
        issuedAt?: string;
        verified: boolean;
      }
    | null
  >(null);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetEip712 = useCallback(() => {
    setChallenge(null);
    setSignature("");
    setResult(null);
    setError(null);
  }, []);

  const authenticateEip712 = useCallback(async () => {
    if (!signer || !account) {
      setError("Connect MetaMask before starting EIP-712 auth");
      return;
    }

    const effectiveChainId = chainId ?? 1;

    setIsSigning(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        address: account,
        chainId: String(effectiveChainId),
        uri: window.location.origin,
      });
      const challengeResponse = await fetch(
        `${BACKEND_URL}/auth/eip712/challenge?${params.toString()}`,
        {
          credentials: "include",
        }
      );
      if (!challengeResponse.ok) {
        throw new Error("Failed to fetch EIP-712 challenge");
      }
      const challengePayload: Eip712Challenge = await challengeResponse.json();
      setChallenge(challengePayload);

      const signatureValue = await signer.signTypedData(
        challengePayload.domain,
        challengePayload.types,
        challengePayload.message
      );
      setSignature(signatureValue);

      const verifyResponse = await fetch(`${BACKEND_URL}/auth/eip712/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          address: account,
          chainId: effectiveChainId,
          nonce: challengePayload.nonce,
          issuedAt: challengePayload.message.issuedAt,
          uri: challengePayload.message.uri,
          signature: signatureValue,
        }),
      });

      if (!verifyResponse.ok) {
        const payload = await verifyResponse.json().catch(() => null);
        throw new Error(payload?.message ?? "EIP-712 verification failed");
      }

      const data = await verifyResponse.json();
      setResult(data);
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setIsSigning(false);
    }
  }, [signer, account, chainId]);

  return {
    challenge,
    signature,
    result,
    isSigning,
    error,
    authenticateEip712,
    resetEip712,
  };
}
