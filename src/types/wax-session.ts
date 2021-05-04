export interface WaxSession {
  id: number;
  user_id: number;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
  password_changed_at: number;
  confirmed: boolean;
  steam_id: number;
  first_name?: null;
  last_name?: null;
  display_name: string;
  phone: Phone;
  additional_authentication?: null;
  address?: null;
  social_accounts?: (SocialAccountsEntity)[] | null;
  tos_accepted: boolean;
  age_accepted: boolean;
  token: string;
}
interface Phone {
  type: string;
  country_code: string;
  phone_number: string;
  verified: boolean;
}
interface SocialAccountsEntity {
  provider_alias: string;
  provider_title: string;
  open_id: string;
  avatar?: null;
}

export interface AutoAcceptLogin {
  verified: boolean,
  userAccount: string,
  pubKeys: [
    string,
    string
  ],
  autoLogin: boolean,
  whitelistedContracts: any[]
}

export interface Account {
  account_name: string;
  head_block_num: number;
  head_block_time: string;
  privileged: boolean;
  last_code_update: string;
  created: string;
  core_liquid_balance: string;
  ram_quota: number;
  net_weight: number;
  cpu_weight: number;
  net_limit: NetLimitOrCpuLimit;
  cpu_limit: NetLimitOrCpuLimit;
  ram_usage: number;
  permissions?: (PermissionsEntity)[] | null;
  total_resources: TotalResources;
  self_delegated_bandwidth: SelfDelegatedBandwidth;
  refund_request?: null;
  voter_info: VoterInfo;
  rex_info?: null;
}
export interface NetLimitOrCpuLimit {
  used: number;
  available: number;
  max: number;
}
export interface PermissionsEntity {
  perm_name: string;
  parent: string;
  required_auth: RequiredAuth;
}
export interface RequiredAuth {
  threshold: number;
  keys?: (KeysEntity | null)[] | null;
  accounts?: (AccountsEntity | null)[] | null;
  waits?: (null)[] | null;
}
export interface KeysEntity {
  key: string;
  weight: number;
}
export interface AccountsEntity {
  permission: Permission;
  weight: number;
}
export interface Permission {
  actor: string;
  permission: string;
}
export interface TotalResources {
  owner: string;
  net_weight: string;
  cpu_weight: string;
  ram_bytes: number;
}
export interface SelfDelegatedBandwidth {
  from: string;
  to: string;
  net_weight: string;
  cpu_weight: string;
}
export interface VoterInfo {
  owner: string;
  proxy: string;
  producers?: (null)[] | null;
  staked: number;
  unpaid_voteshare: string;
  unpaid_voteshare_last_updated: string;
  unpaid_voteshare_change_rate: string;
  last_claim_time: string;
  last_vote_weight: string;
  proxied_vote_weight: string;
  is_proxy: number;
  flags1: number;
  reserved2: number;
  reserved3: string;
}

