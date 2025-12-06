import "./App.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ERC20_ADDRESS,
  DEFAULT_MULTICALL_TOKENS,
} from "./config/appConfig";
import { useWallet } from "./hooks/useWallet";
import { useErc20 } from "./hooks/useErc20";
import { useSiweAuth } from "./hooks/useSiwe";
import { useEip191Auth } from "./hooks/useEip191";
import { useEip712Auth } from "./hooks/useEip712";
import { useMempool } from "./hooks/useMempool";
import { useUsdtTransfers } from "./hooks/useUsdtTransfers";
import { useTxSimulation } from "./hooks/useTxSimulation";
import { useMulticall } from "./hooks/useMulticall";
import { useChainSnapshots } from "./hooks/useChainSnapshots";
import { useNonceManager } from "./hooks/useNonceManager";
import { getAddress, isAddress } from "ethers";

function App() {
  const [messageToSign, setMessageToSign] = useState("Hello from ethers.js");
  const [personalSignature, setPersonalSignature] = useState("");
  const [isSigningMessage, setIsSigningMessage] = useState(false);
  const [watchCurrentAccountOnly, setWatchCurrentAccountOnly] = useState(true);
  const [usdtFromFilter, setUsdtFromFilter] = useState("");
  const [usdtToFilter, setUsdtToFilter] = useState("");
  const [usdtFilterError, setUsdtFilterError] = useState<string | null>(null);
  const [simulationTo, setSimulationTo] = useState("0xdAC17F958D2ee523a2206206994597C13D831ec7");
  const [simulationValue, setSimulationValue] = useState("0.01");
  const [simulationData, setSimulationData] = useState("");
  const [blockNumberInput, setBlockNumberInput] = useState("");
  const [blockInputError, setBlockInputError] = useState<string | null>(null);
  const [txHashInput, setTxHashInput] = useState("");
  const [pendingTxHashInput, setPendingTxHashInput] = useState("");
  const [feeOverrides, setFeeOverrides] = useState<
    Record<
      string,
      {
        maxFee?: string;
        maxPriority?: string;
        gasPrice?: string;
      }
    >
  >({});
  const [resendStatus, setResendStatus] = useState<
    Record<string, { loading: boolean; error: string | null; success: string | null }>
  >({});

  const {
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
  } = useWallet();

  const {
    erc20Address,
    setErc20Address,
    erc20Info,
    erc20Loading,
    contractError,
    transferTo,
    setTransferTo,
    transferAmount,
    setTransferAmount,
    transferToken,
    txStatus,
    txHash,
    txError,
    loadErc20Details,
    identifyErc20Contract,
    erc20CheckStatus,
    erc20CheckMessage,
    clearErc20Info,
    reset: resetErc20,
  } = useErc20({
    provider,
    signer,
    account,
    refreshBalance,
    defaultAddress: DEFAULT_ERC20_ADDRESS,
  });

  const {
    siweSession,
    siweStatus,
    isAuthenticating,
    siweError,
    signInWithEthereum,
    logoutSiwe,
    resetSiwe,
  } = useSiweAuth(signer, account, chainId);

  const {
    nonce: eip191Nonce,
    message: eip191Message,
    signature: eip191Signature,
    isSigning: isSigningEip191,
    result: eip191Result,
    error: eip191Error,
    authenticateEip191,
    resetEip191,
  } = useEip191Auth(signer, account);

  const {
    challenge: eip712Challenge,
    signature: eip712Signature,
    result: eip712Result,
    isSigning: isSigningEip712,
    error: eip712Error,
    authenticateEip712,
    resetEip712,
  } = useEip712Auth(signer, account, chainId);

  const {
    pendingTxs,
    isMonitoring: isMonitoringMempool,
    error: mempoolError,
    startMonitoring,
    stopMonitoring,
    clearPendingTxs,
  } = useMempool(provider, watchCurrentAccountOnly ? account : null);

  const normalizedUsdtFrom = useMemo(() => {
    if (!usdtFromFilter) return null;
    if (!isAddress(usdtFromFilter)) return null;
    return getAddress(usdtFromFilter);
  }, [usdtFromFilter]);

  const normalizedUsdtTo = useMemo(() => {
    if (!usdtToFilter) return null;
    if (!isAddress(usdtToFilter)) return null;
    return getAddress(usdtToFilter);
  }, [usdtToFilter]);

  const {
    transfers: usdtTransfers,
    isListening: isListeningUsdt,
    error: usdtError,
    startListening: startUsdtListener,
    stopListening: stopUsdtListener,
    resetTransfers: resetUsdtTransfers,
  } = useUsdtTransfers({
    from: normalizedUsdtFrom,
    to: normalizedUsdtTo,
  });

  const {
    simulateTransaction,
    isSimulating,
    result: simulationResult,
    error: simulationError,
    resetSimulation,
  } = useTxSimulation({ provider, account });

  const {
    tokens: multicallTokens,
    results: multicallResults,
    isQuerying: isQueryingMulticall,
    error: multicallError,
    updateTokenAddress: updateMulticallToken,
    addTokenRow: addMulticallToken,
    removeTokenRow: removeMulticallToken,
    resetTokens: resetMulticallTokens,
    runMulticall,
  } = useMulticall({
    provider,
    account,
    defaultTokens: DEFAULT_MULTICALL_TOKENS,
  });

  const {
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
    resetSnapshots: resetChainSnapshots,
  } = useChainSnapshots(provider);

  const {
    latestNonce,
    pendingNonce,
    pendingTxs: accountPendingTxs,
    nonceError,
    trackingError,
    isRefreshingNonce,
    refreshNonce,
    importPendingTx,
    removePendingTx,
    clearTracking: clearPendingTracking,
    resendTransaction,
  } = useNonceManager({ provider, account, signer });

  useEffect(() => {
    resetSiwe();
    resetEip191();
    resetEip712();
    resetErc20();
    resetSimulation();
  }, [account, resetSiwe, resetEip191, resetEip712, resetErc20, resetSimulation]);

  useEffect(() => {
    if (!account) {
      setWatchCurrentAccountOnly(true);
    }
  }, [account]);

  useEffect(() => {
    if (!provider) {
      resetChainSnapshots();
    }
  }, [provider, resetChainSnapshots]);

  const signMessage = useCallback(async () => {
    if (!signer) {
      setWalletError("Connect MetaMask before signing");
      return;
    }

    setIsSigningMessage(true);
    setWalletError(null);

    try {
      const signed = await signer.signMessage(messageToSign);
      setPersonalSignature(signed);
    } catch (error) {
      setWalletError((error as Error).message);
    } finally {
      setIsSigningMessage(false);
    }
  }, [signer, messageToSign, setWalletError]);

  const handleStartUsdtListener = useCallback(() => {
    if (usdtFromFilter && !isAddress(usdtFromFilter)) {
      setUsdtFilterError("From 地址不是有效的以太坊地址");
      return;
    }
    if (usdtToFilter && !isAddress(usdtToFilter)) {
      setUsdtFilterError("To 地址不是有效的以太坊地址");
      return;
    }
    setUsdtFilterError(null);
    startUsdtListener();
  }, [usdtFromFilter, usdtToFilter, startUsdtListener]);

  const handleSimulateTransaction = useCallback(() => {
    simulateTransaction({
      to: simulationTo,
      valueEth: simulationValue,
      data: simulationData,
    });
  }, [simulateTransaction, simulationTo, simulationValue, simulationData]);

  const handleFetchBlock = useCallback(() => {
    if (!blockNumberInput.trim()) {
      setBlockInputError(null);
      fetchBlock("latest");
      return;
    }
    const parsed = Number(blockNumberInput);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setBlockInputError("请输入非负整数的区块高度，或留空查询最新区块");
      return;
    }
    setBlockInputError(null);
    fetchBlock(parsed);
  }, [blockNumberInput, fetchBlock]);

  const handleFetchLatestBlock = useCallback(() => {
    setBlockInputError(null);
    fetchBlock("latest");
  }, [fetchBlock]);

  const handleFetchTransaction = useCallback(() => {
    fetchTransaction(txHashInput.trim());
  }, [fetchTransaction, txHashInput]);

  const handleFetchReceipt = useCallback(() => {
    fetchReceipt(txHashInput.trim());
  }, [fetchReceipt, txHashInput]);

  const handleRefreshFeeData = useCallback(() => {
    fetchFeeData();
  }, [fetchFeeData]);

  useEffect(() => {
    setFeeOverrides((previous) => {
      const next = { ...previous };
      accountPendingTxs.forEach((tx) => {
        if (!next[tx.hash]) {
          if (tx.maxFeePerGasGwei) {
            const base = Number(tx.maxFeePerGasGwei);
            const priorityBase = Number(tx.maxPriorityFeePerGasGwei ?? tx.maxFeePerGasGwei ?? "0");
            next[tx.hash] = {
              maxFee: base ? (base * 1.1).toFixed(2) : "",
              maxPriority: priorityBase
                ? (priorityBase * 1.2).toFixed(2)
                : "",
            };
          } else {
            const gasPriceBase = Number(tx.gasPriceGwei ?? "0");
            next[tx.hash] = {
              gasPrice: gasPriceBase ? (gasPriceBase * 1.1).toFixed(2) : "",
            };
          }
        }
      });
      Object.keys(next).forEach((hash) => {
        if (!accountPendingTxs.find((tx) => tx.hash === hash)) {
          delete next[hash];
        }
      });
      return next;
    });
    setResendStatus((previous) => {
      const next: typeof previous = {};
      accountPendingTxs.forEach((tx) => {
        next[tx.hash] = previous[tx.hash] ?? {
          loading: false,
          error: null,
          success: null,
        };
      });
      return next;
    });
  }, [accountPendingTxs]);

  const handleImportPendingTx = useCallback(() => {
    if (!pendingTxHashInput.trim()) return;
    importPendingTx(pendingTxHashInput.trim());
    setPendingTxHashInput("");
  }, [pendingTxHashInput, importPendingTx]);

  const handleResendTx = useCallback(
    async (hash: string) => {
      const target = accountPendingTxs.find((tx) => tx.hash === hash);
      if (!target) return;
      const overrides = feeOverrides[hash] ?? {};
      setResendStatus((previous) => ({
        ...previous,
        [hash]: { loading: true, error: null, success: null },
      }));
      try {
        await resendTransaction(target, {
          maxFeePerGasGwei: overrides.maxFee,
          maxPriorityFeePerGasGwei: overrides.maxPriority,
          gasPriceGwei: overrides.gasPrice,
        });
        setResendStatus((previous) => ({
          ...previous,
          [hash]: { loading: false, error: null, success: "已广播新的交易" },
        }));
        refreshNonce();
      } catch (error) {
        setResendStatus((previous) => ({
          ...previous,
          [hash]: {
            loading: false,
            error: (error as Error).message,
            success: null,
          },
        }));
      }
    },
    [accountPendingTxs, feeOverrides, resendTransaction, refreshNonce]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
        <header className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
          <h1 className="text-3xl font-semibold text-white text-left">
            MetaMask bridge with contract utilities
          </h1>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={account ? disconnectWallet : connectWallet}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isConnecting}
            >
              {account
                ? "Disconnect"
                : isConnecting
                ? "Connecting..."
                : "Connect MetaMask"}
            </button>
            {account && (
              <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm font-mono text-emerald-300">
                {shortAccount}
              </div>
            )}
            {!hasMetaMask && (
              <span className="text-sm text-amber-400">
                Install MetaMask to interact with the demo.
              </span>
            )}
          </div>
          {walletError && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {walletError}
            </p>
          )}
        </header>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm shadow-slate-900">
            <h2 className="text-lg font-semibold text-white">
              Wallet snapshot
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Account</dt>
                <dd className="font-mono text-slate-100">{account ?? "--"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Balance</dt>
                <dd className="font-semibold text-emerald-300">
                  {balance ? `${Number(balance).toFixed(4)} ETH` : "--"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Chain</dt>
                <dd className="font-mono text-slate-100">
                  {chainId ? `#${chainId} (${networkName})` : "--"}
                </dd>
              </div>
            </dl>
            <button
              onClick={refreshBalance}
              disabled={!account}
              className="mt-6 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-white transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh balance
            </button>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm shadow-slate-900">
            <h2 className="text-lg font-semibold text-white">
              Sign an arbitrary message
            </h2>
            <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400">
              Message
            </label>
            <textarea
              value={messageToSign}
              onChange={(event) => setMessageToSign(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
              rows={3}
            />
            <button
              onClick={signMessage}
              disabled={!account || isSigningMessage}
              className="mt-4 w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigningMessage ? "Signing..." : "Sign with MetaMask"}
            </button>
            {personalSignature && (
              <div className="mt-4 rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-3 text-xs font-mono text-indigo-200 break-all">
                {personalSignature}
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm shadow-slate-900">
            <h2 className="text-lg font-semibold text-white">
              Sign-In with Ethereum
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Requests a nonce from the NestJS backend, signs it with the
              connected wallet, and verifies the signature server-side.
            </p>
            <button
              onClick={
                siweStatus === "authenticated" ? logoutSiwe : signInWithEthereum
              }
              disabled={!account || isAuthenticating}
              className="mt-6 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {siweStatus === "authenticated"
                ? "Sign out of SIWE"
                : isAuthenticating
                ? "Verifying..."
                : "Sign-In with Ethereum"}
            </button>

            {siweSession && (
              <div className="mt-4 space-y-1 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4 text-sm font-mono text-emerald-200">
                <p className="text-xs uppercase text-emerald-400">Address</p>
                <p className="break-all">{siweSession.address}</p>
                <p className="text-xs uppercase text-emerald-400">
                  Chain #{siweSession.chainId}
                </p>
                {siweSession.issuedAt && (
                  <p className="text-xs text-slate-400">
                    Issued at {siweSession.issuedAt}
                  </p>
                )}
              </div>
            )}
            {siweError && (
              <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {siweError}
              </p>
            )}
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm shadow-slate-900">
            <h2 className="text-lg font-semibold text-white">
              EIP-191 personal_sign
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Fetches a nonce, creates a plain-text challenge, signs it via
              <code className="mx-1 rounded bg-slate-800 px-1 text-xs text-white">
                personal_sign
              </code>
              , and asks NestJS to verify the signature.
            </p>
            <button
              onClick={authenticateEip191}
              disabled={!account || isSigningEip191}
              className="mt-6 w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigningEip191 ? "Signing..." : "Authenticate via EIP-191"}
            </button>
            <button
              onClick={resetEip191}
              className="mt-2 w-full rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
            >
              Clear EIP-191 state
            </button>

            {eip191Nonce && (
              <p className="mt-3 text-xs text-slate-400">
                Nonce:{" "}
                <span className="font-mono text-slate-100">{eip191Nonce}</span>
              </p>
            )}

            {eip191Message && (
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-200">
                <p className="text-[10px] uppercase text-slate-400">Message</p>
                <pre className="mt-1 whitespace-pre-wrap break-words text-slate-100">
                  {eip191Message}
                </pre>
              </div>
            )}

            {eip191Signature && (
              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-xs font-mono text-slate-200 break-all">
                <p className="text-[10px] uppercase text-slate-400">
                  Signature
                </p>
                {eip191Signature}
              </div>
            )}

            {eip191Result && (
              <div className="mt-3 space-y-1 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs font-mono text-emerald-200">
                <p className="text-[10px] uppercase text-emerald-400">
                  Server verification
                </p>
                <p>Address: {eip191Result.address}</p>
                <p>Nonce: {eip191Result.nonce}</p>
                <p>Status: {eip191Result.verified ? "verified" : "unknown"}</p>
              </div>
            )}

            {eip191Error && (
              <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {eip191Error}
              </p>
            )}
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm shadow-slate-900">
            <h2 className="text-lg font-semibold text-white">
              EIP-712 typed data
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Gets a typed-data challenge from NestJS and signs it with
              <code className="mx-1 rounded bg-slate-800 px-1 text-xs text-white">
                signTypedData
              </code>
              .
            </p>
            <button
              onClick={authenticateEip712}
              disabled={!account || isSigningEip712}
              className="mt-6 w-full rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigningEip712 ? "Signing..." : "Authenticate via EIP-712"}
            </button>
            <button
              onClick={resetEip712}
              className="mt-2 w-full rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
            >
              Clear EIP-712 state
            </button>

            {eip712Challenge && (
              <div className="mt-4 space-y-1 rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-200">
                <p className="text-[10px] uppercase text-slate-400">Domain</p>
                <p>
                  {eip712Challenge.domain.name} v
                  {eip712Challenge.domain.version}
                  &nbsp;· chain {eip712Challenge.domain.chainId}
                </p>
                <p className="text-[10px] uppercase text-slate-400">Message</p>
                <pre className="whitespace-pre-wrap break-words">
                  {JSON.stringify(eip712Challenge.message, null, 2)}
                </pre>
              </div>
            )}

            {eip712Signature && (
              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-xs font-mono text-slate-200 break-all">
                <p className="text-[10px] uppercase text-slate-400">
                  Signature
                </p>
                {eip712Signature}
              </div>
            )}

            {eip712Result && (
              <div className="mt-3 space-y-1 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs font-mono text-emerald-200">
                <p className="text-[10px] uppercase text-emerald-400">
                  Server verification
                </p>
                <p>Address: {eip712Result.address}</p>
                <p>Nonce: {eip712Result.nonce}</p>
                {eip712Result.issuedAt && (
                  <p>Issued: {eip712Result.issuedAt}</p>
                )}
                <p>Status: {eip712Result.verified ? "verified" : "unknown"}</p>
              </div>
            )}

            {eip712Error && (
              <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {eip712Error}
              </p>
            )}
          </article>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-900">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                ERC-20 contract helper
              </h2>
              <p className="text-sm text-slate-400">
                Paste any ERC-20 address on the connected chain. Use the sample
                value if you are connected to Sepolia testnet.
              </p>
            </div>
            <button
              className="text-xs font-semibold uppercase tracking-wide text-slate-400 underline-offset-2 hover:text-white hover:underline"
              onClick={() => setErc20Address(DEFAULT_ERC20_ADDRESS)}
            >
              Use Sepolia sample
            </button>
          </div>

          <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400">
            Contract address
          </label>
          <input
            value={erc20Address}
            onChange={(event) => setErc20Address(event.target.value)}
            placeholder="0x..."
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={loadErc20Details}
              disabled={erc20Loading}
              className="flex-1 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {erc20Loading ? "Loading..." : "Read metadata"}
            </button>
            <button
              onClick={identifyErc20Contract}
              className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
            >
              {erc20CheckStatus === "checking"
                ? "Identifying..."
                : "Identify ERC-20"}
            </button>
            <button
              onClick={clearErc20Info}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Reset
            </button>
          </div>

          {contractError && (
            <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {contractError}
            </p>
          )}
          {erc20CheckStatus !== "idle" && (
            <p
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                erc20CheckStatus === "erc20"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : erc20CheckStatus === "checking"
                  ? "border-slate-600 bg-slate-800/50 text-slate-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              {erc20CheckStatus === "checking"
                ? "Identifying contract..."
                : erc20CheckMessage}
            </p>
          )}

          {erc20Info && (
            <div className="mt-6 space-y-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-400">Name</dt>
                  <dd className="font-semibold text-white">{erc20Info.name}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Symbol</dt>
                  <dd className="font-semibold text-white">
                    {erc20Info.symbol}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Decimals</dt>
                  <dd className="font-semibold text-white">
                    {erc20Info.decimals}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Your balance</dt>
                  <dd className="font-semibold text-emerald-300">
                    {erc20Info.balance ? `${erc20Info.balance}` : "--"}
                  </dd>
                </div>
              </dl>

              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-sm font-semibold text-white">
                  Transfer tokens
                </p>
                <label className="block text-xs uppercase tracking-wide text-slate-400">
                  Destination
                  <input
                    value={transferTo}
                    onChange={(event) => setTransferTo(event.target.value)}
                    placeholder="0x..."
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="block text-xs uppercase tracking-wide text-slate-400">
                  Amount ({erc20Info.symbol})
                  <input
                    value={transferAmount}
                    onChange={(event) => setTransferAmount(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  />
                </label>
                <button
                  onClick={transferToken}
                  disabled={txStatus === "pending"}
                  className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {txStatus === "pending"
                    ? "Waiting for confirmation..."
                    : "Send transfer"}
                </button>
                {txError && <p className="text-xs text-rose-300">{txError}</p>}
                {txHash && (
                  <p className="text-xs text-slate-400">
                    Last tx:{" "}
                    <span className="font-mono text-slate-200">{txHash}</span>
                  </p>
                )}
                {txStatus === "confirmed" && (
                  <p className="text-xs font-semibold text-emerald-300">
                    Transfer confirmed
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-900">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Transaction simulation & gas estimate
              </h2>
              <p className="text-sm text-slate-400">
                使用 `estimateGas`+`call` 预估 gas / 费用并提前捕获可能的 revert 原因。
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              To 地址
              <input
                value={simulationTo}
                onChange={(event) => {
                  setSimulationTo(event.target.value);
                  resetSimulation();
                }}
                placeholder="0x..."
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-slate-400">
              ETH 数量
              <input
                value={simulationValue}
                onChange={(event) => {
                  setSimulationValue(event.target.value);
                  resetSimulation();
                }}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
              />
            </label>
          </div>
          <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400">
            Data（可选）
            <textarea
              value={simulationData}
              onChange={(event) => {
                setSimulationData(event.target.value);
                resetSimulation();
              }}
              placeholder="0x..."
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 p-3 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleSimulateTransaction}
              disabled={!account || isSimulating}
              className="flex-1 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSimulating ? "Simulating..." : "Simulate transaction"}
            </button>
            <button
              onClick={resetSimulation}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Clear result
            </button>
          </div>

          {simulationError && (
            <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {simulationError}
            </p>
          )}

          {simulationResult && (
            <div className="mt-4 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-slate-500">Gas estimate</p>
                  <p className="font-semibold text-white">
                    {simulationResult.gasEstimate} units
                  </p>
                  <p className="text-xs text-slate-400">
                    ({simulationResult.gasEstimateHex})
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Gas price (suggested)</p>
                  <p className="font-semibold text-white">
                    {simulationResult.gasPriceGwei
                      ? `${simulationResult.gasPriceGwei} gwei`
                      : "--"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Estimated fee: {simulationResult.estimatedFeeEth ?? "--"} ETH
                  </p>
                </div>
              </div>
              <div>
                <p className="text-slate-500">Call status</p>
                <p
                  className={`font-semibold ${
                    simulationResult.callSuccess
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }`}
                >
                  {simulationResult.callSuccess ? "Success" : "Reverted"}
                </p>
                {simulationResult.callSuccess && simulationResult.callOutput && (
                  <p className="mt-1 font-mono text-xs text-slate-400 break-all">
                    Output: {simulationResult.callOutput}
                  </p>
                )}
                {!simulationResult.callSuccess && simulationResult.revertReason && (
                  <p className="mt-1 text-xs text-rose-200">
                    Reason: {simulationResult.revertReason}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-900">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white">
                ERC-20 多合约批量读取（Multicall3）
              </h2>
              <p className="text-sm text-slate-400">
                一次 RPC 请求批量获取多个合约的 name / symbol / decimals，并在连接钱包后同步读取
                balanceOf。
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {multicallTokens.map((token, index) => (
              <div
                key={token.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    合约地址 #{index + 1}
                  </label>
                  <input
                    value={token.address}
                    onChange={(event) =>
                      updateMulticallToken(token.id, event.target.value)
                    }
                    placeholder="0x..."
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>
                <button
                  onClick={() => removeMulticallToken(token.id)}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
                >
                  移除
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={addMulticallToken}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-white hover:border-slate-500"
            >
              + 添加合约
            </button>
            <button
              onClick={runMulticall}
              disabled={isQueryingMulticall || !provider}
              className="flex-1 rounded-lg bg-lime-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isQueryingMulticall ? "Running multicall..." : "Run multicall"}
            </button>
            <button
              onClick={resetMulticallTokens}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Reset list
            </button>
          </div>

          {!account && (
            <p className="mt-3 text-xs text-slate-400">
              未连接钱包时会跳过 balanceOf 调用，只返回 metadata。
            </p>
          )}

          {multicallError && (
            <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {multicallError}
            </p>
          )}

          {multicallResults.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Address</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Symbol</th>
                    <th className="px-3 py-2">Decimals</th>
                    <th className="px-3 py-2">Balance</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {multicallResults.map((item) => (
                    <tr key={item.id} className="border-t border-slate-800">
                      <td className="px-3 py-2 font-mono text-xs text-slate-300 break-all">
                        {item.address || "--"}
                      </td>
                      <td className="px-3 py-2 text-white">
                        {item.name ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-white">
                        {item.symbol ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-white">
                        {item.decimals ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-emerald-200">
                        {item.balance ?? (account ? "--" : "Connect wallet")}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {item.error ? (
                          <span className="text-rose-300">{item.error}</span>
                        ) : (
                          <span className="text-emerald-300">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!multicallResults.length && !multicallError && (
            <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-4 text-sm text-slate-400">
              输入多个合约地址后点击“Run multicall”即可批量获取它们的基础信息。
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-900">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white">
                On-chain state snapshots
              </h2>
              <p className="text-sm text-slate-400">
                直接调用 provider.getBlock / getTransaction / getTransactionReceipt / getFeeData，
                查看实时区块、交易与 gas 费率信息。
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Block number（留空=latest）
              <input
                value={blockNumberInput}
                onChange={(event) => {
                  setBlockNumberInput(event.target.value);
                  setBlockInputError(null);
                }}
                placeholder="例如 19000000"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Transaction hash
              <input
                value={txHashInput}
                onChange={(event) => setTxHashInput(event.target.value)}
                placeholder="0x..."
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleFetchBlock}
              disabled={!provider || isLoadingBlock}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoadingBlock ? "Fetching block..." : "Fetch block"}
            </button>
            <button
              onClick={handleFetchLatestBlock}
              disabled={!provider}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              Latest block
            </button>
            <button
              onClick={handleFetchTransaction}
              disabled={!provider || isLoadingTransaction}
              className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoadingTransaction ? "Fetching tx..." : "Get transaction"}
            </button>
            <button
              onClick={handleFetchReceipt}
              disabled={!provider || isLoadingReceipt}
              className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoadingReceipt ? "Fetching receipt..." : "Get receipt"}
            </button>
            <button
              onClick={handleRefreshFeeData}
              disabled={!provider || isLoadingFeeData}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoadingFeeData ? "Refreshing gas data..." : "Refresh gas data"}
            </button>
          </div>

          {blockInputError && (
            <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {blockInputError}
            </p>
          )}

          {blockError && (
            <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {blockError}
            </p>
          )}
          {transactionError && (
            <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {transactionError}
            </p>
          )}
          {receiptError && (
            <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {receiptError}
            </p>
          )}
          {feeDataError && (
            <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {feeDataError}
            </p>
          )}

          <div className="mt-5 space-y-4">
            {blockSnapshot && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Block snapshot
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  #{blockSnapshot.number}
                </p>
                <p className="font-mono text-xs text-slate-400 break-all">
                  {blockSnapshot.hash}
                </p>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Timestamp</dt>
                    <dd className="text-white">
                      {new Date(blockSnapshot.timestamp * 1000).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Miner</dt>
                    <dd className="font-mono text-slate-100">
                      {blockSnapshot.miner ?? "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Gas used / limit</dt>
                    <dd className="text-white">
                      {blockSnapshot.gasUsed} / {blockSnapshot.gasLimit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Base fee</dt>
                    <dd className="text-white">
                      {blockSnapshot.baseFeePerGasGwei
                        ? `${blockSnapshot.baseFeePerGasGwei} gwei`
                        : "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Tx count</dt>
                    <dd className="text-white">{blockSnapshot.transactionCount}</dd>
                  </div>
                </dl>
              </div>
            )}

            {transactionSnapshot && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Transaction snapshot
                </p>
                <p className="mt-1 font-mono text-xs text-slate-300 break-all">
                  {transactionSnapshot.hash}
                </p>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">From / To</dt>
                    <dd className="font-mono text-xs text-slate-100 break-all">
                      {transactionSnapshot.from}
                      <br />→ {transactionSnapshot.to ?? "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Value</dt>
                    <dd className="text-white">
                      {transactionSnapshot.valueEth} ETH
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Gas price</dt>
                    <dd className="text-white">
                      {transactionSnapshot.gasPriceGwei
                        ? `${transactionSnapshot.gasPriceGwei} gwei`
                        : "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Max fee / priority</dt>
                    <dd className="text-white">
                      {transactionSnapshot.maxFeePerGasGwei ?? "--"} /{" "}
                      {transactionSnapshot.maxPriorityFeePerGasGwei ?? "--"} gwei
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Block / confirmations</dt>
                    <dd className="text-white">
                      {transactionSnapshot.blockNumber ?? "--"} ·{" "}
                      {transactionSnapshot.confirmations ?? "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Type / nonce</dt>
                    <dd className="text-white">
                      {transactionSnapshot.type ?? "--"} / {transactionSnapshot.nonce}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {receiptSnapshot && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Receipt snapshot
                </p>
                <p className="mt-1 font-mono text-xs text-slate-300 break-all">
                  {receiptSnapshot.transactionHash}
                </p>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Status</dt>
                    <dd
                      className={
                        receiptSnapshot.status === 1
                          ? "text-emerald-300 font-semibold"
                          : "text-rose-300 font-semibold"
                      }
                    >
                      {receiptSnapshot.status === 1 ? "Success" : "Failed"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Block / confirmations</dt>
                    <dd className="text-white">
                      {receiptSnapshot.blockNumber} · {receiptSnapshot.confirmations}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Gas used</dt>
                    <dd className="text-white">{receiptSnapshot.gasUsed}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Cumulative gas</dt>
                    <dd className="text-white">
                      {receiptSnapshot.cumulativeGasUsed}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Effective gas price</dt>
                    <dd className="text-white">
                      {receiptSnapshot.effectiveGasPriceGwei
                        ? `${receiptSnapshot.effectiveGasPriceGwei} gwei`
                        : "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Logs count</dt>
                    <dd className="text-white">{receiptSnapshot.logsCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Contract address</dt>
                    <dd className="font-mono text-xs text-slate-100 break-all">
                      {receiptSnapshot.contractAddress ?? "--"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {feeDataSnapshot && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Fee data
                </p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Gas price</dt>
                    <dd className="text-white">
                      {feeDataSnapshot.gasPriceGwei
                        ? `${feeDataSnapshot.gasPriceGwei} gwei`
                        : "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Max fee</dt>
                    <dd className="text-white">
                      {feeDataSnapshot.maxFeePerGasGwei
                        ? `${feeDataSnapshot.maxFeePerGasGwei} gwei`
                        : "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Max priority</dt>
                    <dd className="text-white">
                      {feeDataSnapshot.maxPriorityFeePerGasGwei
                        ? `${feeDataSnapshot.maxPriorityFeePerGasGwei} gwei`
                        : "--"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-900">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Gas & nonce management
              </h2>
              <p className="text-sm text-slate-400">
                展示当前账号的 nonce 队列与未确认交易，支持自定义 maxFeePerGas / maxPriorityFeePerGas
                进行 replaceTx（或 legacy gasPrice）重发。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <div className="rounded-lg border border-slate-700 px-3 py-1">
                Latest nonce: {latestNonce ?? "--"}
              </div>
              <div className="rounded-lg border border-slate-700 px-3 py-1">
                Pending nonce: {pendingNonce ?? "--"}
              </div>
              <div className="rounded-lg border border-slate-700 px-3 py-1">
                Queue length:{" "}
                {latestNonce !== null && pendingNonce !== null
                  ? Math.max(pendingNonce - latestNonce, 0)
                  : "--"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={refreshNonce}
              disabled={!provider || !account || isRefreshingNonce}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRefreshingNonce ? "Refreshing..." : "Refresh nonce"}
            </button>
            <button
              onClick={clearPendingTracking}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Clear tracked txs
            </button>
            <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
              Next nonce: {pendingNonce ?? latestNonce ?? "--"}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Import tx hash（只支持当前钱包）
              </label>
              <input
                value={pendingTxHashInput}
                onChange={(event) => setPendingTxHashInput(event.target.value)}
                placeholder="0x..."
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
              />
            </div>
            <button
              onClick={handleImportPendingTx}
              disabled={!pendingTxHashInput}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Track tx
            </button>
          </div>

          {nonceError && (
            <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {nonceError}
            </p>
          )}
          {trackingError && (
            <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {trackingError}
            </p>
          )}

          {!accountPendingTxs.length && (
            <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-4 text-sm text-slate-400">
              暂无未确认交易，发送新交易或导入哈希即可开始管理。
            </p>
          )}

          <div className="mt-5 space-y-4">
            {accountPendingTxs.map((tx) => (
              <div
                key={tx.hash}
                className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Pending tx
                    </p>
                    <p className="font-mono text-xs text-slate-300 break-all">
                      {tx.hash}
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">
                    Nonce #{tx.nonce} · {tx.valueEth} ETH{" "}
                    {tx.to && (
                      <>
                        → <span className="font-mono">{tx.to}</span>
                      </>
                    )}
                  </div>
                </div>

                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Current fees</dt>
                    <dd className="text-white">
                      {tx.maxFeePerGasGwei
                        ? `${tx.maxFeePerGasGwei} gwei max / ${
                            tx.maxPriorityFeePerGasGwei ?? "--"
                          } priority`
                        : tx.gasPriceGwei
                        ? `${tx.gasPriceGwei} gwei`
                        : "--"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Tx type</dt>
                    <dd className="text-white">{tx.type ?? "--"}</dd>
                  </div>
                </dl>

                {tx.maxFeePerGasGwei ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-xs uppercase tracking-wide text-slate-400">
                      新 maxFeePerGas (gwei)
                      <input
                        value={feeOverrides[tx.hash]?.maxFee ?? ""}
                        onChange={(event) =>
                          setFeeOverrides((previous) => ({
                            ...previous,
                            [tx.hash]: {
                              ...previous[tx.hash],
                              maxFee: event.target.value,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
                      />
                    </label>
                    <label className="text-xs uppercase tracking-wide text-slate-400">
                      新 maxPriorityFeePerGas (gwei)
                      <input
                        value={feeOverrides[tx.hash]?.maxPriority ?? ""}
                        onChange={(event) =>
                          setFeeOverrides((previous) => ({
                            ...previous,
                            [tx.hash]: {
                              ...previous[tx.hash],
                              maxPriority: event.target.value,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400">
                    新 gasPrice (gwei)
                    <input
                      value={feeOverrides[tx.hash]?.gasPrice ?? ""}
                      onChange={(event) =>
                        setFeeOverrides((previous) => ({
                          ...previous,
                          [tx.hash]: {
                            ...previous[tx.hash],
                            gasPrice: event.target.value,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
                    />
                  </label>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleResendTx(tx.hash)}
                    disabled={!account || resendStatus[tx.hash]?.loading}
                    className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resendStatus[tx.hash]?.loading ? "Broadcasting..." : "Resend"}
                  </button>
                  <button
                    onClick={() => removePendingTx(tx.hash)}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
                  >
                    Stop tracking
                  </button>
                </div>

                {resendStatus[tx.hash]?.error && (
                  <p className="mt-2 text-xs text-rose-300">
                    {resendStatus[tx.hash]?.error}
                  </p>
                )}
                {resendStatus[tx.hash]?.success && (
                  <p className="mt-2 text-xs text-emerald-300">
                    {resendStatus[tx.hash]?.success}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Mempool transaction monitor
              </h2>
              <p className="text-sm text-slate-400">
                Subscribe to the provider's pending stream to inspect freshly
                submitted transactions.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-emerald-400 focus:ring-emerald-400"
                checked={watchCurrentAccountOnly}
                onChange={(event) => setWatchCurrentAccountOnly(event.target.checked)}
                disabled={!account}
              />
              只跟踪当前钱包
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={isMonitoringMempool ? stopMonitoring : startMonitoring}
              disabled={!provider}
              className="flex-1 rounded-lg bg-fuchsia-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isMonitoringMempool ? "Stop monitoring" : "Start monitoring"}
            </button>
            <button
              onClick={clearPendingTxs}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Clear list
            </button>
          </div>

          {mempoolError && (
            <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {mempoolError}
            </p>
          )}

          {!pendingTxs.length && (
            <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-4 text-sm text-slate-400">
              {isMonitoringMempool
                ? "Listening for pending transactions..."
                : "Start monitoring to capture live mempool data."}
            </p>
          )}

          {pendingTxs.length > 0 && (
            <ul className="mt-5 space-y-3">
              {pendingTxs.map((tx) => (
                <li
                  key={tx.hash}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <p className="font-mono text-xs text-slate-400">{tx.hash}</p>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">From</dt>
                      <dd className="font-mono text-slate-100">{tx.from ?? "--"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">To</dt>
                      <dd className="font-mono text-slate-100">{tx.to ?? "--"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Value</dt>
                      <dd className="font-semibold text-emerald-300">
                        {tx.valueEth} ETH
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Gas price</dt>
                      <dd className="text-slate-200">
                        {tx.gasPriceGwei
                          ? `${tx.gasPriceGwei} gwei`
                          : tx.maxFeePerGasGwei
                          ? `${tx.maxFeePerGasGwei} gwei (max)`
                          : "--"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Nonce</dt>
                      <dd className="text-slate-200">{tx.nonce ?? "--"}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-900">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                USDT Transfer 实时监听 (Infura Mainnet RPC)
              </h2>
              <p className="text-sm text-slate-400">
                通过 `contract.on('Transfer')` 直接订阅主网 USDT 的事件，演示如何脱离
                MetaMask provider 使用独立 RPC。
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              From 地址（可选）
              <input
                value={usdtFromFilter}
                onChange={(event) => {
                  setUsdtFromFilter(event.target.value);
                  setUsdtFilterError(null);
                }}
                placeholder="0x..."
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-slate-400">
              To 地址（可选）
              <input
                value={usdtToFilter}
                onChange={(event) => {
                  setUsdtToFilter(event.target.value);
                  setUsdtFilterError(null);
                }}
                placeholder="0x..."
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={isListeningUsdt ? stopUsdtListener : handleStartUsdtListener}
              className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isListeningUsdt ? "Stop listening" : "Start listening"}
            </button>
            <button
              onClick={resetUsdtTransfers}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Clear list
            </button>
          </div>

          {usdtFilterError && (
            <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {usdtFilterError}
            </p>
          )}

          {usdtError && (
            <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {usdtError}
            </p>
          )}

          {!usdtTransfers.length && (
            <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-4 text-sm text-slate-400">
              {isListeningUsdt
                ? "已连接订阅，等待链上 Transfer 事件..."
                : "点击 Start listening 即可订阅主网 USDT 的 Transfer 日志"}
            </p>
          )}

          {usdtTransfers.length > 0 && (
            <ul className="mt-5 space-y-3">
              {usdtTransfers.map((transfer) => (
                <li
                  key={`${transfer.txHash}-${transfer.blockNumber ?? "pending"}`}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="flex flex-col gap-2 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-mono text-xs text-slate-400 break-all">
                      {transfer.txHash}
                    </div>
                    <div className="text-xs text-slate-400">
                      Block {transfer.blockNumber ?? "--"} ·
                      {" "}
                      {transfer.timestamp
                        ? new Date(transfer.timestamp * 1000).toLocaleString()
                        : "time unknown"}
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">From</dt>
                      <dd className="font-mono text-slate-100">
                        {transfer.from}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">To</dt>
                      <dd className="font-mono text-slate-100">{transfer.to}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Amount</dt>
                      <dd className="text-emerald-300 font-semibold">
                        {transfer.amount} USDT
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-400">
          <p>
            Tips: handle provider availability, request permissions with
            <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-xs text-white">
              eth_requestAccounts
            </code>
            , and react to MetaMask events such as
            <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-xs text-white">
              accountsChanged
            </code>
            and
            <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-xs text-white">
              chainChanged
            </code>
            to keep the UI in sync.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
