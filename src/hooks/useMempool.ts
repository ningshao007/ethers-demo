import { BrowserProvider, formatEther, formatUnits } from "ethers";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PendingTransaction } from "../types/mempool";

const MAX_PENDING_ENTRIES = 15;

export function useMempool(
  provider: BrowserProvider | null,
  filterAddress?: string | null
) {
  const [pendingTxs, setPendingTxs] = useState<PendingTransaction[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listenerRef = useRef<((txHash: string) => void) | null>(null);
  const seenTxsRef = useRef<Set<string>>(new Set());
  const filterRef = useRef<string | null>(null);

  useEffect(() => {
    filterRef.current = filterAddress ? filterAddress.toLowerCase() : null;
  }, [filterAddress]);

  const stopMonitoring = useCallback(() => {
    if (listenerRef.current && provider?.off) {
      provider.off("pending", listenerRef.current);
    }
    listenerRef.current = null;
    seenTxsRef.current.clear();
    setIsMonitoring(false);
  }, [provider]);

  const clearPendingTxs = useCallback(() => {
    setPendingTxs([]);
    seenTxsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!provider && isMonitoring) {
      stopMonitoring();
      clearPendingTxs();
    }
  }, [provider, isMonitoring, stopMonitoring, clearPendingTxs]);

  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  const handlePending = useCallback(
    async (txHash: string) => {
      if (!provider || !txHash) {
        return;
      }
      if (seenTxsRef.current.has(txHash)) {
        return;
      }
      seenTxsRef.current.add(txHash);

      try {
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
          return;
        }

        const filterAddressLower = filterRef.current;
        if (filterAddressLower) {
          const fromMatches = tx.from?.toLowerCase() === filterAddressLower;
          const toMatches = tx.to?.toLowerCase() === filterAddressLower;
          if (!fromMatches && !toMatches) {
            return;
          }
        }

        setPendingTxs((previous) => {
          const nextEntry: PendingTransaction = {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            valueEth: tx.value ? formatEther(tx.value) : "0",
            gasPriceGwei: tx.gasPrice
              ? formatUnits(tx.gasPrice, "gwei")
              : undefined,
            maxFeePerGasGwei: tx.maxFeePerGas
              ? formatUnits(tx.maxFeePerGas, "gwei")
              : undefined,
            nonce: tx.nonce,
          };
          const next = [nextEntry, ...previous];
          if (next.length > MAX_PENDING_ENTRIES) {
            next.pop();
          }
          return next;
        });
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [provider]
  );

  const startMonitoring = useCallback(() => {
    if (!provider) {
      setError("Connect MetaMask before monitoring mempool");
      return;
    }
    if (isMonitoring) {
      return;
    }

    setError(null);
    listenerRef.current = handlePending;
    provider.on("pending", handlePending);
    setIsMonitoring(true);
  }, [provider, isMonitoring, handlePending]);

  return {
    pendingTxs,
    isMonitoring,
    error,
    startMonitoring,
    stopMonitoring,
    clearPendingTxs,
  };
}
