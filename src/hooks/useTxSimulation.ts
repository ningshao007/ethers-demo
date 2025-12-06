import {
  BrowserProvider,
  formatUnits,
  getAddress,
  isAddress,
  parseEther,
} from "ethers";
import type { TransactionRequest } from "ethers";
import { useCallback, useState } from "react";

type UseTxSimulationArgs = {
  provider: BrowserProvider | null;
  account: string | null;
};

type SimulationInput = {
  to: string;
  valueEth: string;
  data?: string;
};

export type SimulationResult = {
  normalizedTo: string;
  valueEth: string;
  gasEstimate: string;
  gasEstimateHex: string;
  gasPriceGwei?: string;
  estimatedFeeEth?: string;
  callSuccess: boolean;
  callOutput?: string;
  revertReason?: string;
};

export function useTxSimulation({
  provider,
  account,
}: UseTxSimulationArgs) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetSimulation = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const simulateTransaction = useCallback(
    async ({ to, valueEth, data }: SimulationInput) => {
      if (!provider || !account) {
        setError("连接钱包并确保 provider 可用后才能模拟");
        return;
      }

      const trimmedTo = to.trim();
      if (!isAddress(trimmedTo)) {
        setError("请输入合法的 0x 开头接收地址");
        return;
      }

      const normalizedTo = getAddress(trimmedTo);

      const parsedValue = valueEth.trim() ? valueEth.trim() : "0";
      let valueWei: bigint;
      try {
        valueWei = parseEther(parsedValue);
      } catch {
        setError("ETH 数量格式不正确");
        return;
      }

      let txData: string | undefined;
      if (data && data.trim().length > 0) {
        const trimmedData = data.trim();
        if (!/^0x[0-9a-fA-F]*$/.test(trimmedData)) {
          setError("Data 必须是 0x 开头的十六进制字符串");
          return;
        }
        txData = trimmedData;
      }

      setIsSimulating(true);
      setError(null);
      setResult(null);

      try {
        const txRequest: TransactionRequest = {
          from: account,
          to: normalizedTo,
          value: valueWei,
          data: txData,
        };

        const [gasEstimate, feeData] = await Promise.all([
          provider.estimateGas(txRequest),
          provider.getFeeData(),
        ]);
        const gasPriceWei =
          feeData.gasPrice ??
          feeData.maxFeePerGas ??
          feeData.maxPriorityFeePerGas ??
          null;
        const gasEstimateHex = `0x${gasEstimate.toString(16)}`;
        const gasPriceGwei = gasPriceWei
          ? formatUnits(gasPriceWei, "gwei")
          : undefined;
        const estimatedFeeWei =
          gasPriceWei !== null && gasPriceWei !== undefined
            ? gasEstimate * gasPriceWei
            : null;
        const estimatedFeeEth = estimatedFeeWei
          ? formatUnits(estimatedFeeWei, "ether")
          : undefined;

        let callSuccess = true;
        let callOutput: string | undefined;
        let revertReason: string | undefined;
        try {
          callOutput = await provider.call(txRequest);
        } catch (err) {
          callSuccess = false;
          const e = err as {
            shortMessage?: string;
            message?: string;
            reason?: string;
            info?: { error?: { message?: string } };
          };
          revertReason =
            e.shortMessage ??
            e.reason ??
            e.info?.error?.message ??
            e.message ??
            "Unknown revert reason";
        }

        setResult({
          normalizedTo,
          valueEth: parsedValue,
          gasEstimate: gasEstimate.toString(),
          gasEstimateHex,
          gasPriceGwei,
          estimatedFeeEth,
          callSuccess,
          callOutput,
          revertReason,
        });
      } catch (err) {
        setError((err as Error).message);
        setResult(null);
      } finally {
        setIsSimulating(false);
      }
    },
    [provider, account]
  );

  return {
    simulateTransaction,
    isSimulating,
    result,
    error,
    resetSimulation,
  };
}
