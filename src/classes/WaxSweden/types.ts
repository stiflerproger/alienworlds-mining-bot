
export interface BagResponse {
  rows?: (BagRowsEntity)[] | null;
  more: boolean;
  next_key: string;
}
export interface BagRowsEntity {
  account: string;
  items?: (string)[] | null;
  locked: number;
}

export interface AtomicItemAssetResponse {
  success: boolean;
  data: AtomicItemAsset;
  query_time: number;
}
export interface AtomicItemAsset {
  contract: string;
  asset_id: string;
  owner: string;
  is_transferable: boolean;
  is_burnable: boolean;
  collection: Collection;
  schema: Schema;
  template: Template;
  mutable_data: MutableDataOrImmutableData;
  immutable_data: MutableDataOrImmutableData;
  template_mint: string;
  schema_mint: string;
  collection_mint: string;
  backed_tokens?: (null)[] | null;
  burned_by_account?: null;
  burned_at_block?: null;
  burned_at_time?: null;
  updated_at_block: string;
  updated_at_time: string;
  transferred_at_block: string;
  transferred_at_time: string;
  minted_at_block: string;
  minted_at_time: string;
  data: ImmutableDataOrData;
  name: string;
}
export interface Collection {
  collection_name: string;
  name: string;
  img: string;
  author: string;
  allow_notify: boolean;
  authorized_accounts?: (string)[] | null;
  notify_accounts?: (string)[] | null;
  market_fee: number;
  created_at_block: string;
  created_at_time: string;
}
export interface Schema {
  schema_name: string;
  format?: (FormatEntity)[] | null;
  created_at_block: string;
  created_at_time: string;
}
export interface FormatEntity {
  name: string;
  type: string;
}
export interface Template {
  template_id: string;
  max_supply: string;
  is_transferable: boolean;
  is_burnable: boolean;
  issued_supply: string;
  immutable_data: ImmutableDataOrData;
  created_at_time: string;
  created_at_block: string;
}
export interface ImmutableDataOrData {
  img: string;
  ease: number;
  luck: number;
  name: string;
  type: string;
  delay: number;
  shine: string;
  cardid: number;
  rarity: string;
  backimg: string;
  difficulty: number;
}
export interface MutableDataOrImmutableData {
}

export interface LandResponse {
  rows?: (LandRowsEntity)[] | null;
  more: boolean;
  next_key: string;
}
export interface LandRowsEntity {
  miner: string;
  last_mine_tx: string;
  last_mine: string;
  current_land: string;
}

export interface GetInfoResponse {
  block_cpu_limit: number;
  block_net_limit: number;
  chain_id: string;
  fork_db_head_block_id: string;
  fork_db_head_block_num: number;
  head_block_id: string;
  head_block_num: number;
  head_block_producer: string;
  head_block_time: string;
  last_irreversible_block_id: string;
  last_irreversible_block_num: number;
  server_full_version_string: string;
  server_version: string;
  server_version_string: string;
  virtual_block_cpu_limit: number;
  virtual_block_net_limit: number;
}

export interface GetBlockResponse {
  action_mroot: string;
  block_num: number;
  confirmed: number;
  id: string;
  new_producers: null
  previous: string;
  producer: string;
  producer_signature: string;
  ref_block_prefix: number;
  schedule_version: number;
  timestamp: string;
  transaction_mroot: string;
  transactions: any[]
}
