import {
  BrowserProvider,
  Contract,
  JsonRpcSigner,
  formatUnits,
  isAddress,
  parseUnits,
} from "ethers";
import { useCallback, useEffect, useState } from "react";
import { ERC20_ABI } from "../constants/abis";
import type { Erc20Info } from "../types/erc20";

type UseErc20Args = {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  account: string | null;
  refreshBalance: () => Promise<void>;
  defaultAddress: string;
};

export function useErc20({
  provider,
  signer,
  account,
  refreshBalance,
  defaultAddress,
}: UseErc20Args) {
  const [erc20Address, setErc20Address] = useState(defaultAddress);
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
  const [erc20CheckStatus, setErc20CheckStatus] = useState<
    "idle" | "checking" | "erc20" | "not-erc20"
  >("idle");
  const [erc20CheckMessage, setErc20CheckMessage] = useState("");

  useEffect(() => {
    setContractError(null);
    setErc20CheckStatus("idle");
    setErc20CheckMessage("");
  }, [erc20Address]);

  const reset = useCallback(() => {
    setErc20Info(null);
    setTransferTo("");
    setTransferAmount("1");
    setTxStatus("idle");
    setTxHash("");
    setTxError(null);
    setErc20CheckStatus("idle");
    setErc20CheckMessage("");
    setContractError(null);
    setErc20Address(defaultAddress);
  }, [defaultAddress]);

  const clearErc20Info = useCallback(() => {
    setErc20Info(null);
    setTxStatus("idle");
    setTxHash("");
    setTxError(null);
    setContractError(null);
    setErc20CheckStatus("idle");
    setErc20CheckMessage("");
  }, []);

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

  const identifyErc20Contract = useCallback(async () => {
    if (!provider) {
      setContractError("Connect MetaMask first");
      return;
    }

    if (!isAddress(erc20Address)) {
      setContractError("Enter a valid contract address");
      return;
    }

    setContractError(null);
    setErc20CheckStatus("checking");
    setErc20CheckMessage("");

    try {
      const code = await provider.getCode(erc20Address);
      if (!code || code === "0x") {
        throw new Error("No contract bytecode deployed at this address");
      }

      const contract = new Contract(erc20Address, ERC20_ABI, provider);
      const [name, symbol, decimalsValue] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
      ]);
      const decimals = Number(decimalsValue);

      setErc20CheckStatus("erc20");
      setErc20CheckMessage(
        `Identified ERC-20 token ${name} (${symbol}) with ${decimals} decimals`
      );
    } catch (error) {
      setErc20CheckStatus("not-erc20");
      setErc20CheckMessage((error as Error).message);
    }
  }, [provider, erc20Address]);

  return {
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
    reset,
  };
}
