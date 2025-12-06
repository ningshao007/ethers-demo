import "./App.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_ERC20_ADDRESS } from "./config/appConfig";
import { useWallet } from "./hooks/useWallet";
import { useErc20 } from "./hooks/useErc20";
import { useSiweAuth } from "./hooks/useSiwe";
import { useEip191Auth } from "./hooks/useEip191";
import { useEip712Auth } from "./hooks/useEip712";
import { useMempool } from "./hooks/useMempool";
import { useUsdtTransfers } from "./hooks/useUsdtTransfers";
import { getAddress, isAddress } from "ethers";

function App() {
  const [messageToSign, setMessageToSign] = useState("Hello from ethers.js");
  const [personalSignature, setPersonalSignature] = useState("");
  const [isSigningMessage, setIsSigningMessage] = useState(false);
  const [watchCurrentAccountOnly, setWatchCurrentAccountOnly] = useState(true);
  const [usdtFromFilter, setUsdtFromFilter] = useState("");
  const [usdtToFilter, setUsdtToFilter] = useState("");
  const [usdtFilterError, setUsdtFilterError] = useState<string | null>(null);

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

  useEffect(() => {
    resetSiwe();
    resetEip191();
    resetEip712();
    resetErc20();
  }, [account, resetSiwe, resetEip191, resetEip712, resetErc20]);

  useEffect(() => {
    if (!account) {
      setWatchCurrentAccountOnly(true);
    }
  }, [account]);

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
