import {
  BrowserProvider,
  JsonRpcSigner,
  formatEther,
  getAddress,
} from "ethers";
import { useCallback, useEffect, useState } from "react";

type WalletOptions = {
  onAccountChanged?: (account: string | null) => void;
  onDisconnect?: () => void;
};

export function useWallet(options?: WalletOptions) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [networkName, setNetworkName] = useState<string>("");
  const [balance, setBalance] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const hasMetaMask = typeof window !== "undefined" && Boolean(window.ethereum);

  const shortAccount = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : "";

  const refreshBalance = async () => {
    if (!provider || !account) return;
    try {
      const raw = await provider.getBalance(account);
      setBalance(formatEther(raw));
    } catch (error) {
      setWalletError((error as Error).message);
    }
  };

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setNetworkName("");
    setBalance("");
    setWalletError(null);
    options?.onDisconnect?.();
  }, [options]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setWalletError("MetaMask is not available in this browser");
      return;
    }
    if (!window.ethereum.request) {
      setWalletError("MetaMask provider is missing the request method");
      return;
    }

    setIsConnecting(true);
    setWalletError(null);

    try {
      const accountsResponse = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const accounts = Array.isArray(accountsResponse)
        ? (accountsResponse as string[])
        : [];

      if (!accounts.length) {
        throw new Error("No account returned by MetaMask");
      }

      const nextProvider = new BrowserProvider(window.ethereum);
      const nextSigner = await nextProvider.getSigner();
      const network = await nextProvider.getNetwork();
      const normalizedAccount = getAddress(accounts[0]);

      setProvider(nextProvider);
      setSigner(nextSigner);
      setAccount(normalizedAccount);
      setChainId(Number(network.chainId));
      setNetworkName(network.name);
      const raw = await nextProvider.getBalance(normalizedAccount);
      setBalance(formatEther(raw));
      options?.onAccountChanged?.(normalizedAccount);
    } catch (error) {
      const err = error as { code?: number; message?: string };
      const message =
        err.code === 4001
          ? "用户拒绝了连接请求"
          : err.message || "Failed to connect wallet";
      setWalletError(message);
      disconnectWallet();
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) return;
    if (!provider) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const nextAccounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];
      if (!nextAccounts.length) {
        disconnectWallet();
        return;
      }
      const normalizedAccount = getAddress(nextAccounts[0]);
      setAccount(normalizedAccount);
      options?.onAccountChanged?.(normalizedAccount);

      provider
        .getSigner()
        .then(setSigner)
        .catch((error) => setWalletError((error as Error).message));
      provider
        .getBalance(normalizedAccount)
        .then((raw) => setBalance(formatEther(raw)))
        .catch((error) => setWalletError((error as Error).message));
    };

    const handleChainChanged = (..._args: unknown[]) => {
      provider
        .getNetwork()
        .then((network) => {
          setChainId(Number(network.chainId));
          setNetworkName(network.name);
          if (!account) return;
          return provider.getBalance(account);
        })
        .then((raw) => {
          if (typeof raw === "undefined") return;
          setBalance(formatEther(raw));
        })
        .catch((error) => setWalletError((error as Error).message));
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [provider, disconnectWallet, options, account]);

  return {
    provider,
    signer,
    account,
    chainId,
    networkName,
    balance,
    isConnecting,
    walletError,
    hasMetaMask,
    shortAccount,
    connectWallet,
    disconnectWallet,
    refreshBalance,
    setWalletError,
  };
}
