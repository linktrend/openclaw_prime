#!/bin/bash
# Shared fail-closed plumbing for the two Lisa VPS Google identities.
set -euo pipefail
# Preflight uses only system utilities; callers cannot influence resolution.
PATH=/usr/local/bin:/usr/bin:/bin
export PATH

GWS_PACKAGE_ROOT=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

gws_die() {
  printf 'lisa-google-workspace: %s\n' "$*" >&2
  exit 64
}

gws_reject_traversal() {
  local path=$1
  [[ "$path" == /* && "$path" != *$'\n'* && "$path" != *$'\r'* ]] || gws_die "path must be an absolute single-line path"
  [[ "$path" != *"/../"* && "$path" != */.. && "$path" != */./* && "$path" != */. ]] || gws_die "path traversal is not permitted"
}

gws_canonical_existing() {
  local path=$1
  [[ -e "$path" ]] || gws_die "path does not exist: $path"
  realpath "$path" 2>/dev/null || gws_die "cannot canonicalize path: $path"
}

gws_require_contained_path() {
  local root=$1
  local path=$2
  local relative cursor canonical_path
  local -a components
  gws_reject_traversal "$path"
  [[ "$path" == "$root"/* ]] || gws_die "path must remain inside its configured root"
  relative=${path#"$root"/}
  cursor=$root
  IFS=/ read -r -a components <<< "$relative"
  for component in "${components[@]}"; do
    [[ -n "$component" ]] || continue
    cursor="$cursor/$component"
    [[ ! -L "$cursor" ]] || gws_die "symlink path component is not permitted"
  done
  canonical_path=$(gws_canonical_existing "$path")
  [[ "$canonical_path" == "$root" || "$canonical_path" == "$root"/* ]] ||
    gws_die "path escapes its configured physical root"
  printf '%s' "$canonical_path"
}

gws_private_mode() {
  local path=$1
  local mode
  mode=$(stat -c '%a' "$path" 2>/dev/null || stat -f '%Lp' "$path" 2>/dev/null) || return 1
  mode=${mode: -3}
  [[ "$mode" =~ ^[0-7]{3}$ ]] || return 1
  printf '%s' "$mode"
}

gws_require_owned_dir_mode() {
  local path=$1
  local expected_mode=$2
  local label=$3
  local mode
  [[ ! -L "$path" && -d "$path" ]] || gws_die "$label must be a non-symlink directory"
  [[ -O "$path" ]] || gws_die "$label is not owned by the service account"
  mode=$(gws_private_mode "$path") || gws_die "cannot inspect $label permissions"
  [[ "$mode" == "$expected_mode" ]] || gws_die "$label must be mode 0$expected_mode"
  gws_canonical_existing "$path"
}

gws_require_private_dir() {
  gws_require_owned_dir_mode "$1" 700 "private configuration directory" >/dev/null
}

gws_require_private_file() {
  local path=$1
  local mode
  [[ ! -L "$path" && -f "$path" ]] || gws_die "private file is missing or a symlink"
  [[ -O "$path" ]] || gws_die "private file is not owned by the service account"
  mode=$(gws_private_mode "$path") || gws_die "cannot inspect credential file permissions"
  [[ "$mode" == 600 || "$mode" == 400 ]] || gws_die "credential file must be mode 0600 or 0400"
}

gws_resolve_binary() {
  local candidate=${LISA_GWS_BIN:-gws}
  if [[ "$candidate" == */* ]]; then
    [[ -x "$candidate" && ! -d "$candidate" ]] || gws_die "configured gws binary is not executable"
    GWS_BIN=$candidate
  else
    GWS_BIN=$(command -v "$candidate" 2>/dev/null || true)
    [[ -n "$GWS_BIN" && -x "$GWS_BIN" ]] || gws_die "gws binary is not available on PATH"
  fi
}

gws_reject_inherited_auth_env() {
  local name value
  local -a names=(
    GOOGLE_WORKSPACE_CLI_TOKEN
    GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE
    GOOGLE_APPLICATION_CREDENTIALS
    GOOGLE_WORKSPACE_CLI_CLIENT_ID
    GOOGLE_WORKSPACE_CLI_CLIENT_SECRET
    GOOGLE_WORKSPACE_PROJECT_ID
    GOOGLE_CLOUD_PROJECT
    GOOGLE_CLOUD_QUOTA_PROJECT
    GOOGLE_WORKSPACE_CLI_CONFIG_DIR
    GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND
    GOOGLE_WORKSPACE_CLI_SCOPES
    GOOGLE_WORKSPACE_SCOPES
    CLOUDSDK_CONFIG
    XDG_CONFIG_HOME
  )
  for name in "${names[@]}"; do
    value=${!name-}
    [[ -z "$value" ]] || gws_die "inherited auth/config environment is not accepted: $name"
  done
}

gws_require_no_dotenv_ancestors() {
  local cursor=$1
  while :; do
    [[ ! -e "$cursor/.env" ]] || gws_die ".env file in execution cwd ancestry is not permitted"
    [[ "$cursor" == / ]] && break
    cursor=${cursor%/*}
    [[ -n "$cursor" ]] || cursor=/
  done
}

gws_require_execution_dir() {
  local path=$1
  local canonical
  canonical=$(gws_require_owned_dir_mode "$path" 555 "execution cwd")
  gws_require_no_dotenv_ancestors "$canonical"
  printf '%s' "$canonical"
}

gws_require_home_dir() {
  local path=$1
  gws_require_owned_dir_mode "$path" 555 "controlled HOME"
}

gws_path_is_nested() {
  local child=$1
  local parent=$2
  [[ "$child" == "$parent" || "$child" == "$parent"/* ]]
}

gws_optional_operational_env() {
  local proxy=${LISA_GWS_HTTPS_PROXY:-}
  local no_proxy=${LISA_GWS_NO_PROXY:-}
  local ca_file=${LISA_GWS_CA_FILE:-}
  [[ -z "$proxy" || "$proxy" =~ ^https?://[^[:space:]]+$ ]] || gws_die "LISA_GWS_HTTPS_PROXY must be an http(s) URL"
  [[ -z "$no_proxy" || "$no_proxy" =~ ^[A-Za-z0-9.*,:_-]+$ ]] || gws_die "LISA_GWS_NO_PROXY contains unsupported characters"
  if [[ -n "$ca_file" ]]; then
    [[ "$ca_file" == /* ]] || gws_die "LISA_GWS_CA_FILE must be absolute"
    [[ ! -L "$ca_file" && -f "$ca_file" ]] || gws_die "LISA_GWS_CA_FILE must be a regular non-symlink file"
  fi
  [[ -z "$proxy" ]] || printf 'HTTPS_PROXY=%s\n' "$proxy"
  [[ -z "$no_proxy" ]] || printf 'NO_PROXY=%s\n' "$no_proxy"
  [[ -z "$ca_file" ]] || printf 'SSL_CERT_FILE=%s\n' "$(gws_canonical_existing "$ca_file")"
}

gws_init() {
  local identity=$1
  local root=${LISA_GOOGLE_WORKSPACE_CONFIG_ROOT:-}
  local exec_cwd=${LISA_GOOGLE_WORKSPACE_EXEC_CWD:-}
  local home_dir=${LISA_GOOGLE_WORKSPACE_HOME_DIR:-}
  local canonical_root canonical_work canonical_exec canonical_home candidate candidate_path
  local node_bin
  gws_reject_inherited_auth_env
  [[ -n "$root" ]] || gws_die "LISA_GOOGLE_WORKSPACE_CONFIG_ROOT is required"
  gws_reject_traversal "$root"
  gws_require_private_dir "$root"
  canonical_root=$(gws_canonical_existing "$root")

  case "$identity" in
    lisa) GWS_CONFIG_DIR="$canonical_root/lisa" ;;
    carlos-tasks) GWS_CONFIG_DIR="$canonical_root/carlos-tasks" ;;
    *) gws_die "unknown Google identity" ;;
  esac
  gws_require_private_dir "$GWS_CONFIG_DIR"
  GWS_CONFIG_DIR=$(gws_canonical_existing "$GWS_CONFIG_DIR")
  GWS_CONFIG_ROOT=$canonical_root

  [[ -n "$exec_cwd" ]] || gws_die "LISA_GOOGLE_WORKSPACE_EXEC_CWD is required"
  gws_reject_traversal "$exec_cwd"
  canonical_exec=$(gws_require_execution_dir "$exec_cwd")
  [[ -n "$home_dir" ]] || gws_die "LISA_GOOGLE_WORKSPACE_HOME_DIR is required"
  gws_reject_traversal "$home_dir"
  canonical_home=$(gws_require_home_dir "$home_dir")
  gws_path_is_nested "$canonical_exec" "$canonical_root" && gws_die "execution cwd must be outside identity config root"
  gws_path_is_nested "$canonical_home" "$canonical_root" && gws_die "controlled HOME must be outside identity config root"

  [[ -n "${LISA_GOOGLE_WORKSPACE_WORK_DIR:-}" ]] || gws_die "LISA_GOOGLE_WORKSPACE_WORK_DIR is required"
  gws_reject_traversal "$LISA_GOOGLE_WORKSPACE_WORK_DIR"
  gws_require_private_dir "$LISA_GOOGLE_WORKSPACE_WORK_DIR"
  canonical_work=$(gws_canonical_existing "$LISA_GOOGLE_WORKSPACE_WORK_DIR")
  gws_path_is_nested "$canonical_exec" "$canonical_work" && gws_die "execution cwd must be outside work root"

  [[ -z "${LISA_GOOGLE_WORKSPACE_CREDENTIALS_FILE:-}" ]] ||
    gws_die "plaintext credential-file override is not permitted in steady state"
  [[ ! -e "$GWS_CONFIG_DIR/credentials.json" ]] ||
    gws_die "plaintext credentials.json is not permitted in steady state"
  for candidate in credentials.enc .encryption_key; do
    candidate_path=$(gws_require_contained_path "$GWS_CONFIG_DIR" "$GWS_CONFIG_DIR/$candidate")
    gws_require_private_file "$candidate_path"
  done
  for candidate in token_cache.json sa_token_cache.json; do
    if [[ -e "$GWS_CONFIG_DIR/$candidate" ]]; then
      candidate_path=$(gws_require_contained_path "$GWS_CONFIG_DIR" "$GWS_CONFIG_DIR/$candidate")
      gws_require_private_file "$candidate_path"
    fi
  done
  [[ ! -e "$GWS_CONFIG_DIR/client_secret.json" ]] ||
    gws_die "client_secret.json must be removed after encrypted login"
  GWS_EXEC_CWD=$canonical_exec
  GWS_HOME_DIR=$canonical_home
  GWS_WORK_ROOT=$canonical_work
  node_bin=${LISA_GWS_NODE_BIN:-/usr/bin/node}
  [[ "$node_bin" == /* && -x "$node_bin" && ! -d "$node_bin" ]] ||
    gws_die "LISA_GWS_NODE_BIN must name an executable absolute Node.js path"
  GWS_JSON_NODE_BIN=$node_bin
  gws_resolve_binary
}

gws_exec() {
  local -a child_env=(
    "PATH=/usr/local/bin:/usr/bin:/bin"
    "HOME=$GWS_HOME_DIR"
    "GOOGLE_WORKSPACE_CLI_CONFIG_DIR=$GWS_CONFIG_DIR"
    "GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file"
  )
  while IFS= read -r operational; do
    [[ -z "$operational" ]] || child_env+=("$operational")
  done < <(gws_optional_operational_env)
  # Binary Drive content can only be created under the private work root.
  (umask 077; cd "$GWS_EXEC_CWD" && env -i "${child_env[@]}" "$GWS_BIN" "$@")
}

# Route labels are source-only proof bindings; they carry no request values.
gws_exec_route() {
  local route=$1
  shift
  [[ -n "$route" ]] || gws_die "missing gws route binding"
  gws_require_qualified_skills
  gws_exec "$@"
}

gws_require_qualified_skills() {
  local source_receipt="$GWS_PACKAGE_ROOT/receipts/qualified-skills.receipt.json"
  local receipt="${GWS_CONFIG_ROOT:-}/qualified-skills.receipt.json"
  local validator="$GWS_PACKAGE_ROOT/qualification-receipt.mjs"
  # The committed source receipt is inert. Only the exact validator may enable
  # a provider-supplied runtime receipt; a flags-only copy must not.
  [[ -r "$source_receipt" && ! -L "$source_receipt" ]] ||
    gws_die "source Skills receipt prerequisite is missing"
  [[ -r "$validator" && ! -L "$validator" ]] ||
    gws_die "qualified Skills receipt validator is missing"
  [[ -r "$receipt" && ! -L "$receipt" ]] ||
    gws_die "qualified Skills receipt prerequisite is missing"
  "$GWS_JSON_NODE_BIN" "$validator" "$source_receipt" "$receipt" >/dev/null 2>&1 ||
    gws_die "qualified Skills receipt prerequisite is unavailable; provider activation is blocked"
}

gws_require_work_file() {
  local requested=$1
  local work_root=${GWS_WORK_ROOT:-}
  [[ -n "$work_root" && "$work_root" == /* ]] || gws_die "LISA_GOOGLE_WORKSPACE_WORK_DIR is required as an absolute path"
  local path=$requested
  [[ "$path" == /* ]] || path="$work_root/$path"
  gws_reject_traversal "$path"
  path=$(gws_require_contained_path "$work_root" "$path")
  gws_require_private_file "$path"
  printf '%s' "$path"
}

gws_prepare_download_output() {
  local requested=$1
  local output_dir output_path
  [[ "$requested" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] ||
    gws_die "download output name has an invalid shape"
  output_dir="$GWS_WORK_ROOT/downloads"
  output_dir=$(gws_require_contained_path "$GWS_WORK_ROOT" "$output_dir")
  gws_require_private_dir "$output_dir"
  output_path="$output_dir/$requested"
  [[ ! -e "$output_path" && ! -L "$output_path" ]] ||
    gws_die "download output must not already exist"
  [[ "$output_path" == "$output_dir"/* ]] || gws_die "download output escapes private directory"
  printf '%s' "$output_path"
}

gws_internal_email() {
  local email=$1
  [[ "$email" =~ ^[^[:space:]@]+@linktrend\.media$ ]] || gws_die "external or malformed Google recipient is not permitted"
}

gws_internal_email_list() {
  local value=$1
  local email
  local -a entries
  IFS=',' read -r -a entries <<< "$value"
  ((${#entries[@]} > 0)) || gws_die "at least one recipient is required"
  for email in "${entries[@]}"; do
    email="${email#"${email%%[![:space:]]*}"}"
    email="${email%"${email##*[![:space:]]}"}"
    gws_internal_email "$email"
  done
}

gws_id() {
  local value=$1
  [[ "$value" =~ ^[A-Za-z0-9_-]+$ ]] || gws_die "Google resource id has an invalid shape"
}

gws_sheet_range() {
  local value=$1
  local pattern='^[A-Za-z0-9_][A-Za-z0-9_ -]{0,63}(![A-Z]{1,3}[1-9][0-9]*(:[A-Z]{1,3}[1-9][0-9]*)?)?$'
  [[ "$value" =~ $pattern ]] ||
    gws_die "Google Sheets range has an invalid shape"
}

gws_json_rows() {
  local value=$1
  "${GWS_JSON_NODE_BIN:-/usr/bin/node}" -e '
    const value = JSON.parse(process.argv[1]);
    const validCell = (cell) => cell === null || typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean";
    if (!Array.isArray(value) || value.length === 0 || value.length > 100 || !value.every((row) => Array.isArray(row) && row.length > 0 && row.length <= 100 && row.every(validCell))) process.exit(1);
  ' "$value" 2>/dev/null || gws_die "Sheet values must be a bounded JSON array of scalar rows"
}

gws_calendar_id() {
  local value=$1
  [[ "$value" =~ ^opaque_[a-z0-9][a-z0-9_-]{0,126}$ ]] ||
    gws_die "Google Calendar binding reference has an invalid or non-opaque shape"
  case "$value" in
    opaque_lisa-workspace_calendar_work|opaque_lisa-workspace_calendar_routine|opaque_lisa-workspace_calendar_shared-personal-events) ;;
    *) gws_die "Google Calendar binding reference is not in the approved Lisa allowlist" ;;
  esac
}

gws_weekdays() {
  local value=${1:-}
  local token seen= normalized= day
  [[ "$value" =~ ^(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*$ ]] ||
    gws_die "weekdays must be a comma-separated list of MO,TU,WE,TH,FR,SA,SU"
  IFS=',' read -r -a tokens <<< "$value"
  for token in "${tokens[@]}"; do
    case ",$seen," in
      *,"$token",*) gws_die "weekdays must not contain duplicates" ;;
    esac
    seen+="${seen:+,}$token"
  done
  for day in MO TU WE TH FR SA SU; do
    case ",$value," in
      *,"$day",*) normalized+="${normalized:+,}$day" ;;
    esac
  done
  printf '%s' "$normalized"
}

gws_positive_int() {
  local value=$1
  [[ "$value" =~ ^[1-9][0-9]{0,3}$ ]] || gws_die "value must be a positive integer"
}

gws_json_string() {
  "${GWS_JSON_NODE_BIN:-/usr/bin/node}" -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"
}
