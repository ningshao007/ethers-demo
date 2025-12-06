import {
  BrowserProvider,
  JsonRpcSigner,
  TransactionResponse,
  formatEther,
  formatUnits,
  parseUnits,
} from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AccountPendingTx = {
  hash: string;
  nonce: number;
  to?: string | null;
  valueWei: bigint;
  data: string;
  gasLimit?: bigint;
  gasPrice?: bigint | null;
  maxFeePerGas?: bigint | null;
  maxPriorityFeePerGas?: bigint | null;
  type?: number;
  capturedAt: number;
  status: "pending" | "confirmed" | "failed";
};

type UseNonceManagerArgs = {
  provider: BrowserProvider | null;
  account: string | null;
  signer: JsonRpcSigner | null;
};

const MAX_TRACKED_TXS = 10;

export function useNonceManager({
  provider,
  account,
  signer,
}: UseNonceManagerArgs) {
  const [latestNonce, setLatestNonce] = useState<number | null>(null);
  const [pendingNonce, setPendingNonce] = useState<number | null>(null);
  const [pendingTxs, setPendingTxs] = useState<AccountPendingTx[]>([]);
  const [nonceError, setNonceError] = useState<string | null>(null);
  const [isRefreshingNonce, setIsRefreshingNonce] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const listenerRef = useRef<((txHash: string) => void) | null>(null);

  const normalizedAccount = useMemo(() => account?.toLowerCase() ?? null, [account]);

  const clearTracking = useCallback(() => {
    setPendingTxs([]);
    setTrackingError(null);
  }, []);

  const refreshNonce = useCallback(async () => {
    if (!provider || !account) {
      setNonceError("连接钱包后才能读取 nonce");
      setLatestNonce(null);
      setPendingNonce(null);
      return;
    }
    setIsRefreshingNonce(true);
    setNonceError(null);

    try {
      const [latest, pending] = await Promise.all([
        provider.getTransactionCount(account, "latest"),
        provider.getTransactionCount(account, "pending"),
      ]);
      setLatestNonce(latest);
      setPendingNonce(pending);
    } catch (error) {
      setNonceError((error as Error).message);
      setLatestNonce(null);
      setPendingNonce(null);
    } finally {
      setIsRefreshingNonce(false);
    }
  }, [provider, account]);

  const addPendingTx = useCallback(
    (tx: TransactionResponse) => {
      if (!normalizedAccount) return;
      if (tx.from.toLowerCase() !== normalizedAccount) return;
      setPendingTxs((previous) => {
        const filtered = previous.filter(
          (existing) =>
            existing.hash !== tx.hash && existing.nonce !== tx.nonce
        );
        const nextEntry: AccountPendingTx = {
          hash: tx.hash,
          nonce: tx.nonce,
          to: tx.to,
          valueWei: tx.value ?? 0n,
          data: tx.data,
          gasLimit: tx.gasLimit,
          gasPrice: tx.gasPrice ?? null,
          maxFeePerGas: tx.maxFeePerGas ?? null,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? null,
          type: tx.type,
          capturedAt: Date.now(),
          status: "pending",
        };
        const next = [nextEntry, ...filtered];
        if (next.length > MAX_TRACKED_TXS) {
          next.pop();
        }
        return next;
      });
    },
    [normalizedAccount]
  );

  const handlePendingEvent = useCallback(
    async (txHash: string) => {
      if (!provider || !normalizedAccount) return;
      try {
        const tx = await provider.getTransaction(txHash);
        if (!tx) return;
        addPendingTx(tx);
      } catch (error) {
        setTrackingError((error as Error).message);
      }
    },
    [provider, normalizedAccount, addPendingTx]
  );

  useEffect(() => {
    if (!provider || !normalizedAccount) {
      clearTracking();
      setLatestNonce(null);
      setPendingNonce(null);
      return;
    }
    refreshNonce();
  }, [provider, normalizedAccount, refreshNonce, clearTracking]);

  useEffect(() => {
    if (!provider || !normalizedAccount) return;

    listenerRef.current = handlePendingEvent;
    provider.on("pending", handlePendingEvent);

    return () => {
      if (listenerRef.current) {
        provider.off("pending", listenerRef.current);
      }
    };
  }, [provider, normalizedAccount, handlePendingEvent]);

  useEffect(() => {
    if (!provider || !pendingTxs.length) return;

    let cancelled = false;

    const checkReceipts = async () => {
      const results = await Promise.all(
        pendingTxs.map(async (tx) => {
          const receipt = await provider.getTransactionReceipt(tx.hash);
          if (!receipt) return null;
          return {
            hash: tx.hash,
            status: receipt.status === 1 ? "confirmed" : "failed",
          } as const;
        })
      );
      if (cancelled) return;
      const completed = results.filter(
        (entry): entry is { hash: string; status: "confirmed" | "failed" } =>
          Boolean(entry)
      );
      if (!completed.length) return;
      setPendingTxs((previous) =>
        previous.filter(
          (tx) => !completed.find((entry) => entry.hash === tx.hash)
        )
      );
      refreshNonce();
    };

    const listener = () => {
      void checkReceipts();
    };

    provider.on("block", listener);

    return () => {
      cancelled = true;
      provider.off("block", listener);
    };
  }, [provider, pendingTxs, refreshNonce]);

  const importPendingTx = useCallback(
    async (txHash: string) => {
      if (!provider || !txHash) {
        setTrackingError("请输入交易哈希");
        return;
      }
      setTrackingError(null);

      try {
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
          throw new Error("找不到该交易");
        }
        if (!normalizedAccount || tx.from.toLowerCase() !== normalizedAccount) {
          throw new Error("该交易并非当前钱包发出");
        }
        const confirmations = await tx.confirmations();
        if (tx.blockNumber && confirmations !== 0) {
          throw new Error("交易已确认，无需重发");
        }
        addPendingTx(tx);
      } catch (error) {
        setTrackingError((error as Error).message);
      }
    },
    [provider, normalizedAccount, addPendingTx]
  );

  const trackManualPendingTx = useCallback(
    (tx: TransactionResponse) => {
      addPendingTx(tx);
    },
    [addPendingTx]
  );

  const removePendingTx = useCallback((hash: string) => {
    setPendingTxs((previous) => previous.filter((tx) => tx.hash !== hash));
  }, []);

  const resendTransaction = useCallback(
    async (
      tx: AccountPendingTx,
      overrides: {
        maxFeePerGasGwei?: string;
        maxPriorityFeePerGasGwei?: string;
        gasPriceGwei?: string;
      }
    ) => {
      if (!signer) {
        throw new Error("连接支持签名的账号后才能重发交易");
      }
      const request: {
        to?: string;
        value?: bigint;
        data?: string;
        gasLimit?: bigint;
        nonce: number;
        maxFeePerGas?: bigint;
        maxPriorityFeePerGas?: bigint;
        gasPrice?: bigint;
        type?: number;
      } = {
        to: tx.to ?? undefined,
        value: tx.valueWei,
        data: tx.data,
        gasLimit: tx.gasLimit,
        nonce: tx.nonce,
        type: tx.type,
      };

      if (tx.maxFeePerGas || overrides.maxFeePerGasGwei) {
        if (!overrides.maxFeePerGasGwei) {
          throw new Error("请填写 maxFeePerGas");
        }
        request.maxFeePerGas = parseUnits(overrides.maxFeePerGasGwei, "gwei");
        if (!overrides.maxPriorityFeePerGasGwei) {
          throw new Error("请填写 maxPriorityFeePerGas");
        }
        request.maxPriorityFeePerGas = parseUnits(
          overrides.maxPriorityFeePerGasGwei,
          "gwei"
        );
      } else {
        if (!overrides.gasPriceGwei) {
          throw new Error("请填写 gasPrice");
        }
        request.gasPrice = parseUnits(overrides.gasPriceGwei, "gwei");
      }

      const response = await signer.sendTransaction(request);
      addPendingTx(response);
      return response;
    },
    [signer, addPendingTx]
  );

  const formatPendingTx = useCallback(
    (tx: AccountPendingTx) => ({
      ...tx,
      valueEth: formatEther(tx.valueWei),
      gasPriceGwei: tx.gasPrice ? formatUnits(tx.gasPrice, "gwei") : undefined,
      maxFeePerGasGwei: tx.maxFeePerGas
        ? formatUnits(tx.maxFeePerGas, "gwei")
        : undefined,
      maxPriorityFeePerGasGwei: tx.maxPriorityFeePerGas
        ? formatUnits(tx.maxPriorityFeePerGas, "gwei")
        : undefined,
    }),
    []
  );

  const formattedPendingTxs = useMemo(
    () => pendingTxs.map(formatPendingTx),
    [pendingTxs, formatPendingTx]
  );

  return {
    latestNonce,
    pendingNonce,
    pendingTxs: formattedPendingTxs,
    nonceError,
    trackingError,
    isRefreshingNonce,
    refreshNonce,
    importPendingTx,
    trackManualPendingTx,
    removePendingTx,
    clearTracking,
    resendTransaction,
  };
}
