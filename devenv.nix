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
    npm.enable = true;
  };

  languages.typescript.enable = true;
}
