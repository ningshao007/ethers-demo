export type PendingTransaction = {
  hash: string;
  from?: string;
  to?: string | null;
  valueEth: string;
  gasPriceGwei?: string;
  maxFeePerGasGwei?: string;
  nonce?: number;
};
