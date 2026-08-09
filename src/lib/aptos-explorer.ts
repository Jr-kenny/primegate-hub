export function shortenHash(value: string, visible = 8) {
  if (value.length <= visible * 2 + 3) {
    return value;
  }

  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}

export function getAptosTransactionExplorerUrl(transactionHash: string) {
  return `https://explorer.aptoslabs.com/txn/${encodeURIComponent(transactionHash)}?network=shelbynet`;
}
