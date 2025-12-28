{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{

  languages.javascript = {
    enable = true;
    bun.enable = true;
  };

  # Zephyr CLI
  scripts.zephyr.exec = ''
    bun run "$DEVENV_ROOT/bin/zephyr.ts" "$@"
  '';

}
