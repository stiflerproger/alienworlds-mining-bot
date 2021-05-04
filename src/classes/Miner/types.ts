export interface MiningParams {
  /** Wax account address */
  account: string | Uint8Array;
  /** Wax account address */
  account_str?: string;
  /** (sum of items diff) * landDiff  */
  difficulty: number;
  last_mine_tx: string;
  mining_account: "m.federation";
  last_mine_arr?: Uint8Array;
  sb?: any;
  logger?: any;
}

export interface MineWork {
  account: string;
  // nonce
  rand_str: string;
  hex_digest: string;
}
