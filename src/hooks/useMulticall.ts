import {
  BrowserProvider,
  Contract,
  Interface,
  formatUnits,
  getAddress,
  isAddress,
} from "ethers";
import { useCallback, useMemo, useState } from "react";
import { ERC20_ABI } from "../constants/abis";
import { MULTICALL3_ADDRESS } from "../config/appConfig";

const MULTICALL_ABI = [
  "function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) public view returns (tuple(bool success, bytes returnData)[])",
];

type TokenEntry = {
  id: string;
  address: string;
};

export type MulticallTokenResult = {
  id: string;
  address: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  balance?: string;
  error?: string;
};

type UseMulticallArgs = {
  provider: BrowserProvider | null;
  account: string | null;
  defaultTokens: string[];
};

const createTokenEntry = (address = ""): TokenEntry => ({
  id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
  address,
});

export function useMulticall({
  provider,
  account,
  defaultTokens,
}: UseMulticallArgs) {
  const [tokens, setTokens] = useState<TokenEntry[]>(
    defaultTokens.length ? defaultTokens.map(createTokenEntry) : [createTokenEntry()]
  );
  const [results, setResults] = useState<MulticallTokenResult[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const erc20Interface = useMemo(() => new Interface(ERC20_ABI), []);

  const updateTokenAddress = useCallback((id: string, value: string) => {
    setTokens((previous) =>
      previous.map((token) =>
        token.id === id ? { ...token, address: value } : token
      )
    );
  }, []);

  const addTokenRow = useCallback(() => {
    setTokens((previous) => [...previous, createTokenEntry()]);
  }, []);

  const removeTokenRow = useCallback((id: string) => {
    setTokens((previous) => {
      if (previous.length === 1) {
        return [createTokenEntry()];
      }
      return previous.filter((token) => token.id !== id);
    });
  }, []);

  const resetTokens = useCallback(() => {
    setTokens(
      defaultTokens.length
        ? defaultTokens.map(createTokenEntry)
        : [createTokenEntry()]
    );
    setResults([]);
    setError(null);
  }, [defaultTokens]);

  const runMulticall = useCallback(async () => {
    if (!provider) {
      setError("连接 MetaMask 并选择一个 RPC 节点后才能执行 Multicall");
      return;
    }

    setIsQuerying(true);
    setError(null);

    const normalizedTokens: Array<
      TokenEntry & { normalized: string }
    > = [];
    const preliminaryResults: MulticallTokenResult[] = [];

    tokens.forEach((token) => {
      const trimmed = token.address.trim();
      if (!trimmed) {
        preliminaryResults.push({
          id: token.id,
          address: "",
          error: "请输入合约地址",
        });
        return;
      }
      if (!isAddress(trimmed)) {
        preliminaryResults.push({
          id: token.id,
          address: trimmed,
          error: "地址格式无效",
        });
        return;
      }
      normalizedTokens.push({
        ...token,
        normalized: getAddress(trimmed),
      });
    });

    if (!normalizedTokens.length) {
      setResults(preliminaryResults);
      setIsQuerying(false);
      return;
    }

    try {
      const contract = new Contract(
        MULTICALL3_ADDRESS,
        MULTICALL_ABI,
        provider
      );

      type PreparedCall = {
        tokenId: string;
        address: string;
        kind: "name" | "symbol" | "decimals" | "balance";
        decode: (data: string) => unknown[];
      };

      const preparedCalls: PreparedCall[] = [];

      normalizedTokens.forEach((token) => {
        preparedCalls.push({
          tokenId: token.id,
          address: token.normalized,
          kind: "name",
          decode: (data) => erc20Interface.decodeFunctionResult("name", data),
        });
        preparedCalls.push({
          tokenId: token.id,
          address: token.normalized,
          kind: "symbol",
          decode: (data) => erc20Interface.decodeFunctionResult("symbol", data),
        });
        preparedCalls.push({
          tokenId: token.id,
          address: token.normalized,
          kind: "decimals",
          decode: (data) =>
            erc20Interface.decodeFunctionResult("decimals", data),
        });
        if (account) {
          preparedCalls.push({
            tokenId: token.id,
            address: token.normalized,
            kind: "balance",
            decode: (data) =>
              erc20Interface.decodeFunctionResult("balanceOf", data),
          });
        }
      });

      const callStructs = preparedCalls.map((call) => ({
        target: call.address,
        callData:
          call.kind === "name"
            ? erc20Interface.encodeFunctionData("name", [])
            : call.kind === "symbol"
            ? erc20Interface.encodeFunctionData("symbol", [])
            : call.kind === "decimals"
            ? erc20Interface.encodeFunctionData("decimals", [])
            : erc20Interface.encodeFunctionData("balanceOf", [account]),
      }));

      const response: Array<{
        success: boolean;
        returnData: string;
      }> = await contract.tryAggregate.staticCall(false, callStructs);

      const aggregated = new Map<string, MulticallTokenResult>();
      normalizedTokens.forEach((token) => {
        aggregated.set(token.id, {
          id: token.id,
          address: token.normalized,
        });
      });

      response.forEach((entry, index) => {
        const meta = preparedCalls[index];
        const existing = aggregated.get(meta.tokenId);
        if (!existing) return;
        if (!entry.success) {
          existing.error = `调用 ${meta.kind} 失败`;
          return;
        }
        const decoded = meta.decode(entry.returnData);
        switch (meta.kind) {
          case "name":
            existing.name = decoded[0] as string;
            break;
          case "symbol":
            existing.symbol = decoded[0] as string;
            break;
          case "decimals":
            existing.decimals = Number(decoded[0]);
            break;
          case "balance":
            if (existing.decimals !== undefined) {
              existing.balance = formatUnits(
                decoded[0] as bigint,
                existing.decimals
              );
            } else {
              existing.balance = (decoded[0] as bigint).toString();
            }
            break;
        }
      });

      const finalResults: MulticallTokenResult[] = tokens.map((token) => {
        if (preliminaryResults.some((pre) => pre.id === token.id)) {
          const pre = preliminaryResults.find((pre) => pre.id === token.id);
          if (pre) return pre;
        }
        const result = aggregated.get(token.id);
        return (
          result ?? {
            id: token.id,
            address: token.address,
            error: "未能获取此合约的数据",
          }
        );
      });

      setResults(finalResults);
    } catch (err) {
      setError((err as Error).message);
      setResults([]);
    } finally {
      setIsQuerying(false);
    }
  }, [provider, tokens, erc20Interface, account]);

  return {
    tokens,
    results,
    isQuerying,
    error,
    updateTokenAddress,
    addTokenRow,
    removeTokenRow,
    resetTokens,
    runMulticall,
  };
}
