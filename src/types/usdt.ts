export type UsdtTransfer = {
  txHash: string;
  blockNumber: number | null;
  timestamp?: number | null;
  from: string;
  to: string;
  amount: string;
};
