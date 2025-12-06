import { JsonRpcSigner } from "ethers";
import { useCallback, useState } from "react";
import { BACKEND_URL } from "../config/appConfig";
import { SiweMessage } from "siwe";

export function useSiweAuth(
  signer: JsonRpcSigner | null,
  account: string | null,
  chainId: number | null
) {
  const [siweSession, setSiweSession] = useState<{
    address: string;
    chainId: number;
    issuedAt?: string;
  } | null>(null);
  const [siweStatus, setSiweStatus] = useState<"idle" | "authenticated">(
    "idle"
  );
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [siweError, setSiweError] = useState<string | null>(null);

  const resetSiwe = useCallback(() => {
    setSiweSession(null);
    setSiweStatus("idle");
    setSiweError(null);
  }, []);

  const signInWithEthereum = useCallback(async () => {
    if (!signer || !account) {
      setSiweError("Connect MetaMask before starting SIWE");
      return;
    }

    setIsAuthenticating(true);
    setSiweError(null);

    try {
      const nonceResponse = await fetch(`${BACKEND_URL}/auth/nonce`, {
        credentials: "include",
      });

      if (!nonceResponse.ok) {
        throw new Error("Server failed to issue a nonce");
      }

      const noncePayload = await nonceResponse.json();
      const nonce = noncePayload?.nonce;

      if (!nonce) {
        throw new Error("Nonce missing from response");
      }

      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address: account,
        statement: "Sign in with Ethereum to continue.",
        uri: window.location.origin,
        version: "1",
        chainId: chainId ?? 1,
        nonce,
      });
      const preparedMessage = siweMessage.prepareMessage();
      const signatureValue = await signer.signMessage(preparedMessage);

      const verifyResponse = await fetch(`${BACKEND_URL}/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          message: preparedMessage,
          signature: signatureValue,
        }),
      });

      if (!verifyResponse.ok) {
        const payload = await verifyResponse.json().catch(() => null);
        throw new Error(payload?.message ?? "Signature verification failed");
      }

      const session = await verifyResponse.json();
      setSiweSession({
        address: session.address,
        issuedAt: session.issuedAt,
        chainId: session.chainId,
      });
      setSiweStatus("authenticated");
    } catch (error) {
      setSiweError((error as Error).message);
      setSiweSession(null);
      setSiweStatus("idle");
    } finally {
      setIsAuthenticating(false);
    }
  }, [signer, account, chainId]);

  const logoutSiwe = useCallback(() => {
    resetSiwe();
  }, [resetSiwe]);

  return {
    siweSession,
    siweStatus,
    isAuthenticating,
    siweError,
    signInWithEthereum,
    logoutSiwe,
    resetSiwe,
  };
}
