import { JsonRpcSigner } from "ethers";
import { useCallback, useState } from "react";
import { BACKEND_URL } from "../config/appConfig";

export function useEip191Auth(signer: JsonRpcSigner | null, account: string | null) {
  const [nonce, setNonce] = useState("");
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [result, setResult] = useState<
    | {
        address: string;
        nonce: string;
        message: string;
        verified: boolean;
      }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const resetEip191 = useCallback(() => {
    setNonce("");
    setMessage("");
    setSignature("");
    setResult(null);
    setError(null);
  }, []);

  const authenticateEip191 = useCallback(async () => {
    if (!signer || !account) {
      setError("Connect MetaMask before starting EIP-191 auth");
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      const nonceResponse = await fetch(`${BACKEND_URL}/auth/eip191/nonce`, {
        credentials: "include",
      });
      if (!nonceResponse.ok) {
        throw new Error("Failed to fetch EIP-191 nonce");
      }
      const noncePayload = await nonceResponse.json();
      const nextNonce = noncePayload?.nonce;
      if (!nextNonce) {
        throw new Error("Nonce missing from server response");
      }

      setNonce(nextNonce);
      const constructedMessage = `EIP-191 login request for ${window.location.host}\nAddress: ${account}\nNonce: ${nextNonce}\nIssued At: ${new Date().toISOString()}`;
      setMessage(constructedMessage);

      const signatureValue = await signer.signMessage(constructedMessage);
      setSignature(signatureValue);

      const verifyResponse = await fetch(`${BACKEND_URL}/auth/eip191/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          address: account,
          nonce: nextNonce,
          message: constructedMessage,
          signature: signatureValue,
        }),
      });

      if (!verifyResponse.ok) {
        const payload = await verifyResponse.json().catch(() => null);
        throw new Error(payload?.message ?? "EIP-191 verification failed");
      }

      const data = await verifyResponse.json();
      setResult(data);
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setIsSigning(false);
    }
  }, [signer, account]);

  return {
    nonce,
    message,
    signature,
    isSigning,
    result,
    error,
    authenticateEip191,
    resetEip191,
  };
}
