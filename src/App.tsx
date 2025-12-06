import {
  BrowserProvider,
  Contract,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
} from "ethers";
import type { Eip1193Provider, JsonRpcSigner } from "ethers";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiweMessage } from "siwe";

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      isMetaMask?: boolean;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (
        event: string,
        handler: (...args: unknown[]) => void
      ) => void;
      request?: (args: {
        method: string;
        params?: unknown[] | Record<string, unknown>;
      }) => Promise<unknown>;
    };
  }
}

type Erc20Info = {
  name: string;
  symbol: string;
  decimals: number;
  balance?: string;
};

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
];

// Maker publishes a DAI test token on Sepolia at this address (double-check before using).
const ENA_DAI = "0x57e114B691Db790C35207b2e685D4A43181e6061";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";

function App() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [networkName, setNetworkName] = useState<string>("");
  const [balance, setBalance] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [messageToSign, setMessageToSign] = useState("Hello from ethers.js");
  const [signature, setSignature] = useState<string>("");
  const [isSigning, setIsSigning] = useState(false);
  const [erc20Address, setErc20Address] = useState(ENA_DAI);
  const [erc20Info, setErc20Info] = useState<Erc20Info | null>(null);
  const [erc20Loading, setErc20Loading] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("1");
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "confirmed">(
    "idle"
  );
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState<string | null>(null);
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

  const hasMetaMask = useMemo(
    () => typeof window !== "undefined" && Boolean(window.ethereum),
    []
  );

  const shortAccount = useMemo(() => {
    if (!account) return "";
    return `${account.slice(0, 6)}...${account.slice(-4)}`;
  }, [account]);

  const refreshBalance = useCallback(async () => {
    if (!provider || !account) return;

    try {
      const value = await provider.getBalance(account);
      setBalance(formatEther(value));
    } catch (error) {
      setWalletError((error as Error).message);
    }
  }, [provider, account]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setWalletError("MetaMask is not available in this browser");
      return;
    }

    setWalletError(null);
    setIsConnecting(true);

    try {
      if (!window.ethereum.request) {
        throw new Error("MetaMask provider is missing the request method");
      }

      const accountsResponse = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const accounts = Array.isArray(accountsResponse)
        ? (accountsResponse as string[])
        : [];

      if (!accounts.length) {
        throw new Error("No account returned by MetaMask");
      }

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const checksummedAccount = getAddress(accounts[0]);

      setProvider(provider);
      setSigner(signer);
      setAccount(checksummedAccount);
      setChainId(Number(network.chainId));
      setNetworkName(network.name);
      setWalletError(null);
      const value = await provider.getBalance(checksummedAccount);
      setBalance(formatEther(value));
    } catch (error) {
      const err = error as { code?: number; message?: string };
      const message =
        err.code === 4001
          ? "用户拒绝了连接请求"
          : err.message || "Failed to connect wallet";
      setWalletError(message);
      setProvider(null);
      setSigner(null);
      setAccount(null);
      setChainId(null);
      setNetworkName("");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setNetworkName("");
    setBalance("");
    setSignature("");
    setWalletError(null);
  }, []);

  const signMessage = useCallback(async () => {
    if (!signer) {
      setWalletError("Connect MetaMask before signing");
      return;
    }

    setIsSigning(true);
    setWalletError(null);

    try {
      const signed = await signer.signMessage(messageToSign);
      setSignature(signed);
    } catch (error) {
      setWalletError((error as Error).message);
    } finally {
      setIsSigning(false);
    }
  }, [signer, messageToSign]);

  const loadErc20Details = useCallback(async () => {
    if (!provider) {
      setContractError("Connect MetaMask first");
      return;
    }

    if (!isAddress(erc20Address)) {
      setContractError("Enter a valid ERC-20 contract address");
      return;
    }

    setContractError(null);
    setErc20Loading(true);

    try {
      const contract = new Contract(erc20Address, ERC20_ABI, provider);
      const [name, symbol, decimalsValue] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
      ]);
      const decimals = Number(decimalsValue);
      let tokenBalance: bigint | null = null;

      if (account) {
        tokenBalance = await contract.balanceOf(account);
      }

      setErc20Info({
        name,
        symbol,
        decimals,
        balance:
          tokenBalance !== null
            ? formatUnits(tokenBalance, decimals)
            : undefined,
      });
    } catch (error) {
      setContractError((error as Error).message);
      setErc20Info(null);
    } finally {
      setErc20Loading(false);
    }
  }, [provider, erc20Address, account]);

  const transferToken = useCallback(async () => {
    if (!signer || !provider) {
      setTxError("Connect MetaMask before sending transactions");
      return;
    }
    if (!erc20Info) {
      setTxError("Load the token metadata first");
      return;
    }
    if (!isAddress(transferTo)) {
      setTxError("Recipient must be a valid address");
      return;
    }
    if (!transferAmount || Number(transferAmount) <= 0) {
      setTxError("Enter an amount greater than 0");
      return;
    }
    setTxError(null);
    setTxStatus("pending");
    try {
      const contract = new Contract(erc20Address, ERC20_ABI, signer);
      const tx = await contract.transfer(
        transferTo,
        parseUnits(transferAmount, erc20Info.decimals)
      );

      setTxHash(tx.hash);
      await tx.wait();

      setTxStatus("confirmed");

      await refreshBalance();
      await loadErc20Details();
    } catch (error) {
      setTxStatus("idle");
      setTxError((error as Error).message);
    }
  }, [
    signer,
    provider,
    erc20Info,
    transferTo,
    transferAmount,
    erc20Address,
    refreshBalance,
    loadErc20Details,
  ]);

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
    setSiweSession(null);
    setSiweStatus("idle");
    setSiweError(null);
  }, []);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum || !provider) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const nextAccounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];

      if (!nextAccounts.length) {
        disconnectWallet();
        return;
      }

      const normalizedAccount = getAddress(nextAccounts[0]);

      setAccount(normalizedAccount);
      setSiweSession(null);
      setSiweStatus("idle");
      setSiweError(null);

      provider
        .getSigner()
        .then(setSigner)
        .catch((error) => setWalletError((error as Error).message));
      provider
        .getBalance(normalizedAccount)
        .then((value) => setBalance(formatEther(value)))
        .catch((error) => setWalletError((error as Error).message));
    };

    const handleChainChanged = (..._args: unknown[]) => {
      provider
        .getNetwork()
        .then((network) => {
          setChainId(Number(network.chainId));
          setNetworkName(network.name);
          return refreshBalance();
        })
        .catch((error) => setWalletError((error as Error).message));
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [provider, disconnectWallet, refreshBalance]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
        <header className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
          <h1 className="text-3xl font-semibold text-white">
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

        <section className="grid gap-6 md:grid-cols-3">
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
              disabled={!account || isSigning}
              className="mt-4 w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigning ? "Signing..." : "Sign with MetaMask"}
            </button>
            {signature && (
              <div className="mt-4 rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-3 text-xs font-mono text-indigo-200 break-all">
                {signature}
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
              onClick={() => setErc20Address(ENA_DAI)}
            >
              Use ENA sample
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
          <div className="mt-3 flex gap-3">
            <button
              onClick={loadErc20Details}
              disabled={erc20Loading}
              className="flex-1 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {erc20Loading ? "Loading..." : "Read metadata"}
            </button>
            <button
              onClick={() => setErc20Info(null)}
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
      </div>
    </div>
  );
}

export default App;
