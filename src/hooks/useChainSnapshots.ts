import {
  BrowserProvider,
  formatEther,
  formatUnits,
  isHexString,
} from "ethers";
import { useCallback, useState } from "react";

type BlockSnapshot = {
  number: number;
  hash: string;
  timestamp: number;
  miner?: string;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGasGwei?: string;
  transactionCount: number;
};

type TransactionSnapshot = {
  hash: string;
  from: string;
  to?: string | null;
  nonce: number;
  valueEth: string;
  gasPriceGwei?: string;
  maxFeePerGasGwei?: string;
  maxPriorityFeePerGasGwei?: string;
  blockNumber?: number | null;
  confirmations?: number;
  type?: number;
};

type ReceiptSnapshot = {
  transactionHash: string;
  status: number;
  blockNumber: number;
  confirmations: number;
  gasUsed: string;
  cumulativeGasUsed: string;
  effectiveGasPriceGwei?: string;
  contractAddress?: string | null;
  logsCount: number;
};

type FeeDataSnapshot = {
  gasPriceGwei?: string;
  maxFeePerGasGwei?: string;
  maxPriorityFeePerGasGwei?: string;
};

export function useChainSnapshots(provider: BrowserProvider | null) {
  const [blockSnapshot, setBlockSnapshot] = useState<BlockSnapshot | null>(
    null
  );
  const [transactionSnapshot, setTransactionSnapshot] =
    useState<TransactionSnapshot | null>(null);
  const [receiptSnapshot, setReceiptSnapshot] =
    useState<ReceiptSnapshot | null>(null);
  const [feeDataSnapshot, setFeeDataSnapshot] =
    useState<FeeDataSnapshot | null>(null);

  const [blockError, setBlockError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [feeDataError, setFeeDataError] = useState<string | null>(null);

  const [isLoadingBlock, setIsLoadingBlock] = useState(false);
  const [isLoadingTransaction, setIsLoadingTransaction] = useState(false);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [isLoadingFeeData, setIsLoadingFeeData] = useState(false);

  const resetSnapshots = useCallback(() => {
    setBlockSnapshot(null);
    setTransactionSnapshot(null);
    setReceiptSnapshot(null);
    setFeeDataSnapshot(null);
    setBlockError(null);
    setTransactionError(null);
    setReceiptError(null);
    setFeeDataError(null);
  }, []);

  const fetchBlock = useCallback(
    async (blockNumber?: number | "latest") => {
      if (!provider) {
        setBlockError("连接钱包后才能读取区块信息");
        return;
      }
      setIsLoadingBlock(true);
      setBlockError(null);

      try {
        const block = await provider.getBlock(blockNumber ?? "latest");
        if (!block) {
          throw new Error("区块不存在或尚未被挖出");
        }
        setBlockSnapshot({
          number: block.number!,
          hash: block.hash!,
          timestamp: block.timestamp ?? 0,
          miner: block.miner,
          gasUsed: block.gasUsed?.toString() ?? "0",
          gasLimit: block.gasLimit?.toString() ?? "0",
          baseFeePerGasGwei: block.baseFeePerGas
            ? formatUnits(block.baseFeePerGas, "gwei")
            : undefined,
          transactionCount: block.transactions?.length ?? 0,
        });
      } catch (error) {
        setBlockError((error as Error).message);
        setBlockSnapshot(null);
      } finally {
        setIsLoadingBlock(false);
      }
    },
    [provider]
  );

  const fetchTransaction = useCallback(
    async (txHash: string) => {
      if (!provider) {
        setTransactionError("连接钱包后才能读取交易信息");
        return;
      }
      if (!isHexString(txHash, 32)) {
        setTransactionError("请输入合法的 32 字节交易哈希");
        return;
      }

      setIsLoadingTransaction(true);
      setTransactionError(null);

      try {
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
          throw new Error("找不到该交易");
        }
        const confirmations = await tx.confirmations();
        setTransactionSnapshot({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          nonce: tx.nonce,
          valueEth: formatEther(tx.value ?? 0n),
          gasPriceGwei: tx.gasPrice ? formatUnits(tx.gasPrice, "gwei") : undefined,
          maxFeePerGasGwei: tx.maxFeePerGas
            ? formatUnits(tx.maxFeePerGas, "gwei")
            : undefined,
          maxPriorityFeePerGasGwei: tx.maxPriorityFeePerGas
            ? formatUnits(tx.maxPriorityFeePerGas, "gwei")
            : undefined,
          blockNumber: tx.blockNumber,
          confirmations,
          type: tx.type,
        });
      } catch (error) {
        setTransactionError((error as Error).message);
        setTransactionSnapshot(null);
      } finally {
        setIsLoadingTransaction(false);
      }
    },
    [provider]
  );

  const fetchReceipt = useCallback(
    async (txHash: string) => {
      if (!provider) {
        setReceiptError("连接钱包后才能读取回执信息");
        return;
      }
      if (!isHexString(txHash, 32)) {
        setReceiptError("请输入合法的 32 字节交易哈希");
        return;
      }

      setIsLoadingReceipt(true);
      setReceiptError(null);

      try {
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
          throw new Error("找不到该交易的回执");
        }
        const confirmations = await receipt.confirmations();
        setReceiptSnapshot({
          transactionHash: receipt.hash,
          status: receipt.status ?? 0,
          blockNumber: receipt.blockNumber ?? 0,
          confirmations,
          gasUsed: receipt.gasUsed?.toString() ?? "0",
          cumulativeGasUsed: receipt.cumulativeGasUsed?.toString() ?? "0",
          effectiveGasPriceGwei: receipt.gasPrice
            ? formatUnits(receipt.gasPrice, "gwei")
            : undefined,
          contractAddress: receipt.contractAddress,
          logsCount: receipt.logs?.length ?? 0,
        });
      } catch (error) {
        setReceiptError((error as Error).message);
        setReceiptSnapshot(null);
      } finally {
        setIsLoadingReceipt(false);
      }
    },
    [provider]
  );

  const fetchFeeData = useCallback(async () => {
    if (!provider) {
      setFeeDataError("连接钱包后才能读取 gas 费率数据");
      return;
    }
    setIsLoadingFeeData(true);
    setFeeDataError(null);

    try {
      const feeData = await provider.getFeeData();
      setFeeDataSnapshot({
        gasPriceGwei: feeData.gasPrice
          ? formatUnits(feeData.gasPrice, "gwei")
          : undefined,
        maxFeePerGasGwei: feeData.maxFeePerGas
          ? formatUnits(feeData.maxFeePerGas, "gwei")
          : undefined,
        maxPriorityFeePerGasGwei: feeData.maxPriorityFeePerGas
          ? formatUnits(feeData.maxPriorityFeePerGas, "gwei")
          : undefined,
      });
    } catch (error) {
      setFeeDataError((error as Error).message);
      setFeeDataSnapshot(null);
    } finally {
      setIsLoadingFeeData(false);
    }
  }, [provider]);

  return {
    blockSnapshot,
    transactionSnapshot,
    receiptSnapshot,
    feeDataSnapshot,
    blockError,
    transactionError,
    receiptError,
    feeDataError,
    isLoadingBlock,
    isLoadingTransaction,
    isLoadingReceipt,
    isLoadingFeeData,
    fetchBlock,
    fetchTransaction,
    fetchReceipt,
    fetchFeeData,
    resetSnapshots,
  };
}
