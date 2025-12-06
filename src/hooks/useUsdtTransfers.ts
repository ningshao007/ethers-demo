import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  INFURA_MAINNET_RPC_URL,
  USDT_CONTRACT_ADDRESS,
  USDT_DECIMALS,
} from "../config/appConfig";
import type { UsdtTransfer } from "../types/usdt";
import { ERC20_ABI } from "../constants/abis";

const USDT_TRANSFER_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const MAX_USDT_ENTRIES = 20;

export function useUsdtTransfers() {
  const providerRef = useRef<JsonRpcProvider | null>(null);
  const contractRef = useRef<Contract | null>(null);
  const listenerRef = useRef<((
    from: string,
    to: string,
    value: bigint,
    event: { blockNumber?: number; transactionHash?: string; getBlock?: () => Promise<{ timestamp: number } | null> }
  ) => void) | null>(null);

  const [transfers, setTransfers] = useState<UsdtTransfer[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureContract = useCallback(() => {
    if (!providerRef.current) {
      providerRef.current = new JsonRpcProvider(INFURA_MAINNET_RPC_URL, 1);
    }
    if (!contractRef.current) {
      contractRef.current = new Contract(
        USDT_CONTRACT_ADDRESS,
        [...ERC20_ABI, ...USDT_TRANSFER_ABI],
        providerRef.current
      );
    }
    return contractRef.current;
  }, []);

  const stopInternal = useCallback(() => {
    const contract = contractRef.current;
    if (contract && listenerRef.current) {
      contract.off("Transfer", listenerRef.current);
    }
    listenerRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (isListening) {
      return;
    }

    try {
      const contract = ensureContract();
      setError(null);
      setTransfers([]);

      const listener = async (
        from: string,
        to: string,
        value: bigint,
        event: {
          blockNumber?: number;
          transactionHash?: string;
          getBlock?: () => Promise<{ timestamp: number } | null>;
        }
      ) => {
        const timestamp = event.getBlock ? (await event.getBlock())?.timestamp : null;

        setTransfers((previous) => {
          const next: UsdtTransfer = {
            txHash: event.transactionHash ?? crypto.randomUUID?.() ?? "pending",
            blockNumber: event.blockNumber ?? null,
            timestamp: timestamp ?? null,
            from,
            to,
            amount: formatUnits(value, USDT_DECIMALS),
          };
          const combined = [next, ...previous];
          return combined.slice(0, MAX_USDT_ENTRIES);
        });
      };

      listenerRef.current = listener;
      contract.on("Transfer", listener);
      setIsListening(true);
    } catch (err) {
      stopInternal();
      setError((err as Error).message);
    }
  }, [ensureContract, isListening, stopInternal]);

  const stopListening = useCallback(() => {
    stopInternal();
  }, [stopInternal]);

  const resetTransfers = useCallback(() => {
    setTransfers([]);
  }, []);

  useEffect(() => {
    return () => {
      stopInternal();
    };
  }, [stopInternal]);

  return {
    transfers,
    isListening,
    error,
    startListening,
    stopListening,
    resetTransfers,
  };
}
